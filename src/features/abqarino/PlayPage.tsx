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
  /** يخلي شاشة الإجابة تظهر قبل الانتقال لشاشة الخسارة */
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

  const LOSS_REVEAL_MS = 6000 // 6 ثواني عرض الإجابة قبل شاشة الخسارة

  const reload = useCallback(async () => {
    if (!sessionId) return
    const full = await getFullSession(sessionId)
    setData(full)
    return full
  }, [sessionId])
