-- 007: منع تكرار الأسئلة داخل نفس الجولة (عبقرينو)
-- شغّل هذا الملف من Supabase → SQL Editor → Run

CREATE OR REPLACE FUNCTION public.pick_unused_question_from_group(
  p_session_id uuid,
  p_group_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qid uuid;
BEGIN
  -- 1) سؤال عشوائي من نفس المجال لم يُستخدم في الجولة
  SELECT q.id INTO v_qid
  FROM public.questions q
  WHERE q.group_id = p_group_id
    AND COALESCE(q.is_active, true) = true
    AND NOT EXISTS (
      SELECT 1 FROM public.session_questions sq
      WHERE sq.session_id = p_session_id AND sq.question_id = q.id
    )
  ORDER BY random()
  LIMIT 1;

  -- 2) إن نفد المجال: أي سؤال في اللعبة لم يُستخدم
  IF v_qid IS NULL THEN
    SELECT q.id INTO v_qid
    FROM public.questions q
    JOIN public.question_groups g ON g.id = q.group_id
    JOIN public.game_sessions s ON s.id = p_session_id
    WHERE g.game_id = s.game_id
      AND COALESCE(q.is_active, true) = true
      AND NOT EXISTS (
        SELECT 1 FROM public.session_questions sq
        WHERE sq.session_id = p_session_id AND sq.question_id = q.id
      )
    ORDER BY random()
    LIMIT 1;
  END IF;

  RETURN v_qid;
END;
$$;

CREATE OR REPLACE FUNCTION public.select_session_group(
  p_session_id uuid,
  p_group_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.game_sessions%ROWTYPE;
  v_qid uuid;
  v_q public.questions%ROWTYPE;
  v_opts jsonb;
  v_order int;
  v_sq_id uuid;
  v_seconds int;
  v_deadline timestamptz;
BEGIN
  SELECT * INTO v_session
  FROM public.game_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الجلسة غير موجودة';
  END IF;

  IF v_session.status IS DISTINCT FROM 'selecting_group' THEN
    RAISE EXCEPTION 'لا يمكن اختيار المجال الآن (الحالة: %)', v_session.status;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.question_groups g
    WHERE g.id = p_group_id AND g.game_id = v_session.game_id
  ) THEN
    RAISE EXCEPTION 'المجال غير صالح لهذه اللعبة';
  END IF;

  v_qid := public.pick_unused_question_from_group(p_session_id, p_group_id);

  IF v_qid IS NULL THEN
    RAISE EXCEPTION 'لا توجد أسئلة جديدة متبقية. أضف أسئلة أو اختر مجالاً آخر.';
  END IF;

  SELECT * INTO v_q FROM public.questions WHERE id = v_qid;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', o.id,
        'option_text', o.option_text,
        'sort_order', COALESCE(o.sort_order, 0)
      )
      ORDER BY COALESCE(o.sort_order, 0)
    ),
    '[]'::jsonb
  )
  INTO v_opts
  FROM public.question_options o
  WHERE o.question_id = v_qid;

  SELECT COALESCE(MAX(sq.question_order), -1) + 1
  INTO v_order
  FROM public.session_questions sq
  WHERE sq.session_id = p_session_id;

  BEGIN
    v_seconds := COALESCE((v_session.settings_snapshot->>'question_time_seconds')::int, 45);
  EXCEPTION WHEN OTHERS THEN
    v_seconds := 45;
  END;
  IF v_seconds IS NULL OR v_seconds < 5 THEN
    v_seconds := 45;
  END IF;
  v_deadline := clock_timestamp() + (v_seconds || ' seconds')::interval;

  INSERT INTO public.session_questions (
    session_id,
    question_id,
    question_order,
    question_text_snapshot,
    question_type_snapshot,
    explanation_snapshot,
    source_reference_snapshot,
    options_snapshot,
    status,
    started_at,
    deadline_at,
    media_url,
    media_type,
    points_awarded
  ) VALUES (
    p_session_id,
    v_qid,
    v_order,
    v_q.question_text,
    COALESCE(v_q.question_type::text, 'multiple_choice'),
    v_q.explanation,
    v_q.source_reference,
    v_opts,
    'active',
    clock_timestamp(),
    v_deadline,
    v_q.media_url,
    v_q.media_type,
    0
  )
  RETURNING id INTO v_sq_id;

  UPDATE public.game_sessions
  SET
    status = 'question_active',
    selected_group_id = p_group_id,
    current_question_id = v_sq_id,
    current_question_index = v_order,
    last_activity_at = clock_timestamp()
  WHERE id = p_session_id;

  RETURN v_sq_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pick_unused_question_from_group(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.select_session_group(uuid, uuid) TO anon, authenticated, service_role;
