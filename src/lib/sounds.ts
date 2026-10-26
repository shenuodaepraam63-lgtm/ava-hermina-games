/** Web Audio + Speech Synthesis SFX */

let ctx: AudioContext | null = null
let enabled = true

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
}

export function unlockAudio() {
  const c = getCtx()
  if (c?.state === 'suspended') void c.resume()
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
    // لا تلغِ الكلام الجاري إلا بعد تأخير قصير لو فيه نغمة
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

  /** إجابة صحيحة — نغمة ثم «برافو!» بوضوح */
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

  win() {
    const notes = [523, 659, 784, 1046, 784, 1046, 1319]
    notes.forEach((f, i) => tone(f, 0.18, 'sine', 0.085, i * 0.1))
  },

  transition() {
    tone(300, 0.12, 'sine', 0.04, 0, 600)
  },
}
