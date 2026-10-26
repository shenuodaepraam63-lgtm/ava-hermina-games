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
import { Confetti } from './Confetti'
import { setSoundEnabled, sfx, warmSpeech } from '../../lib/sounds'

function remainingSeconds(deadlineAt: string | null | undefined) {
  if (!deadlineAt) return 0
  const ms = new Date(deadlineAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 1000))
}

type PostSpinPhase = 'idle' | 'celebrate' | 'you_are_ready' | 'pick_group'

export function PlayPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [data, setData] = useState<FullSession | null>(null)
  const [groups, setGroups] = useState<QuestionGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [spinning, setSpinning] = useState(false)
  const [postSpin, setPostSpin] = useState<PostSpinPhase>('idle')
  const [countdown, setCountdown] = useState(5)
  const [reveal, setReveal] = useState<{
    is_correct?: boolean
    correct_answer?: string
    explanation?: string
    points_awarded?: number
    timed_out?: boolean
    correct_option_id?: string
  } | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [flash, setFlash] = useState<'ok' | 'bad' | null>(null)
  const [confetti, setConfetti] = useState(false)
  const [scoreBump, setScoreBump] = useState(false)
  const timeoutFired = useRef(false)
  const lastTickSec = useRef(-1)
  const postSpinTimers = useRef<number[]>([])

  const settings = data?.session.settings_snapshot || {}
  const soundOn = settings.enable_sound_effects !== false
  const showCorrect = settings.show_correct_answer_after_response !== false
  const showExplanation = settings.show_explanation_after_response !== false

  useEffect(() => {
    setSoundEnabled(!!soundOn)
    warmSpeech()
  }, [soundOn])

  const clearPostSpinTimers = () => {
    postSpinTimers.current.forEach((id) => window.clearTimeout(id))
    postSpinTimers.current = []
  }

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
        if (full.session.status === 'selecting_group') {
          setPostSpin('pick_group')
          const gs = await listGroups(full.session.game_id, true)
          setGroups(gs)
        } else if (full.session.status === 'ready' || full.session.status === 'selecting_player') {
          setPostSpin('idle')
          const gs = await listGroups(full.session.game_id, true)
          setGroups(gs)
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'تعذر تحميل الجولة')
      } finally {
        setLoading(false)
      }
    })()
    return () => clearPostSpinTimers()
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
    lastTickSec.current = -1
    sfx.questionAppear()
    const tick = () => {
      const left = remainingSeconds(activeQuestion.deadline_at)
      setSecondsLeft(left)
      if (left !== lastTickSec.current && left > 0 && left <= 5) {
        lastTickSec.current = left
        sfx.urgentTick()
      } else if (left !== lastTickSec.current && left > 5 && left <= 10) {
        lastTickSec.current = left
        sfx.tick()
      }
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
            setFlash('bad')
            sfx.timeout()
            await reload()
          } catch {
            /* race */
          }
        })()
      }
    }
    tick()
    const id = window.setInterval(tick, 200)
    return () => window.clearInterval(id)
  }, [data?.session.status, activeQuestion?.id, activeQuestion?.deadline_at, sessionId, reload])

  useEffect(() => {
    if (data?.session.status === 'round_complete') {
      sfx.win()
      setConfetti(true)
      const t = window.setTimeout(() => setConfetti(false), 4500)
      return () => window.clearTimeout(t)
    }
  }, [data?.session.status])

  useEffect(() => {
    if (!flash) return
    const t = window.setTimeout(() => setFlash(null), 700)
    return () => window.clearTimeout(t)
  }, [flash])

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

  /**
   * بعد توقف العجلة:
   * 1) احتفال بالاسم + confetti + صوت
   * 2) عداد 5 ثوانٍ بصوت كل ثانية
   * 3) شاشة You are ready لوحدها + صوت
   * 4) اختيار المجال
   */
  const onWheelLanded = useCallback((_name: string) => {
    clearPostSpinTimers()
    setPostSpin('celebrate')
    setConfetti(true)
    setCountdown(5)
    sfx.nameReveal()
    // صوت للثانية 5 فورًا
    window.setTimeout(() => sfx.secondTick(5), 400)

    for (let s = 4; s >= 1; s--) {
      const delay = (5 - s) * 1000
      const tid = window.setTimeout(() => {
        setCountdown(s)
        sfx.secondTick(s)
      }, delay)
      postSpinTimers.current.push(tid)
    }

    // بعد 5 ثوانٍ: شاشة You are ready لوحدها
    const tReady = window.setTimeout(() => {
      setPostSpin('you_are_ready')
      setConfetti(false)
      sfx.youAreReady()
    }, 5000)
    postSpinTimers.current.push(tReady)

    // بعد انتهاء النطق تقريبًا: المجالات
    const tGroups = window.setTimeout(() => {
      setPostSpin('pick_group')
      sfx.transition()
    }, 5000 + 2800)
    postSpinTimers.current.push(tGroups)
  }, [])

  async function onSpin() {
    if (!sessionId || busy || spinning) return
    setBusy(true)
    setSpinning(true)
    setError(null)
    setReveal(null)
    setPostSpin('idle')
    clearPostSpinTimers()
    try {
      await selectPlayer(sessionId)
      await reload()
      const full = await getFullSession(sessionId)
      const g2 = await listGroups(full.session.game_id, true)
      setGroups(g2)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'فشل اختيار اللاعب')
      setPostSpin('idle')
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
    sfx.groupSelect()
    try {
      await selectGroup(sessionId, groupId)
      sfx.transition()
      await reload()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'فشل اختيار المجال')
    } finally {
      setBusy(false)
    }
  }

  async function onAnswer(optionId: string) {
    if (!sessionId || !activeQuestion || busy) return
    setBusy(true)
    setError(null)
    sfx.uiTap()
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
      if (res.is_correct) {
        sfx.correct() // نغمة + «برافو!»
        sfx.points()
        setFlash('ok')
        setScoreBump(true)
        setConfetti(true)
        window.setTimeout(() => setConfetti(false), 2200)
        window.setTimeout(() => setScoreBump(false), 500)
      } else {
        sfx.wrong() // نغمة + «للأسف خطأ يا عبقرينو»
        setFlash('bad')
      }
      await reload()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'فشل تسجيل الإجابة')
    } finally {
      setBusy(false)
    }
  }

  async function onNext() {
    if (!sessionId || busy) return
    setBusy(true)
    setReveal(null)
    sfx.click()
    sfx.whoosh()
    setPostSpin('idle')
    try {
      await advanceSession(sessionId)
      const full = await reload()
      if (full?.session.status === 'selecting_player' || full?.session.status === 'ready') {
        setPostSpin('idle')
      }
      if (full?.session.status === 'selecting_group') {
        setPostSpin('pick_group')
        const gs = await listGroups(full.session.game_id, true)
        setGroups(gs)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'فشل المتابعة')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center fx-stage-bg text-white">
        <p className="fx-pop text-lg">جاري استعادة الجولة…</p>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 fx-stage-bg text-white">
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

  const showWheel =
    status === 'ready' ||
    status === 'selecting_player' ||
    (status === 'selecting_group' && postSpin === 'celebrate')

  const showReadyAlone = status === 'selecting_group' && postSpin === 'you_are_ready'
  const showGroupPicker = status === 'selecting_group' && postSpin === 'pick_group'

  return (
    <div
      className={`min-h-screen fx-stage-bg text-white flex flex-col relative overflow-hidden ${
        flash === 'ok' ? 'fx-flash-ok' : flash === 'bad' ? 'fx-flash-bad' : ''
      }`}
    >
      <Confetti active={confetti} />

      <header className="flex items-center justify-between px-4 py-3 border-b border-white/10 backdrop-blur-sm bg-black/20 z-10">
        <div>
          <p className="text-xs text-slate-400">عبقرينو</p>
          <p className={`font-bold text-lg ${scoreBump ? 'fx-score-bump text-amber-300' : ''}`}>
            {selectedPlayerName || '—'} · {totalScore}/{winningScore}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setSoundEnabled(!soundOn)
              sfx.unlock()
              warmSpeech()
            }}
            className="text-sm text-slate-300 hover:text-white fx-btn px-2 py-1 rounded-lg"
          >
            {soundOn ? '🔊' : '🔇'}
          </button>
          <Link to="/admin" className="text-xs text-slate-400 hover:text-white">
            لوحة التحكم
          </Link>
        </div>
      </header>

      {error && (
        <div className="mx-4 mt-3 text-sm text-red-200 bg-red-900/50 px-4 py-2 rounded-xl fx-shake">
          {error}
        </div>
      )}

      <main className="flex-1 flex flex-col items-center justify-center p-6 max-w-3xl mx-auto w-full z-10">
        {showWheel && (
          <div className="text-center space-y-5 w-full">
            <h2 className="text-2xl font-black tracking-wide fx-enter">عجلة المخدومين</h2>
            <PlayerWheel
              players={wheelPlayers}
              selectedRosterId={session.selected_player_id}
              spinning={spinning}
              onSpinRequest={onSpin}
              onLanded={onWheelLanded}
              disabled={busy}
              hideSpinButton={postSpin === 'celebrate'}
            />

            {postSpin === 'celebrate' && (
              <div className="fx-pop space-y-3">
                <p className="text-xl text-amber-200 font-bold">🎉 مبروك! تم اختيار اللاعب</p>
                <p className="text-6xl font-black text-white tabular-nums drop-shadow">{countdown}</p>
                <p className="text-sm text-slate-400">استعد…</p>
              </div>
            )}
          </div>
        )}

        {/* شاشة You are ready لوحدها بالكامل */}
        {showReadyAlone && (
          <div className="text-center space-y-6 fx-pop py-12">
            <p className="text-5xl sm:text-6xl font-black text-amber-300 drop-shadow-lg tracking-wide">
              You are ready!
            </p>
            <p className="text-xl text-slate-300">{selectedPlayerName}</p>
            <p className="text-sm text-slate-500">جاري تحميل المجالات…</p>
          </div>
        )}

        {showGroupPicker && (
          <div className="text-center space-y-6 w-full fx-enter">
            <h2 className="text-2xl font-black">
              <span className="text-amber-300">{selectedPlayerName}</span> — اختر المجال
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {groups.map((g, i) => (
                <button
                  key={g.id}
                  onClick={() => onPickGroup(g.id)}
                  disabled={busy}
                  style={{ animationDelay: `${i * 0.06}s` }}
                  className="fx-enter fx-btn p-5 rounded-2xl bg-slate-800/90 border border-slate-600 hover:border-red-500 text-lg font-bold disabled:opacity-50"
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
          <div className="w-full space-y-6 fx-enter">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">
                سؤال {(session.current_question_index || 0) + 1}
              </span>
              {status === 'question_active' && (
                <span
                  className={`text-3xl font-mono font-black tabular-nums ${
                    secondsLeft <= 5 ? 'fx-timer-urgent' : 'text-amber-300'
                  }`}
                >
                  {secondsLeft}
                  <span className="text-base font-medium mr-1">ث</span>
                </span>
              )}
            </div>

            <h2 className="text-xl md:text-2xl font-bold leading-relaxed fx-pop">
              {activeQuestion.question_text_snapshot}
            </h2>

            {activeQuestion.media_url && activeQuestion.media_type === 'image' && (
              <img
                src={activeQuestion.media_url}
                alt=""
                className="max-h-56 mx-auto rounded-2xl border border-slate-600 object-contain fx-pop shadow-xl"
              />
            )}
            {activeQuestion.media_url && activeQuestion.media_type === 'audio' && (
              <audio controls src={activeQuestion.media_url} className="w-full fx-enter" />
            )}

            <div className="grid gap-3">
              {(activeQuestion.options_snapshot || []).map((opt, i) => {
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
                    style={{ animationDelay: `${i * 0.05}s` }}
                    className={`fx-enter fx-option text-right px-4 py-3.5 rounded-xl border text-base ${
                      revealed && isCorrectOpt && showCorrect
                        ? 'bg-green-600/90 border-green-400 fx-pop'
                        : revealed && isSelected && !reveal?.is_correct
                          ? 'bg-red-800/90 border-red-500 fx-shake'
                          : 'bg-slate-800/90 border-slate-600'
                    } disabled:opacity-80`}
                  >
                    {opt.option_text}
                  </button>
                )
              })}
            </div>

            {(status === 'answer_reveal' || reveal) && (
              <div className="bg-slate-800/90 rounded-2xl p-5 space-y-2 border border-white/10 fx-pop">
                {reveal?.timed_out && (
                  <p className="text-amber-300 font-bold text-lg">انتهى الوقت ⏱</p>
                )}
                {reveal && !reveal.timed_out && (
                  <p
                    className={
                      reveal.is_correct
                        ? 'text-green-400 font-black text-xl'
                        : 'text-red-300 font-black text-xl'
                    }
                  >
                    {reveal.is_correct
                      ? `برافو! +${reveal.points_awarded || 0} ✨`
                      : 'للأسف خطأ يا عبقرينو'}
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
                  className="fx-btn mt-3 px-8 py-3 bg-red-600 rounded-xl font-bold hover:bg-red-500 disabled:opacity-50"
                >
                  التالي
                </button>
              </div>
            )}
          </div>
        )}

        {status === 'round_complete' && (
          <div className="text-center space-y-5 fx-pop">
            <h2 className="text-4xl font-black text-amber-300 drop-shadow-lg">انتهت الجولة 🎉</h2>
            <p className="text-2xl font-bold">النتيجة النهائية: {totalScore}</p>
            <div className="space-y-2 text-sm text-slate-300">
              {data.players.map((p) => {
                const sc = data.scores.find((s) => s.session_player_id === p.id)
                return (
                  <div key={p.id} className="fx-enter">
                    {p.display_name_snapshot}: {sc?.score ?? 0}
                  </div>
                )
              })}
            </div>
            <Link
              to="/admin/sessions/new"
              className="fx-btn inline-block mt-4 px-8 py-3 bg-red-600 rounded-xl font-bold"
            >
              جولة جديدة
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
