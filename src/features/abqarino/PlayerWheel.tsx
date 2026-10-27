import { useEffect, useMemo, useRef, useState } from 'react'
import { sfx } from '../../lib/sounds'

export type WheelPlayer = {
  id: string
  name: string
}

type Props = {
  players: WheelPlayer[]
  selectedRosterId: string | null
  spinning: boolean
  onSpinRequest: () => void
  onLanded?: (playerName: string) => void
  disabled?: boolean
  hideSpinButton?: boolean
}

/** Neon casino palette – vibrant slices with strong contrast */
const NEON_COLORS = [
  '#ff2d55', // hot pink
  '#ff9500', // orange
  '#ffcc00', // yellow
  '#34c759', // green
  '#00c7be', // teal
  '#30b0c7', // cyan
  '#007aff', // blue
  '#5856d6', // indigo
  '#af52de', // purple
  '#ff2d55', // pink again
  '#ff6b35', // coral
  '#ffd60a', // gold
]

export function PlayerWheel({
  players,
  selectedRosterId,
  spinning,
  onSpinRequest,
  onLanded,
  disabled,
  hideSpinButton,
}: Props) {
  const [rotation, setRotation] = useState(0)
  const [animating, setAnimating] = useState(false)
  const [landed, setLanded] = useState(false)
  const [intensity, setIntensity] = useState(0) // 0 → 1, ramps up in final seconds
  const tickRef = useRef<number | null>(null)
  const landTimerRef = useRef<number | null>(null)
  const intensityTimerRef = useRef<number | null>(null)
  const wasSpinning = useRef(false)
  const angleRef = useRef(0)
  const landedNotified = useRef(false)
  const onLandedRef = useRef(onLanded)
  onLandedRef.current = onLanded

  const n = Math.max(players.length, 1)
  const slice = 360 / n

  const selectedIndex = useMemo(() => {
    if (!selectedRosterId) return -1
    return players.findIndex((p) => p.id === selectedRosterId)
  }, [players, selectedRosterId])

  function notifyLanded(name: string) {
    if (landedNotified.current) return
    landedNotified.current = true
    setLanded(true)
    setAnimating(false)
    setIntensity(1)
    sfx.spinEnd()
    onLandedRef.current?.(name)
  }

  function finishToIndex(idx: number) {
    if (tickRef.current) {
      window.clearInterval(tickRef.current)
      tickRef.current = null
    }
    if (intensityTimerRef.current) {
      window.clearInterval(intensityTimerRef.current)
      intensityTimerRef.current = null
    }

    const targetSliceCenter = Math.max(0, idx) * slice + slice / 2
    const extraTurns = 5 + Math.floor(Math.random() * 2)
    const finalRotation =
      angleRef.current +
      extraTurns * 360 +
      ((360 - targetSliceCenter - (angleRef.current % 360) + 360) % 360)
    angleRef.current = finalRotation
    setRotation(finalRotation)
    setAnimating(true)

    // Ramp intensity during the 3.2s deceleration
    let step = 0
    intensityTimerRef.current = window.setInterval(() => {
      step += 1
      // accelerate glow in the last ~1.2s
      const t = Math.min(1, step / 32)
      const eased = t < 0.55 ? t * 0.6 : 0.33 + (t - 0.55) * 1.5
      setIntensity(Math.min(1, eased))
    }, 100)

    if (landTimerRef.current) window.clearTimeout(landTimerRef.current)
    landTimerRef.current = window.setTimeout(() => {
      if (intensityTimerRef.current) {
        window.clearInterval(intensityTimerRef.current)
        intensityTimerRef.current = null
      }
      const name = players[idx]?.name || players[0]?.name || ''
      notifyLanded(name)
    }, 3200)
  }

  // Start continuous spin
  useEffect(() => {
    if (spinning && !wasSpinning.current) {
      setAnimating(true)
      setLanded(false)
      setIntensity(0.35)
      landedNotified.current = false
      sfx.spinStart()
      if (tickRef.current) window.clearInterval(tickRef.current)
      if (intensityTimerRef.current) window.clearInterval(intensityTimerRef.current)

      let tickCount = 0
      tickRef.current = window.setInterval(() => {
        tickCount += 1
        // slightly accelerate over time
        const boost = Math.min(12, Math.floor(tickCount / 25))
        angleRef.current += 32 + boost
        setRotation(angleRef.current)
        sfx.spinTick()
        // gentle intensity while free-spinning
        setIntensity(0.3 + Math.min(0.25, tickCount / 120))
      }, 38)
    }

    // Spin ended → decelerate to selected
    if (!spinning && wasSpinning.current && !landedNotified.current) {
      const idx = selectedIndex >= 0 ? selectedIndex : 0
      finishToIndex(idx)
    }

    wasSpinning.current = spinning
  }, [spinning, selectedIndex, slice, players])

  useEffect(() => {
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current)
      if (landTimerRef.current) window.clearTimeout(landTimerRef.current)
      if (intensityTimerRef.current) window.clearInterval(intensityTimerRef.current)
    }
  }, [])

  const gradient = useMemo(() => {
    if (players.length === 0) return '#1e293b'
    const parts = players.map((_, i) => {
      const c = NEON_COLORS[i % NEON_COLORS.length]
      const a = (i * slice).toFixed(2)
      const b = ((i + 1) * slice).toFixed(2)
      return `${c} ${a}deg ${b}deg`
    })
    return `conic-gradient(from -90deg, ${parts.join(', ')})`
  }, [players, slice])

  const busy = spinning || animating
  const selectedName = players.find((p) => p.id === selectedRosterId)?.name

  // Dynamic glow based on intensity (0–1)
  const outerGlow = `0 0 ${28 + intensity * 55}px rgba(0, 255, 255, ${0.35 + intensity * 0.45}),
                     0 0 ${50 + intensity * 80}px rgba(255, 60, 0, ${0.25 + intensity * 0.4}),
                     0 0 ${90 + intensity * 40}px rgba(255, 140, 0, ${0.15 + intensity * 0.25})`

  const rimBorder =
    intensity > 0.7
      ? 'border-cyan-300'
      : intensity > 0.4
        ? 'border-cyan-400'
        : 'border-cyan-500/80'

  return (
    <div className="flex flex-col items-center gap-5 sm:gap-6 fx-enter w-full max-w-[min(92vw,520px)]">
      {/* Wheel stage – optimized for landscape / Smart View */}
      <div
        className={`relative aspect-square w-full max-w-[min(78vw,420px)] mx-auto ${
          busy ? 'fx-neon-wheel-pulse' : ''
        } ${landed ? 'fx-neon-land' : ''}`}
        style={{
          filter: landed
            ? 'brightness(1.25) saturate(1.35)'
            : intensity > 0.65
              ? `brightness(${1 + intensity * 0.18}) saturate(${1 + intensity * 0.25})`
              : undefined,
        }}
      >
        {/* Outer cyan neon ring */}
        <div
          className="absolute -inset-[6px] rounded-full pointer-events-none"
          style={{
            background:
              'conic-gradient(from 0deg, #00f0ff, #ff00aa, #ffcc00, #00ff88, #00f0ff)',
            opacity: 0.55 + intensity * 0.35,
            filter: `blur(${2 + intensity * 3}px)`,
            animation: busy ? 'fx-neon-rotate 4s linear infinite' : undefined,
          }}
        />
        <div
          className={`absolute -inset-[3px] rounded-full border-[3px] ${rimBorder} pointer-events-none`}
          style={{
            boxShadow: outerGlow,
            transition: 'box-shadow 0.15s linear, border-color 0.2s',
          }}
        />

        {/* Pointer at bottom (golden cone like the image) */}
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 z-30 drop-shadow-[0_0_12px_rgba(255,180,0,0.9)]">
          <div
            className="w-0 h-0 border-l-[16px] border-r-[16px] border-b-[28px] border-l-transparent border-r-transparent border-b-amber-400"
            style={{
              filter: intensity > 0.6 ? 'drop-shadow(0 0 10px #ffaa00)' : undefined,
            }}
          />
          {/* small stem */}
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-3 h-4 bg-gradient-to-b from-amber-400 to-amber-600 rounded-b-sm" />
        </div>

        {/* Main spinning disc */}
        <div
          className={`absolute inset-0 rounded-full overflow-hidden border-[5px] border-slate-900/80 ${
            landed ? 'fx-pop' : ''
          }`}
          style={{
            background: gradient,
            transform: `rotate(${rotation}deg)`,
            transition:
              animating && !spinning
                ? 'transform 3.2s cubic-bezier(0.05, 0.75, 0.08, 1)'
                : undefined,
            boxShadow: `
              inset 0 0 40px rgba(0,0,0,0.45),
              0 0 ${20 + intensity * 40}px rgba(255,80,0,${0.2 + intensity * 0.35})
            `,
          }}
        >
          {/* Segment dividers (thin neon lines) */}
          {players.map((_, i) => {
            const a = i * slice
            return (
              <div
                key={`div-${i}`}
                className="absolute left-1/2 top-1/2 w-[50%] h-[2px] origin-left pointer-events-none"
                style={{
                  transform: `rotate(${a - 90}deg)`,
                  background:
                    'linear-gradient(90deg, transparent 8%, rgba(255,255,255,0.55) 35%, rgba(255,255,255,0.9) 100%)',
                  boxShadow: '0 0 6px rgba(255,255,255,0.5)',
                }}
              />
            )
          })}

          {/* Player names */}
          {players.map((p, i) => {
            const angle = -90 + i * slice + slice / 2
            const maxLen = n > 10 ? 8 : n > 7 ? 10 : 12
            const label =
              p.name.length > maxLen ? p.name.slice(0, maxLen - 1) + '…' : p.name
            return (
              <div
                key={p.id}
                className="absolute left-1/2 top-1/2 origin-left text-white font-black whitespace-nowrap pointer-events-none"
                style={{
                  transform: `rotate(${angle}deg) translate(${n > 8 ? 42 : 48}px, -50%)`,
                  width: n > 10 ? '32%' : '38%',
                  fontSize: n > 12 ? '9px' : n > 8 ? '11px' : '13px',
                  textShadow:
                    '0 0 6px rgba(0,0,0,0.9), 0 1px 3px rgba(0,0,0,0.9), 0 0 12px rgba(255,255,255,0.25)',
                  letterSpacing: '0.02em',
                }}
              >
                {label}
              </div>
            )
          })}

          {/* Center hub – glowing core */}
          <div
            className="absolute inset-[32%] rounded-full flex items-center justify-center"
            style={{
              background:
                'radial-gradient(circle at 35% 30%, #fff7e6 0%, #ffb347 25%, #ff6b00 55%, #1a0a00 100%)',
              boxShadow: `
                0 0 ${18 + intensity * 30}px rgba(255,140,0,${0.55 + intensity * 0.4}),
                inset 0 0 18px rgba(0,0,0,0.35),
                0 0 0 3px rgba(255,200,80,0.7)
              `,
              border: '2px solid rgba(255,220,150,0.85)',
            }}
          >
            <span
              className="font-black tracking-widest text-amber-100"
              style={{
                fontSize: n > 10 ? '11px' : '14px',
                textShadow: '0 0 10px rgba(255,200,50,0.9)',
              }}
            >
              AH
            </span>
          </div>
        </div>

        {/* Subtle inner light ring */}
        <div
          className="absolute inset-[8%] rounded-full pointer-events-none border border-white/10"
          style={{
            boxShadow: intensity > 0.5 ? `inset 0 0 30px rgba(0,255,255,${intensity * 0.2})` : undefined,
          }}
        />
      </div>

      {/* Winner name reveal */}
      {selectedName && !busy && landed && (
        <div className="text-center fx-neon-name-reveal">
          <p
            className="text-4xl sm:text-5xl font-black tracking-wide"
            style={{
              color: '#fff',
              textShadow: `
                0 0 12px #ff6b00,
                0 0 28px #ff2d55,
                0 0 48px #00f0ff,
                0 2px 4px rgba(0,0,0,0.8)
              `,
            }}
          >
            {selectedName}
          </p>
          <p className="mt-1 text-sm text-cyan-300/90 font-medium tracking-wider">
            ✨ اللاعب المختار
          </p>
        </div>
      )}

      {!hideSpinButton && (
        <button
          type="button"
          onClick={() => {
            sfx.unlock()
            sfx.uiTap()
            onSpinRequest()
          }}
          disabled={disabled || busy || players.length === 0}
          className="fx-btn relative px-14 py-4 rounded-2xl text-xl font-black disabled:opacity-50 overflow-hidden"
          style={{
            background: busy
              ? 'linear-gradient(135deg, #7f1d1d, #991b1b)'
              : 'linear-gradient(135deg, #dc2626, #f97316, #eab308)',
            boxShadow: busy
              ? '0 0 20px rgba(220,38,38,0.4)'
              : '0 0 28px rgba(249,115,22,0.55), 0 4px 20px rgba(0,0,0,0.35)',
            color: '#fff',
            textShadow: '0 1px 3px rgba(0,0,0,0.5)',
          }}
        >
          {busy ? 'تدور… 🔥' : 'لف العجلة 🔥'}
        </button>
      )}
    </div>
  )
}
