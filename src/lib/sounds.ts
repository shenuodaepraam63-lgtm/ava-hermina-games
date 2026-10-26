/** Web Audio SFX — no external files. Controlled by enable_sound_effects. */

let ctx: AudioContext | null = null
let enabled = true

function getCtx() {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
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

  groupSelect() {
    tone(520, 0.08, 'sine', 0.07)
    tone(780, 0.12, 'sine', 0.06, 0.07)
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
    ;[523, 659, 784, 1046].forEach((f, i) => tone(f, 0.14, 'sine', 0.09, i * 0.09))
  },

  wrong() {
    tone(280, 0.18, 'sawtooth', 0.07, 0, 160)
    tone(200, 0.22, 'triangle', 0.05, 0.1)
  },

  timeout() {
    tone(360, 0.12, 'triangle', 0.06)
    tone(280, 0.15, 'triangle', 0.05, 0.1)
    tone(220, 0.2, 'sine', 0.04, 0.2)
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
