/** Web Audio + Speech Synthesis SFX */

let ctx: AudioContext | null = null
let enabled = true
let tensionActive = false
let tensionNodes: AudioNode[] = []

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
  if (!on) stopTensionMusic()
}

export function unlockAudio() {
  const c = getCtx()
  if (c?.state === 'suspended') void c.resume()
}

/** Low-volume original tension bed; generated with Web Audio, no external audio files. */
export function startTensionMusic() {
  if (!enabled || tensionActive) return
  const c = getCtx()
  if (!c) return
  if (c.state === 'suspended') void c.resume()

  try {
    const master = c.createGain()
    master.gain.value = 0.42
    const filter = c.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 240
    master.connect(filter)
    filter.connect(c.destination)

    const droneA = c.createOscillator()
    const droneAGain = c.createGain()
    droneA.type = 'sine'
    droneA.frequency.value = 55
    droneAGain.gain.value = 0.012
    droneA.connect(droneAGain)
    droneAGain.connect(master)

    const droneB = c.createOscillator()
    const droneBGain = c.createGain()
    droneB.type = 'triangle'
    droneB.frequency.value = 82.41
    droneBGain.gain.value = 0.006
    droneB.connect(droneBGain)
    droneBGain.connect(master)

    const pulse = c.createOscillator()
    const pulseGain = c.createGain()
    pulse.type = 'sine'
    pulse.frequency.value = 1.6
    pulseGain.gain.value = 0.003
    pulse.connect(pulseGain)
    pulseGain.connect(droneAGain.gain)

    droneA.start()
    droneB.start()
    pulse.start()
    tensionNodes = [droneA, droneB, pulse, droneAGain, droneBGain, pulseGain, filter, master]
    tensionActive = true
  } catch {
    stopTensionMusic()
  }
}

export function stopTensionMusic() {
  tensionNodes.forEach((node) => {
    try {
      if (node instanceof OscillatorNode) node.stop()
      node.disconnect()
    } catch {
      /* already stopped or disconnected */
    }
  })
  tensionNodes = []
  tensionActive = false
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
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  osc.connect(g)
  g.connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + duration + 0.03)
}

function speak(text: string, lang: string, rate = 0.95) {
  if (!enabled || typeof window === 'undefined' || !window.speechSynthesis) return
  try {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang
    u.rate = rate
    u.pitch = 1.08
    u.volume = 1
    const voices = window.speechSynthesis.getVoices()
    const match =
      voices.find((v) => v.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()) && v.localService) ||
      voices.find((v) => v.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()))
    if (match) u.voice = match
    window.speechSynthesis.speak(u)
  } catch {
    /* ignore */
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

  whoosh() {
    tone(200, 0.25, 'sawtooth', 0.04, 0, 80)
  },

  spinStart() {
    tone(180, 0.15, 'triangle', 0.06, 0, 320)
  },

  spinTick() {
    tone(380 + Math.random() * 120, 0.03, 'square', 0.028)
  },

  spinEnd() {
    tone(440, 0.1, 'triangle', 0.09)
    tone(660, 0.14, 'sine', 0.08, 0.08)
    tone(880, 0.2, 'sine', 0.07, 0.16)
  },

  nameReveal() {
    ;[523, 659, 784, 1046, 1319].forEach((f, i) => tone(f, 0.16, 'sine', 0.1, i * 0.08))
    tone(1568, 0.25, 'triangle', 0.07, 0.42)
  },

  secondTick(n?: number) {
    tone(1000, 0.05, 'square', 0.04)
    if (n != null && n >= 1 && n <= 5) {
      speakDelayed(String(n), 'en-US', 50, 1.15)
    }
  },

  youAreReady() {
    tone(440, 0.12, 'sine', 0.08)
    tone(554, 0.12, 'sine', 0.08, 0.1)
    tone(659, 0.22, 'sine', 0.09, 0.2)
    speakDelayed('You are ready!', 'en-US', 200, 0.92)
  },

  groupSelect() {
    tone(520, 0.1, 'sine', 0.08)
    tone(780, 0.14, 'sine', 0.07, 0.08)
    tone(1040, 0.16, 'triangle', 0.05, 0.16)
  },

  questionAppear() {
    tone(392, 0.1, 'sine', 0.06)
    tone(523, 0.12, 'sine', 0.05, 0.08)
  },

  tick() {
    tone(900, 0.03, 'square', 0.025)
  },

  urgentTick() {
    tone(1100, 0.05, 'square', 0.045)
    tone(900, 0.05, 'square', 0.03, 0.04)
  },

  correct() {
    unlockAudio()
    ;[523, 659, 784, 1046].forEach((f, i) => tone(f, 0.14, 'sine', 0.1, i * 0.09))
    speakDelayed('برافو!', 'ar-SA', 550, 0.9)
  },

  wrong() {
    unlockAudio()
    tone(280, 0.18, 'sawtooth', 0.07, 0, 160)
    tone(200, 0.22, 'triangle', 0.05, 0.1)
    speakDelayed('للأسف خطأ يا عبقرينو', 'ar-SA', 400, 0.9)
  },

  /** خسارة اللاعب — نغمة حزينة */
  playerLost(name?: string) {
    unlockAudio()
    tone(220, 0.35, 'sine', 0.08, 0, 110)
    tone(165, 0.45, 'triangle', 0.07, 0.2, 90)
    tone(130, 0.55, 'sine', 0.06, 0.4)
    const msg = name ? `لقد خسر ${name}` : 'لقد خسرت'
    speakDelayed(msg, 'ar-SA', 500, 0.85)
  },

  timeout() {
    unlockAudio()
    tone(360, 0.12, 'triangle', 0.06)
    tone(280, 0.15, 'triangle', 0.05, 0.1)
    tone(220, 0.2, 'sine', 0.04, 0.2)
    speakDelayed('للأسف انتهى الوقت يا عبقرينو', 'ar-SA', 400, 0.9)
  },

  points() {
    tone(880, 0.08, 'sine', 0.07)
    tone(1175, 0.12, 'sine', 0.06, 0.06)
  },

  win(name?: string) {
    unlockAudio()
    const notes = [523, 659, 784, 1046, 784, 1046, 1319]
    notes.forEach((f, i) => tone(f, 0.18, 'sine', 0.085, i * 0.1))
    const msg = name ? `الكاسب ${name}` : 'مبروك الفوز'
    speakDelayed(msg, 'ar-SA', 800, 0.92)
  },

  transition() {
    tone(300, 0.12, 'sine', 0.04, 0, 600)
  },
}
