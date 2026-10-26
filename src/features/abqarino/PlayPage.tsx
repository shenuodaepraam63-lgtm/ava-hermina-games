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
import { setSoundEnabled, sfx, warmSpeech } from '../../lib/sounds'

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
          setPhase('pick_group')
          setSelectedGroupId(null)
          setGroupPicking(false)
          const gs = await listGroupsWithCounts(full.session.game_id, true)
          setGroups(gs.filter((g) => (g.question_count || 0) > 0))
        } else if (
          full.session.status === 'ready' ||
          full.session.status === 'selecting_player'
        ) {
          setPhase('idle')
          const gs = await listGroupsWithCounts(full.session.game_id, true)
          setGroups(gs.filter((g) => (g.question_count || 0) > 0))
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
            window.setTimeout(
              () => sfx.playerLost((res.player_name as string) || undefined),
              800
            )
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

  const startCelebrateSequence = useCallback(
    (name: string) => {
      if (postSpinRef.current === 'celebrate' || postSpinRef.current === 'you_are_ready') return
      if (postSpinRef.current === 'pick_group') return
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
      const fallback = window.setTimeout(() => {
        if (postSpinRef.current === 'spinning') {
          const name =
            data?.players.find((p) => p.roster_player_id === data.session.selected_player_id)
              ?.display_name_snapshot || 'اللاعب'
          startCelebrateSequence(name)
        }
      }, 5000)
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
        if (res.round_complete) {
          sfx.win(res.player_name)
        }
      } else {
        sfx.wrong()
        setFlash('bad')
        window.setTimeout(
          () => sfx.playerLost(res.player_name || selectedPlayerName || undefined),
          900
        )
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
    try {
      await advanceSession(sessionId)
      setPhase('idle')
      setReveal(null)
      await reload()
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
    spinning ||
    postSpin === 'spinning' ||
    postSpin === 'celebrate' ||
    status === 'ready' ||
    status === 'selecting_player'

  const showReadyAlone = postSpin === 'you_are_ready'
  const showGroupPicker = postSpin === 'pick_group' && status === 'selecting_group'

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
        {showWheel && !showReadyAlone && !showGroupPicker && (
          <div className="text-center space-y-5 w-full">
            <h2 className="text-2xl font-black tracking-wide fx-enter">عجلة المخدومين</h2>
            <PlayerWheel
              players={wheelPlayers}
              selectedRosterId={session.selected_player_id}
              spinning={spinning}
              onSpinRequest={onSpin}
              onLanded={onWheelLanded}
              disabled={busy}
              hideSpinButton={postSpin === 'spinning' || postSpin === 'celebrate'}
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

        {showReadyAlone && (
          <div className="text-center space-y-6 fx-pop py-12">
            <p className="text-5xl sm:text-6xl font-black text-amber-300 drop-shadow-lg tracking-wide">
              You are ready!
            </p>
            <p className="text-xl text-slate-300">{selectedPlayerName}</p>
          </div>
        )}

        {showGroupPicker && (
          <div className="text-center space-y-6 w-full fx-enter">
            <h2 className="text-2xl font-black fx-pop">
              <span className="text-amber-300">{selectedPlayerName}</span> — اختر المجال
            </h2>
            <div className="relative flex flex-wrap justify-center gap-4 min-h-[200px] items-center">
              {groups.map((g, i) => {
                const isSel = selectedGroupId === g.id
                const fading = !!(groupPicking && selectedGroupId && !isSel)
                return (
                  <button
                    key={g.id}
                    onClick={() => onPickGroup(g.id)}
                    disabled={busy || groupPicking}
                    style={{ animationDelay: `${i * 0.07}s` }}
                    className={
                      'fx-enter group-balloon relative px-8 py-6 rounded-full text-lg font-black transition-all duration-700 ' +
                      (isSel
                        ? 'bg-red-600 text-white scale-125 z-20 shadow-[0_0_40px_rgba(220,38,38,0.7)] fx-balloon-pulse border-4 border-amber-300'
                        : fading
                          ? 'opacity-0 scale-50 pointer-events-none'
                          : 'bg-slate-800/90 border-2 border-slate-500 hover:border-red-400 hover:scale-105 fx-btn')
                    }
                  >
                    <span className="relative z-10">
                      {g.name}
                      {g.question_count != null ? ` (${g.question_count})` : ''}
                    </span>
                    {isSel && (
                      <span className="fx-ring absolute inset-[-8px] rounded-full border-2 border-red-400/50" />
                    )}
                  </button>
                )
              })}
            </div>
            {groups.length === 0 && (
              <p className="text-amber-200 text-sm max-w-md mx-auto">
                لا توجد مجالات فيها أسئلة نشطة.
              </p>
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
            {(status === 'answer_reveal' || reveal) && !reveal?.timed_out && status !== 'player_lost' && (
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
                    className="fx-btn mt-3 px-8 py-3 bg-red-600 rounded-xl font-bold hover:bg-red-500 disabled:opacity-50"
                  >
                    التالي
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {status === 'player_lost' && (
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
              <Link
                to="/admin"
                onClick={() => sfx.click()}
                className="fx-btn px-6 py-3 bg-slate-700 rounded-xl font-bold text-center"
              >
                خروج
              </Link>
            </div>
          </div>
        )}

        {status === 'round_complete' && (
          <div className="text-center space-y-5 fx-pop">
            <h2 className="text-4xl font-black text-amber-300 drop-shadow-lg">
              الكاسب {selectedPlayerName || 'اللاعب'} 🏆
            </h2>
            <p className="text-2xl font-bold">النتيجة النهائية: {totalScore}</p>
            <p className="text-sm text-slate-400">تم تسجيل الفوز في قائمة الكاسبين</p>
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
