import { supabase } from '../lib/supabase'

export type GameSession = {
  id: string
  game_id: string
  status: string
  selected_player_id: string | null
  selected_group_id: string | null
  current_question_id: string | null
  current_question_index: number
  settings_snapshot: Record<string, unknown>
  state: Record<string, unknown>
  started_at: string | null
  ended_at: string | null
  last_activity_at: string
  created_at: string
}

export type SessionPlayer = {
  id: string
  session_id: string
  roster_player_id: string | null
  display_name_snapshot: string
  seat_order: number
}

export type SessionQuestion = {
  id: string
  session_id: string
  question_id: string | null
  question_order: number
  question_text_snapshot: string
  question_type_snapshot: string
  explanation_snapshot: string | null
  source_reference_snapshot: string | null
  options_snapshot: { id: string; option_text: string; sort_order: number }[]
  correct_option_id?: string | null
  correct_answer_snapshot?: string | null
  selected_option_id: string | null
  is_correct: boolean | null
  points_awarded: number
  status: string
  started_at: string | null
  deadline_at: string | null
  answered_at: string | null
  media_url?: string | null
  media_type?: 'image' | 'audio' | string | null
}

export type SessionScore = {
  id: string
  session_id: string
  session_player_id: string
  score: number
  correct_answers: number
  wrong_answers: number
  timeouts: number
}

export type FullSession = {
  session: GameSession
  players: SessionPlayer[]
  questions: SessionQuestion[]
  scores: SessionScore[]
}

function rpcErrorMessage(error: { message?: string; details?: string; hint?: string }) {
  const raw = error.details || error.message || 'حدث خطأ'
  // Postgres RAISE EXCEPTION appears in message like: ...
  return raw.replace(/^.*exception:\s*/i, '').trim() || raw
}

export async function createSession(playerIds: string[]) {
  const { data, error } = await supabase.rpc('create_abqarino_session', {
    p_player_ids: playerIds,
    p_game_slug: 'abqarino',
  })
  if (error) throw new Error(rpcErrorMessage(error))
  return data as string
}

export async function getFullSession(sessionId: string): Promise<FullSession> {
  const [sessionRes, playersRes, questionsRes, scoresRes] = await Promise.all([
    supabase.from('game_sessions').select('*').eq('id', sessionId).single(),
    supabase.from('session_players').select('*').eq('session_id', sessionId).order('seat_order'),
    supabase.rpc('get_session_questions_for_play', { p_session_id: sessionId }),
    supabase.from('session_scores').select('*').eq('session_id', sessionId),
  ])

  if (sessionRes.error) throw sessionRes.error
  if (playersRes.error) throw playersRes.error
  if (questionsRes.error) throw questionsRes.error
  if (scoresRes.error) throw scoresRes.error

  return {
    session: sessionRes.data as GameSession,
    players: (playersRes.data || []) as SessionPlayer[],
    questions: (questionsRes.data || []) as SessionQuestion[],
    scores: (scoresRes.data || []) as SessionScore[],
  }
}

export async function selectPlayer(sessionId: string) {
  const { data, error } = await supabase.rpc('select_session_player', {
    p_session_id: sessionId,
  })
  if (error) throw new Error(rpcErrorMessage(error))
  return data as string
}

export async function selectGroup(sessionId: string, groupId: string) {
  const { data, error } = await supabase.rpc('select_session_group', {
    p_session_id: sessionId,
    p_group_id: groupId,
  })
  if (error) throw new Error(rpcErrorMessage(error))
  return data as string
}

export async function submitAnswer(
  sessionId: string,
  sessionQuestionId: string,
  selectedOptionId: string,
  idempotencyKey?: string
) {
  const { data, error } = await supabase.rpc('submit_session_answer', {
    p_session_id: sessionId,
    p_session_question_id: sessionQuestionId,
    p_selected_option_id: selectedOptionId,
    p_idempotency_key: idempotencyKey || null,
  })
  if (error) throw new Error(rpcErrorMessage(error))
  return data as {
    is_correct?: boolean
    points_awarded?: number
    score?: number
    round_complete?: boolean
    correct_option_id?: string
    correct_answer?: string
    explanation?: string
    already_resolved?: boolean
    duplicate?: boolean
  }
}

export async function timeoutQuestion(sessionId: string, sessionQuestionId: string) {
  const { data, error } = await supabase.rpc('timeout_session_question', {
    p_session_id: sessionId,
    p_session_question_id: sessionQuestionId,
  })
  if (error) throw new Error(rpcErrorMessage(error))
  return data as Record<string, unknown>
}

export async function advanceSession(sessionId: string) {
  const { data, error } = await supabase.rpc('advance_session', {
    p_session_id: sessionId,
  })
  if (error) throw new Error(rpcErrorMessage(error))
  return data as string
}

export async function listSessions(limit = 30) {
  const { data, error } = await supabase
    .from('game_sessions')
    .select('id, status, started_at, ended_at, created_at, selected_player_id, state')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}
