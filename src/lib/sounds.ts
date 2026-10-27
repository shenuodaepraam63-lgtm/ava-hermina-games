/** Web Audio SFX engine for عبقرينو — synthesized, no external files required.
 *  Supports mute, master volume. Continuous pulse beds disabled.
 *  Priority effects: spin start/ticks/stop, question, last-10 ticks, correct, wrong, win.
 */

let ctx: AudioContext | null = null
let enabled = true
let masterVolume = 0.85

let tensionActive = false
let tensionNodes: AudioNode[] = []
let spinMusicActive = false
let spinMusicNodes: AudioNode[] = []
let winMusicNodes: AudioNode[] = []

function getCtx() {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  return ctx
}

export function setSoundEnabled(on: boolean) {
  enabled = on
  if (!on) stopAllMusic()
}

export function setMasterVolume(v: number) {
  masterVolume = Math.max(0, Math.min(1, v))
}

export function unlockAudio() {
  const c = getCtx()
  if (c?.state === 'suspended') void c.resume()
}

function stopNodes(nodes: AudioNode[], fadeMs = 0) {
  const c = getCtx()
  nodes.forEach((node) => {
    try {
      if (fadeMs > 0 && node instanceof GainNode && c) {
        node.gain.cancelScheduledValues(c.currentTime)
        node.gain.setValueAtTime(Math.max(0.0001, node.gain.value), c.currentTime)
        node.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + fadeMs / 1000)
      }
    } catch {
      /* */
    }
  })
  const kill = () => {
    nodes.forEach((node) => {
      try {
        if (node instanceof OscillatorNode) node.stop()
        node.disconnect()
      } catch {
        /* */
      }
    })
  }
  if (fadeMs > 0) window.setTimeout(kill, fadeMs + 40)
  else kill()
}

export function stopTensionMusic() {
  stopNodes(tensionNodes, 280)
  tensionNodes = []
  tensionActive = false
}

export function stopSpinMusic() {
  stopNodes(spinMusicNodes, 350)
  spinMusicNodes = []
  spinMusicActive = false
}

export function stopWinMusic() {
  stopNodes(winMusicNodes, 200)
  winMusicNodes = []
}

export function stopAllMusic() {
  stopTensionMusic()
  stopSpinMusic()
  stopWinMusic()
}

/** Tension bed disabled — was the continuous «دف دف دف» pulse. */
export function startTensionMusic() {
  // ملغية بناءً على طلب المستخدم (صوت القطر / دف دف دف)
  stopTensionMusic()
}

/** Escalate tension — no-op while bed is disabled. */
export function setTensionIntensity(_t: number) {
  /* disabled */
}

/** Spin bed disabled — continuous pulse removed. One-shot spin SFX remain. */
export function startSpinMusic() {
  // ملغية — بدون موسيقى خلفية مستمرة أثناء اللف
  stopSpinMusic()
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  gain = 0.08,
  when = 0,
  slideTo?: number
) {
  if (!enabled) return
  const c = getCtx()
  if (!c) return
  if (c.state === 'suspended') void c.resume()

  const t0 = c.currentTime + when
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (slideTo != null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + duration)
  }
  const vol = gain * masterVolume
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  osc.connect(g)
  g.connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + duration + 0.03)
}

/** Metallic tick — rate/pitch can follow wheel speed (0..1). */
function metalTick(intensity = 0.5) {
  const f = 280 + intensity * 220 + Math.random() * 60
  tone(f, 0.028 + intensity * 0.02, 'square', 0.018 + intensity * 0.012)
  tone(f * 1.5, 0.02, 'triangle', 0.01, 0.008)
}

function speak(text: string, lang: string, rate = 0.95) {
  if (!enabled || typeof window === 'undefined' || !window.speechSynthesis) return
  try {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang
    u.rate = rate
    u.pitch = 1.08
    u.volume = masterVolume
    const voices = window.speechSynthesis.getVoices()
    const match =
      voices.find((v) => v.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()) && v.localService) ||
      voices.find((v) => v.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()))
    if (match) u.voice = match
    window.speechSynthesis.speak(u)
  } catch {
    /* */
  }
}

function speakDelayed(text: string, lang: string, delayMs: number, rate = 0.95) {
  window.setTimeout(() => {
    if (!enabled) return
    try {
      window.speechSynthesis?.cancel()
    } catch {
      /* */
    }
    speak(text, lang, rate)
  }, delayMs)
}

export function warmSpeech() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.getVoices()
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices()
  }
}

export const sfx = {
  unlock: unlockAudio,

  uiTap() {
    tone(720, 0.04, 'triangle', 0.035)
  },

  click() {
    tone(880, 0.035, 'square', 0.03)
    tone(440, 0.05, 'sine', 0.02, 0.02)
  },

  deny() {
    tone(240, 0.1, 'triangle', 0.04)
    tone(180, 0.12, 'sine', 0.03, 0.08)
  },

  cancel() {
    tone(400, 0.06, 'sine', 0.035, 0, 220)
  },

  whoosh() {
    tone(220, 0.22, 'sawtooth', 0.04, 0, 70)
  },

  spinStart() {
    unlockAudio()
    startSpinMusic()
    tone(90, 0.35, 'sawtooth', 0.06, 0, 320)
    tone(140, 0.4, 'triangle', 0.05, 0.05, 480)
    tone(200, 0.3, 'sine', 0.04, 0.12, 600)
  },

  spinTick(intensity = 0.7) {
    metalTick(intensity)
  },

  spinTickSlow() {
    metalTick(0.35)
    tone(160, 0.05, 'sine', 0.012, 0.02)
  },

  spinEnd() {
    stopSpinMusic()
    tone(180, 0.08, 'square', 0.1)
    tone(320, 0.12, 'triangle', 0.09, 0.04)
    tone(520, 0.35, 'sine', 0.07, 0.08)
    tone(780, 0.45, 'sine', 0.045, 0.12)
    tone(1040, 0.5, 'triangle', 0.03, 0.18)
  },

  nameReveal() {
    ;[392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.14, 'sine', 0.09, i * 0.07))
    tone(1319, 0.28, 'triangle', 0.06, 0.38)
  },

  prepMusic() {
    tone(220, 0.2, 'sine', 0.04)
    tone(330, 0.25, 'triangle', 0.035, 0.15)
    tone(440, 0.3, 'sine', 0.03, 0.3)
  },

  questionAppear() {
    tone(330, 0.08, 'sine', 0.05, 0, 520)
    tone(523, 0.1, 'triangle', 0.045, 0.06)
  },

  countdownStart() {
    tone(660, 0.1, 'sine', 0.05)
    tone(880, 0.12, 'triangle', 0.04, 0.08)
  },

  tick() {
    tone(900, 0.03, 'square', 0.022)
  },

  urgentTick() {
    tone(1150, 0.05, 'square', 0.04)
    tone(900, 0.045, 'square', 0.028, 0.04)
  },

  secondTick(n?: number) {
    tone(1000, 0.05, 'square', 0.035)
    if (n != null && n >= 1 && n <= 5) {
      speakDelayed(String(n), 'en-US', 40, 1.15)
    }
  },

  timeout() {
    unlockAudio()
    stopTensionMusic()
    tone(880, 0.1, 'square', 0.07)
    tone(660, 0.12, 'square', 0.06, 0.1)
    tone(440, 0.18, 'triangle', 0.05, 0.2)
    tone(330, 0.25, 'sine', 0.04, 0.32)
  },

  correct() {
    unlockAudio()
    stopTensionMusic()
    ;[523, 659, 784, 1046].forEach((f, i) => tone(f, 0.13, 'sine', 0.095, i * 0.08))
    speakDelayed('برافو!', 'ar-SA', 480, 0.9)
  },

  correctHard() {
    unlockAudio()
    stopTensionMusic()
    ;[392, 523, 659, 784, 988, 1175].forEach((f, i) => tone(f, 0.12, 'sine', 0.09, i * 0.07))
    tone(1319, 0.28, 'triangle', 0.06, 0.45)
  },

  streak(level = 1) {
    const n = Math.min(5, Math.max(1, level))
    for (let i = 0; i < n + 2; i++) {
      tone(523 + i * 90, 0.1, 'sine', 0.06, i * 0.06)
    }
  },

  wrong() {
    unlockAudio()
    stopTensionMusic()
    tone(300, 0.16, 'sawtooth', 0.06, 0, 140)
    tone(200, 0.2, 'triangle', 0.045, 0.08)
  },

  points() {
    tone(880, 0.07, 'sine', 0.065)
    tone(1175, 0.11, 'sine', 0.055, 0.05)
    tone(1568, 0.1, 'triangle', 0.03, 0.1)
  },

  revealAnswer() {
    tone(660, 0.12, 'sine', 0.04)
    tone(880, 0.18, 'triangle', 0.03, 0.1)
  },

  nearWin() {
    ;[659, 784, 988, 1175].forEach((f, i) => tone(f, 0.12, 'sine', 0.07, i * 0.09))
  },

  win(name?: string) {
    unlockAudio()
    stopTensionMusic()
    stopSpinMusic()
    const c = getCtx()
    if (!c) return

    const notes = [523, 659, 784, 1046, 784, 1046, 1319, 1568, 1319, 1046]
    notes.forEach((f, i) => tone(f, 0.22, 'sine', 0.08, i * 0.12))
    tone(2093, 0.5, 'triangle', 0.05, 1.3)
    try {
      const pad = c.createOscillator()
      const g = c.createGain()
      pad.type = 'sine'
      pad.frequency.value = 130.8
      g.gain.value = 0.0001
      g.gain.exponentialRampToValueAtTime(0.04 * masterVolume, c.currentTime + 0.2)
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 4.5)
      pad.connect(g)
      g.connect(c.destination)
      pad.start()
      pad.stop(c.currentTime + 4.6)
      winMusicNodes = [pad, g]
    } catch {
      /* */
    }
    const msg = name ? `الكاسب ${name}` : 'مبروك الفوز'
    speakDelayed(msg, 'ar-SA', 900, 0.92)
  },

  playerLost(name?: string) {
    unlockAudio()
    stopTensionMusic()
    tone(220, 0.35, 'sine', 0.07, 0, 110)
    tone(165, 0.45, 'triangle', 0.06, 0.2, 90)
    tone(130, 0.55, 'sine', 0.05, 0.4)
    const msg = name ? `لقد خسر ${name}` : 'لقد خسرت'
    speakDelayed(msg, 'ar-SA', 500, 0.85)
  },

  transition() {
    tone(300, 0.12, 'sine', 0.04, 0, 600)
  },

  groupSelect() {
    tone(520, 0.1, 'sine', 0.07)
    tone(780, 0.14, 'sine', 0.06, 0.08)
    tone(1040, 0.16, 'triangle', 0.045, 0.16)
  },

  youAreReady() {
    tone(440, 0.12, 'sine', 0.07)
    tone(554, 0.12, 'sine', 0.07, 0.1)
    tone(659, 0.22, 'sine', 0.08, 0.2)
    speakDelayed('You are ready!', 'en-US', 200, 0.92)
  },

  optionReveal(index = 0) {
    tone(400 + index * 60, 0.06, 'sine', 0.03)
  },

  crowd() {
    for (let i = 0; i < 6; i++) {
      tone(200 + Math.random() * 400, 0.15, 'sawtooth', 0.012, i * 0.03)
    }
  },

  suspense() {
    tone(150, 0.4, 'sine', 0.05, 0, 300)
    tone(180, 0.35, 'triangle', 0.04, 0.15, 400)
  },

  roundStart() {
    tone(523, 0.1, 'sine', 0.06)
    tone(659, 0.12, 'sine', 0.05, 0.1)
    tone(784, 0.15, 'triangle', 0.04, 0.2)
  },
}
