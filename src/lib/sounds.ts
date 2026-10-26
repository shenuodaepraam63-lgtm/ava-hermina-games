/**
 * Lightweight Web Audio SFX — no external files required.
 * Honors enable_sound_effects from settings_snapshot.
 */

let ctx: AudioContext | null = null
let enabled = true

function getCtx() {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  return ctx
}

export function setSoundEnabled(on: boolean) {
  enabled = on
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  gain = 0.08,
  when = 0
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
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  osc.connect(g)
  g.connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + duration + 0.02)
}

export const sfx = {
  spinTick() {
    tone(420 + Math.random() * 80, 0.04, 'square', 0.04)
  },
  spinEnd() {
    tone(520, 0.12, 'triangle', 0.1)
    tone(780, 0.18, 'sine', 0.08, 0.08)
  },
  correct() {
    tone(523, 0.12, 'sine', 0.1)
    tone(659, 0.14, 'sine', 0.09, 0.1)
    tone(784, 0.2, 'sine', 0.08, 0.2)
  },
  wrong() {
    tone(220, 0.2, 'sawtooth', 0.07)
    tone(180, 0.25, 'sawtooth', 0.05, 0.12)
  },
  timeout() {
    tone(300, 0.15, 'triangle', 0.06)
    tone(250, 0.2, 'triangle', 0.05, 0.12)
  },
  click() {
    tone(600, 0.05, 'square', 0.03)
  },
  win() {
    ;[523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'sine', 0.09, i * 0.12))
  },
}
