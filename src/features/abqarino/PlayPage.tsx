import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  advanceSession,
  getFullSession,
  selectGroup,
  selectPlayer,
  submitAnswer,
  timeoutQuestion,
  type FullSession,
  type SessionQuestion,
} from '../../services/sessions.service'
import { listGroups, type QuestionGroup } from '../../services/groups.service'
import { PlayerWheel } from './PlayerWheel'
import { setSoundEnabled, sfx } from '../../lib/sounds'

function remainingSeconds(deadlineAt: string | null | undefined) {
  if (!deadlineAt) return 0
  const ms = new Date(deadlineAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 1000))
}

export function PlayPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [data, setData] = useState<FullSession | null>(null)
  const [groups, setGroups] = useState<QuestionGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [spinning, setSpinning] = useState(false)
  const [reveal, setReveal] = useState<{
    is_correct?: boolean
    correct_answer?: string
    explanation?: string
    points_awarded?: number
    timed_out?: boolean
    correct_option_id?: string
  } | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const timeoutFired = useRef(false)

  const settings = data?.session.settings_snapshot || {}
  const soundOn = settings.enable_sound_effects !== false
  const showCorrect = settings.show_correct_answer_after_response !== false
  const showExplanation = settings.show_explanation_after_response !== false

  useEffect(() => {
    setSoundEnabled(!!soundOn)
  }, [soundOn])

  const reload = useCallback(async () => {
    if (!sessionId) return
    const full = await getFullSession(sessionId)
    setData(full)
    return full
  }, [sessionId])

  useEffect(() => {
    if (!sessionId) return
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const full = await getFullSession(sessionId)
        setData(full)
        try {
          localStorage.setItem('ava_last_session_id', sessionId)
        } catch {
          /* ignore */
        }
        if (
          full.session.status === 'selecting_group' ||
          full.session.status === 'ready' ||
          full.session.status === 'selecting_player'
        ) {
          const gs = await listGroups(full.session.game_id, true)
          setGroups(gs)
        }
      } catch (e: any) {
        setError(e.message || 'تعذر تحميل الجولة')
      } finally {
        setLoading(false)
      }
    })()
  }, [sessionId])

  const activeQuestion: SessionQuestion | undefined = useMemo(() => {
    if (!data) return undefined
    return (
      data.questions.find((q) => q.status === 'active') ||
      data.questions.find(
        (q) =>
          q.question_order === data.session.current_question_index &&
          (q.status === 'answered' || q.status === 'timed_out' || q.status === 'active')
      )
    )
  }, [data])

  useEffect(() => {
    if (!data || data.session.status !== 'question_active' || !activeQuestion?.deadline_at) {
      setSecondsLeft(0)
      return
    }
    timeoutFired.current = false
    const tick = () => {
      const left = remainingSeconds(activeQuestion.deadline_at)
      setSecondsLeft(left)
      if (left <= 0 && !timeoutFired.current && sessionId && activeQuestion) {
        timeoutFired.current = true
        ;(async () => {
          try {
            const res = await timeoutQuestion(sessionId, activeQuestion.id)
            setReveal({
              timed_out: true,
              correct_answer: res.correct_answer as string,
              explanation: res.explanation as string,
              correct_option_id: res.correct_option_id as string,
            })
            sfx.timeout()
            await reload()
          } catch {
            /* deadline race */
          }
        })()
      }
    }
    tick()
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
  }, [data?.session.status, activeQuestion?.id, activeQuestion?.deadline_at, sessionId, reload])

  useEffect(() => {
    if (data?.session.status === 'round_complete') sfx.win()
  }, [data?.session.status])

  const selectedPlayerName = useMemo(() => {
    if (!data?.session.selected_player_id) return null
    return (
      data.players.find((p) => p.roster_player_id === data.session.selected_player_id)
        ?.display_name_snapshot || null
    )
  }, [data])

  const totalScore = useMemo(() => {
    if (!data) return 0
    return data.scores.reduce((s, x) => s + x.score, 0)
  }, [data])

  const wheelPlayers = useMemo(
    () =>
      (data?.players || []).map((p) => ({
        id: p.roster_player_id || p.id,
        name: p.display_name_snapshot,
      })),
    [data]
  )

  async function onSpin() {
    if (!sessionId || busy || spinning) return
    setBusy(true)
    setSpinning(true)
    setError(null)
    setReveal(null)
    try {
      await selectPlayer(sessionId)
      await reload()
      const gs = await listGroups(data?.session.game_id || '', true).catch(() => [])
      if (gs.length) setGroups(gs)
      else {
        const full = await getFullSession(sessionId)
        const g2 = await listGroups(full.session.game_id, true)
        setGroups(g2)
      }
    } catch (e: any) {
      setError(e.message || 'فشل اختيار اللاعب')
    } finally {
      setSpinning(false)
      setBusy(false)
    }
  }

  async function onPickGroup(groupId: string) {
    if (!sessionId || busy) return
    setBusy(true)
    setError(null)
    setReveal(null)
    sfx.click()
    try {
      await selectGroup(sessionId, groupId)
      await reload()
    } catch (e: any) {
      setError(e.message || 'فشل اختيار المجال — تأكد من وجود أسئلة نشطة')
    } finally {
      setBusy(false)
    }
  }

  async function onAnswer(optionId: string) {
    if (!sessionId || !activeQuestion || busy) return
    setBusy(true)
    setError(null)
    try {
      const key = `${sessionId}:${activeQuestion.id}:${optionId}:${Date.now()}`
      const res = await submitAnswer(sessionId, activeQuestion.id, optionId, key)
      setReveal({
        is_correct: res.is_correct,
        correct_answer: res.correct_answer,
        explanation: res.explanation,
        points_awarded: res.points_awarded,
        correct_option_id: res.correct_option_id,
      })
      if (res.is_correct) sfx.correct()
      else sfx.wrong()
      await reload()
    } catch (e: any) {
      setError(e.message || 'فشل تسجيل الإجابة')
    } finally {
      setBusy(false)
    }
  }

  async function onNext() {
    if (!sessionId || busy) return
    setBusy(true)
    setReveal(null)
    sfx.click()
    try {
      await advanceSession(sessionId)
      const full = await reload()
      if (full?.session.status === 'selecting_group' || full?.session.status === 'selecting_player') {
        const gs = await listGroups(full.session.game_id, true)
        setGroups(gs)
      }
    } catch (e: any) {
      setError(e.message || 'فشل المتابعة')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        جاري استعادة الجولة...
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-slate-900 text-white">
        <p className="text-red-300">{error}</p>
        <Link to="/admin" className="text-sm underline">
          العودة للوحة التحكم
        </Link>
      </div>
    )
  }

  if (!data) return null

  const { session } = data
  const status = session.status
  const winningScore = Number(settings.winning_score) || 5

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <div>
          <p className="text-xs text-slate-400">عبقرينو</p>
          <p className="font-bold text-lg">
            {selectedPlayerName || '—'} · {totalScore}/{winningScore}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundOn)}
            className="text-xs text-slate-400 hover:text-white"
            title="الصوت يُضبط أيضاً من إعدادات الأدمن"
          >
            {soundOn ? '🔊' : '🔇'}
          </button>
          <Link to="/admin" className="text-xs text-slate-400 hover:text-white">
            لوحة التحكم
          </Link>
        </div>
      </header>

      {error && (
        <div className="mx-4 mt-3 text-sm text-red-200 bg-red-900/40 px-4 py-2 rounded-xl">{error}</div>
      )}

      <main className="flex-1 flex flex-col items-center justify-center p-6 max-w-3xl mx-auto w-full">
        {(status === 'ready' || status === 'selecting_player') && (
          <div className="text-center space-y-4 w-full">
            <h2 className="text-2xl font-bold">عجلة المخدومين</h2>
            <PlayerWheel
              players={wheelPlayers}
              selectedRosterId={session.selected_player_id}
              spinning={spinning}
              onSpinRequest={onSpin}
              disabled={busy}
            />
          </div>
        )}

        {status === 'selecting_group' && (
          <div className="text-center space-y-6 w-full">
            <h2 className="text-2xl font-bold">{selectedPlayerName} — اختر المجال</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {groups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => onPickGroup(g.id)}
                  disabled={busy}
                  className="p-5 rounded-2xl bg-slate-800 border border-slate-600 hover:border-red-500 text-lg font-semibold disabled:opacity-50"
                >
                  {g.name}
                </button>
              ))}
            </div>
            {groups.length === 0 && (
              <p className="text-slate-400 text-sm">لا توجد مجموعات نشطة — أضفها من لوحة الإدارة</p>
            )}
          </div>
        )}

        {(status === 'question_active' || status === 'answer_reveal') && activeQuestion && (
          <div className="w-full space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">
                سؤال {(session.current_question_index || 0) + 1}
              </span>
              {status === 'question_active' && (
                <span
                  className={`text-2xl font-mono font-bold ${
                    secondsLeft <= 5 ? 'text-red-400' : 'text-amber-300'
                  }`}
                >
                  {secondsLeft}ث
                </span>
              )}
            </div>

            <h2 className="text-xl md:text-2xl font-bold leading-relaxed">
              {activeQuestion.question_text_snapshot}
            </h2>

            {activeQuestion.media_url && activeQuestion.media_type === 'image' && (
              <img
                src={activeQuestion.media_url}
                alt=""
                className="max-h-56 mx-auto rounded-2xl border border-slate-600 object-contain"
              />
            )}
            {activeQuestion.media_url && activeQuestion.media_type === 'audio' && (
              <audio controls src={activeQuestion.media_url} className="w-full" />
            )}

            <div className="grid gap-3">
              {(activeQuestion.options_snapshot || []).map((opt) => {
                const revealed = status === 'answer_reveal' || !!reveal
                const isSelected = activeQuestion.selected_option_id === opt.id
                const isCorrectOpt =
                  reveal?.correct_option_id === opt.id ||
                  (showCorrect &&
                    reveal?.correct_answer &&
                    opt.option_text === reveal.correct_answer)
                return (
                  <button
                    key={opt.id}
                    disabled={busy || revealed || status !== 'question_active'}
                    onClick={() => onAnswer(opt.id)}
                    className={`text-right px-4 py-3 rounded-xl border text-base transition ${
                      revealed && isCorrectOpt && showCorrect
                        ? 'bg-green-700 border-green-500'
                        : revealed && isSelected && !reveal?.is_correct
                          ? 'bg-red-800 border-red-500'
                          : 'bg-slate-800 border-slate-600 hover:border-red-400'
                    } disabled:opacity-80`}
                  >
                    {opt.option_text}
                  </button>
                )
              })}
            </div>

            {(status === 'answer_reveal' || reveal) && (
              <div className="bg-slate-800/80 rounded-2xl p-4 space-y-2">
                {reveal?.timed_out && <p className="text-amber-300 font-medium">انتهى الوقت</p>}
                {reveal && !reveal.timed_out && (
                  <p
                    className={
                      reveal.is_correct ? 'text-green-400 font-bold' : 'text-red-300 font-bold'
                    }
                  >
                    {reveal.is_correct
                      ? `إجابة صحيحة! +${reveal.points_awarded || 0}`
                      : 'إجابة خاطئة'}
                  </p>
                )}
                {showCorrect && reveal?.correct_answer && (
                  <p className="text-sm text-slate-300">الإجابة الصحيحة: {reveal.correct_answer}</p>
                )}
                {showExplanation && reveal?.explanation && (
                  <p className="text-sm text-slate-400">{reveal.explanation}</p>
                )}
                <button
                  onClick={onNext}
                  disabled={busy}
                  className="mt-2 px-6 py-2.5 bg-red-600 rounded-xl font-medium hover:bg-red-500 disabled:opacity-50"
                >
                  التالي
                </button>
              </div>
            )}
          </div>
        )}

        {status === 'round_complete' && (
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold text-amber-300">انتهت الجولة 🎉</h2>
            <p className="text-xl">النتيجة النهائية: {totalScore}</p>
            <div className="space-y-2 text-sm text-slate-300">
              {data.players.map((p) => {
                const sc = data.scores.find((s) => s.session_player_id === p.id)
                return (
                  <div key={p.id}>
                    {p.display_name_snapshot}: {sc?.score ?? 0}
                  </div>
                )
              })}
            </div>
            <Link
              to="/admin/sessions/new"
              className="inline-block mt-4 px-6 py-3 bg-red-600 rounded-xl font-medium"
            >
              جولة جديدة
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
