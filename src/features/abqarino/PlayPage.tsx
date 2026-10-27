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
import { listGroupsWithCounts, type QuestionGroup } from '../../services/groups.service'
import { PlayerWheel } from './PlayerWheel'
import { Confetti } from './Confetti'
import { setSoundEnabled, sfx, warmSpeech, startTensionMusic, stopTensionMusic } from '../../lib/sounds'

function remainingSeconds(deadlineAt: string | null | undefined) {
  if (!deadlineAt) return 0
  const ms = new Date(deadlineAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 1000))
}

type PostSpinPhase = 'idle' | 'spinning' | 'celebrate' | 'you_are_ready' | 'pick_group'

export function PlayPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [data, setData] = useState<FullSession | null>(null)
  const [groups, setGroups] = useState<QuestionGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [spinning, setSpinning] = useState(false)
  const [postSpin, setPostSpin] = useState<PostSpinPhase>('idle')
  const postSpinRef = useRef<PostSpinPhase>('idle')
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [groupPicking, setGroupPicking] = useState(false)
  const [countdown, setCountdown] = useState(5)
  const [reveal, setReveal] = useState<{
    is_correct?: boolean
    correct_answer?: string
    explanation?: string
    points_awarded?: number
    timed_out?: boolean
    correct_option_id?: string
  } | null>(null)
  const [holdReveal, setHoldReveal] = useState(false)
  const holdRevealTimer = useRef<number | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [flash, setFlash] = useState<'ok' | 'bad' | null>(null)
  const [confetti, setConfetti] = useState(false)
  const [scoreBump, setScoreBump] = useState(false)
  const timeoutFired = useRef(false)
  const lastTickSec = useRef(-1)
  const postSpinTimers = useRef<number[]>([])

  const setPhase = useCallback((p: PostSpinPhase) => {
    postSpinRef.current = p
    setPostSpin(p)
  }, [])

  const settings = data?.session.settings_snapshot || {}
  const soundOn = settings.enable_sound_effects !== false
  const [soundOverride, setSoundOverride] = useState<boolean | null>(null)
  const effectiveSoundOn = soundOverride ?? soundOn
  const showCorrect = settings.show_correct_answer_after_response !== false
  const showExplanation = settings.show_explanation_after_response !== false

  useEffect(() => {
    setSoundEnabled(!!effectiveSoundOn)
    warmSpeech()
  }, [effectiveSoundOn])

  const clearPostSpinTimers = () => {
    postSpinTimers.current.forEach((id) => window.clearTimeout(id))
    postSpinTimers.current = []
  }
  const clearHoldRevealTimer = () => {
    if (holdRevealTimer.current) {
      window.clearTimeout(holdRevealTimer.current)
      holdRevealTimer.current = null
    }
  }
  const LOSS_REVEAL_MS = 6000

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
          setPhase('pick_group')
          setSelectedGroupId(null)
          setGroupPicking(false)
          const gs = await listGroupsWithCounts(full.session.game_id, true)
          setGroups(gs.filter((g) => (g.question_count || 0) > 0))
        } else if (full.session.status === 'ready' || full.session.status === 'selecting_player') {
          setPhase('idle')
          const gs = await listGroupsWithCounts(full.session.game_id, true)
          setGroups(gs.filter((g) => (g.question_count || 0) > 0))
        } else if (full.session.status === 'player_lost' || full.session.status === 'round_complete') {
          setPhase('idle')
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'تعذر تحميل الجولة')
      } finally {
        setLoading(false)
      }
    })()
    return () => clearPostSpinTimers()
  }, [sessionId, setPhase])

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
      stopTensionMusic()
      return
    }
    timeoutFired.current = false
    lastTickSec.current = -1
    sfx.questionAppear()
    startTensionMusic()
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
            clearPostSpinTimers()
            setPhase('idle')
            setSelectedGroupId(null)
            setGroupPicking(false)
            setHoldReveal(true)
            clearHoldRevealTimer()
            const lostName = (res.player_name as string) || undefined
            holdRevealTimer.current = window.setTimeout(() => {
              setHoldReveal(false)
              sfx.playerLost(lostName)
            }, LOSS_REVEAL_MS)
            await reload()
          } catch {
            /* race */
          }
        })()
      }
    }
    tick()
    const id = window.setInterval(tick, 200)
    return () => {
      window.clearInterval(id)
      stopTensionMusic()
    }
  }, [data?.session.status, activeQuestion?.id, activeQuestion?.deadline_at, sessionId, reload, setPhase])

  useEffect(() => {
    if (data?.session.status === 'round_complete') {
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

  useEffect(() => {
    if (!data) return
    const st = data.session.status
    if (st === 'player_lost' || st === 'round_complete' || st === 'question_active' || st === 'answer_reveal') {
      if (postSpinRef.current !== 'idle') {
        clearPostSpinTimers()
        setPhase('idle')
      }
      return
    }
    if (st === 'selecting_group') {
      if (spinning) return
      if (
        postSpinRef.current === 'spinning' ||
        postSpinRef.current === 'celebrate' ||
        postSpinRef.current === 'you_are_ready'
      ) {
        return
      }
      if (postSpinRef.current !== 'pick_group') {
        setPhase('pick_group')
        void listGroupsWithCounts(data.session.game_id, true).then((gs) => {
          setGroups(gs.filter((g) => (g.question_count || 0) > 0))
        })
      }
    }
    if ((st === 'ready' || st === 'selecting_player') && postSpinRef.current === 'pick_group') {
      setPhase('idle')
    }
  }, [data, setPhase, spinning])

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

  const startCelebrateSequence = useCallback(
    (name: string) => {
      if (postSpinRef.current === 'celebrate' || postSpinRef.current === 'you_are_ready') return
      clearPostSpinTimers()
      setPhase('celebrate')
      setConfetti(true)
      setCountdown(5)
      sfx.nameReveal()
      window.setTimeout(() => sfx.secondTick(5), 400)
      for (let s = 4; s >= 1; s--) {
        const delay = (5 - s) * 1000
        const tid = window.setTimeout(() => {
          setCountdown(s)
          sfx.secondTick(s)
        }, delay)
        postSpinTimers.current.push(tid)
      }
      const tReady = window.setTimeout(() => {
        setPhase('you_are_ready')
        setConfetti(false)
        sfx.youAreReady()
      }, 5000)
      postSpinTimers.current.push(tReady)
      const tGroups = window.setTimeout(() => {
        setPhase('pick_group')
        setSelectedGroupId(null)
        setGroupPicking(false)
        sfx.transition()
      }, 5000 + 2800)
      postSpinTimers.current.push(tGroups)
      void name
    },
    [setPhase]
  )

  const onWheelLanded = useCallback(
    (name: string) => startCelebrateSequence(name),
    [startCelebrateSequence]
  )

  async function onSpin() {
    if (!sessionId || busy || spinning) return
    setBusy(true)
    setSpinning(true)
    setPhase('spinning')
    setError(null)
    clearHoldRevealTimer()
    setHoldReveal(false)
    setReveal(null)
    clearPostSpinTimers()
    try {
      await selectPlayer(sessionId)
      const full = await reload()
      if (full) {
        const g2 = await listGroupsWithCounts(full.session.game_id, true)
        setGroups(g2.filter((g) => (g.question_count || 0) > 0))
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'فشل اختيار اللاعب')
      setPhase('idle')
    } finally {
      setSpinning(false)
      setBusy(false)
      const fallback = window.setTimeout(async () => {
        if (postSpinRef.current !== 'spinning') return
        try {
          const full = await getFullSession(sessionId!)
          setData(full)
          const name =
            full.players.find((p) => p.roster_player_id === full.session.selected_player_id)
              ?.display_name_snapshot || 'اللاعب'
          startCelebrateSequence(name)
        } catch {
          startCelebrateSequence('اللاعب')
        }
      }, 4500)
      postSpinTimers.current.push(fallback)
    }
  }

  async function onPickGroup(groupId: string) {
    if (!sessionId || busy || groupPicking) return
    setGroupPicking(true)
    setSelectedGroupId(groupId)
    setError(null)
    setReveal(null)
    sfx.groupSelect()
    sfx.whoosh()
    await new Promise((r) => setTimeout(r, 1400))
    setBusy(true)
    try {
      await selectGroup(sessionId, groupId)
      sfx.transition()
      setPhase('idle')
      await reload()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'فشل اختيار المجال')
      setSelectedGroupId(null)
      setGroupPicking(false)
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
        sfx.correct()
        sfx.points()
        setFlash('ok')
        setScoreBump(true)
        setConfetti(true)
        window.setTimeout(() => setConfetti(false), 2200)
        window.setTimeout(() => setScoreBump(false), 500)
        if (res.round_complete) sfx.win(res.player_name)
      } else {
        sfx.wrong()
        setFlash('bad')
        clearPostSpinTimers()
        setPhase('idle')
        setSelectedGroupId(null)
        setGroupPicking(false)
        setHoldReveal(true)
        clearHoldRevealTimer()
        const lostName = res.player_name || selectedPlayerName || undefined
        holdRevealTimer.current = window.setTimeout(() => {
          setHoldReveal(false)
          sfx.playerLost(lostName)
        }, LOSS_REVEAL_MS)
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
    clearHoldRevealTimer()
    setHoldReveal(false)
    setReveal(null)
    sfx.click()
    sfx.whoosh()
    setPhase('idle')
    setSelectedGroupId(null)
    setGroupPicking(false)
    try {
      await advanceSession(sessionId)
      const full = await reload()
      if (full?.session.status === 'selecting_player' || full?.session.status === 'ready') {
        setPhase('idle')
      }
      if (full?.session.status === 'selecting_group') {
        setPhase('pick_group')
        const gs = await listGroupsWithCounts(full.session.game_id, true)
        setGroups(gs.filter((g) => (g.question_count || 0) > 0))
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'فشل المتابعة')
    } finally {
      setBusy(false)
    }
  }

  async function goToWheelAfterLoss() {
    if (!sessionId || busy) return
    setBusy(true)
    sfx.click()
    clearPostSpinTimers()
    setPhase('idle')
    clearHoldRevealTimer()
    setHoldReveal(false)
    setReveal(null)
    setSelectedGroupId(null)
    setGroupPicking(false)
    setSpinning(false)
    try {
      await advanceSession(sessionId)
      await reload()
      setPhase('idle')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'فشل المتابعة')
      setPhase('idle')
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

  const inSpinFx = spinning || postSpin === 'spinning' || postSpin === 'celebrate'
  const showReadyAlone = status === 'selecting_group' && postSpin === 'you_are_ready' && !inSpinFx
  const showGroupPicker = status === 'selecting_group' && !inSpinFx && postSpin !== 'you_are_ready'
  const showWheel =
    inSpinFx ||
    ((status === 'ready' || status === 'selecting_player') && !showReadyAlone && !showGroupPicker)
  const showLost = status === 'player_lost' && !holdReveal
  const showWon = status === 'round_complete'
  const showQuestion =
    ((status === 'question_active' || status === 'answer_reveal' || (status === 'player_lost' && holdReveal)) &&
      !!activeQuestion)
  const timerDurationMs =
    activeQuestion?.started_at && activeQuestion?.deadline_at
      ? Math.max(1, new Date(activeQuestion.deadline_at).getTime() - new Date(activeQuestion.started_at).getTime())
      : Math.max(1, (Number(settings.question_time_seconds) || 45) * 1000)
  const timerProgress = Math.max(0, Math.min(100, (secondsLeft * 1000 / timerDurationMs) * 100))

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
              const nextSoundState = !effectiveSoundOn
              setSoundOverride(nextSoundState)
              setSoundEnabled(nextSoundState)
              sfx.unlock()
              warmSpeech()
            }}
            className="text-sm text-slate-300 hover:text-white fx-btn px-2 py-1 rounded-lg"
          >
            {effectiveSoundOn ? '🔊' : '🔇'}
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
        {showLost && (
          <div className="text-center space-y-6 fx-pop max-w-lg">
            <p className="text-5xl">😢</p>
            <h2 className="text-3xl sm:text-4xl font-black text-red-300 drop-shadow">
              لقد خسر {selectedPlayerName || 'اللاعب'}
            </h2>
            <p className="text-slate-400">إجابة خاطئة أو انتهى الوقت</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <button
                type="button"
                onClick={goToWheelAfterLoss}
                disabled={busy}
                className="fx-btn px-6 py-3 bg-amber-500 text-slate-900 rounded-xl font-bold"
              >
                تكملة — العجلة
              </button>
              <button
                type="button"
                onClick={goToWheelAfterLoss}
                disabled={busy}
                className="fx-btn px-6 py-3 bg-red-600 rounded-xl font-bold"
              >
                العودة للعجلة
              </button>
              <Link to="/admin" onClick={() => sfx.click()} className="fx-btn px-6 py-3 bg-slate-700 rounded-xl text-center">
                لوحة التحكم
              </Link>
            </div>
          </div>
        )}

        {showWon && (
          <div className="text-center space-y-6 fx-pop">
            <p className="text-5xl">🏆</p>
            <h2 className="text-3xl font-black text-amber-300">مبروك الفوز!</h2>
            <p className="text-slate-300">{selectedPlayerName} وصل للهدف</p>
            <Link to="/admin" className="fx-btn inline-block px-6 py-3 bg-amber-500 text-slate-900 rounded-xl font-bold">
              لوحة التحكم
            </Link>
          </div>
        )}

        {!showLost && !showWon && showWheel && !showReadyAlone && !showGroupPicker && (
          <PlayerWheel
            players={wheelPlayers}
            selectedRosterId={session.selected_player_id}
            spinning={spinning || postSpin === 'spinning'}
            onSpinRequest={onSpin}
            onLanded={onWheelLanded}
            disabled={busy}
            hideSpinButton={postSpin === 'celebrate'}
          />
        )}

        {!showLost && !showWon && showReadyAlone && (
          <div className="text-center space-y-4 fx-pop">
            <p className="text-4xl font-black text-cyan-300">You are ready!</p>
            <p className="text-slate-400">{selectedPlayerName}</p>
          </div>
        )}

        {!showLost && !showWon && showGroupPicker && (
          <div className="w-full space-y-4 fx-enter">
            <h2 className="text-xl font-bold text-center">اختر المجال</h2>
            <div className="grid grid-cols-2 gap-3">
              {groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  disabled={busy || groupPicking}
                  onClick={() => onPickGroup(g.id)}
                  className={`fx-btn px-4 py-4 rounded-xl border text-right ${
                    selectedGroupId === g.id
                      ? 'bg-cyan-600/80 border-cyan-300'
                      : 'bg-slate-800/90 border-slate-600'
                  }`}
                >
                  <span className="font-bold">{g.name}</span>
                  <span className="block text-xs text-slate-400">{g.question_count || 0} سؤال</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {!showLost && !showWon && showQuestion && activeQuestion && (
          <div className="w-full space-y-6 fx-enter">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">
                سؤال {(session.current_question_index || 0) + 1}
              </span>
              {status === 'question_active' && (
                <span
                  className={`text-3xl font-mono font-black tabular-nums ${
                    secondsLeft <= 5
                      ? 'fx-timer-urgent'
                      : secondsLeft <= 10
                        ? 'fx-timer-warning'
                        : 'text-amber-300'
                  }`}
                >
                  {secondsLeft}
                  <span className="text-base font-medium mr-1">ث</span>
                </span>
              )}
            </div>
            {status === 'question_active' && (
              <div className="h-2.5 rounded-full bg-slate-700/80 overflow-hidden border border-white/10">
                <div
                  className={`h-full rounded-full transition-[width] duration-200 ${
                    secondsLeft <= 5
                      ? 'bg-red-500'
                      : secondsLeft <= 10
                        ? 'bg-orange-400'
                        : 'bg-amber-400'
                  }`}
                  style={{ width: `${timerProgress}%` }}
                />
              </div>
            )}
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
            <div className="grid gap-3">
              {(activeQuestion.options_snapshot || []).map((opt, i) => {
                const revealed = status === 'answer_reveal' || !!reveal || holdReveal
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
                {reveal && (
                  <p
                    className={
                      reveal.is_correct
                        ? 'text-green-400 font-black text-xl'
                        : 'text-red-300 font-black text-xl'
                    }
                  >
                    {reveal.is_correct
                      ? `برافو! +${reveal.points_awarded || 0} ✨`
                      : reveal.timed_out
                        ? 'انتهى الوقت'
                        : 'للأسف خطأ يا عبقرينو'}
                  </p>
                )}
                {showCorrect && reveal?.correct_answer && (
                  <p className="text-sm text-slate-300">الإجابة الصحيحة: {reveal.correct_answer}</p>
                )}
                {showExplanation && reveal?.explanation && (
                  <p className="text-sm text-slate-400">{reveal.explanation}</p>
                )}
                {reveal?.is_correct && (
                  <button
                    onClick={onNext}
                    disabled={busy}
                    className="fx-btn mt-2 px-5 py-2 bg-amber-500 text-slate-900 rounded-xl font-bold"
                  >
                    السؤال التالي
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {!showLost &&
          !showWon &&
          !showWheel &&
          !showReadyAlone &&
          !showGroupPicker &&
          !showQuestion && (
            <div className="text-center text-slate-400 fx-pop">
              <p>جاري التحميل…</p>
            </div>
          )}
      </main>
    </div>
  )
}
