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

const NEON_COLORS = [
  '#ff2d55',
  '#ff9500',
  '#ffcc00',
  '#34c759',
  '#00c7be',
  '#30b0c7',
  '#007aff',
  '#5856d6',
  '#af52de',
  '#ff2d55',
  '#ff6b35',
  '#ffd60a',
]

/** Simple audience silhouette positions for cinematic row */
const AUDIENCE = [
  { x: 6, scale: 0.85, delay: 0 },
  { x: 14, scale: 0.95, delay: 0.1 },
  { x: 22, scale: 1.05, delay: 0.05 },
  { x: 30, scale: 0.9, delay: 0.15 },
  { x: 38, scale: 1.1, delay: 0.08 },
  { x: 46, scale: 0.95, delay: 0.12 },
  { x: 54, scale: 1.0, delay: 0.03 },
  { x: 62, scale: 1.08, delay: 0.18 },
  { x: 70, scale: 0.92, delay: 0.07 },
  { x: 78, scale: 1.0, delay: 0.14 },
  { x: 86, scale: 0.88, delay: 0.09 },
  { x: 94, scale: 0.98, delay: 0.11 },
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
  const [intensity, setIntensity] = useState(0)
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

    let step = 0
    intensityTimerRef.current = window.setInterval(() => {
      step += 1
      const t = Math.min(1, step / 32)
      const eased = t < 0.5 ? t * 0.55 : 0.275 + Math.pow((t - 0.5) * 2, 1.4) * 0.75
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

  useEffect(() => {
    if (spinning && !wasSpinning.current) {
      setAnimating(true)
      setLanded(false)
      setIntensity(0.4)
      landedNotified.current = false
      sfx.spinStart()
      if (tickRef.current) window.clearInterval(tickRef.current)
      if (intensityTimerRef.current) window.clearInterval(intensityTimerRef.current)

      let tickCount = 0
      tickRef.current = window.setInterval(() => {
        tickCount += 1
        const boost = Math.min(14, Math.floor(tickCount / 20))
        angleRef.current += 34 + boost
        setRotation(angleRef.current)
        sfx.spinTick()
        setIntensity(0.35 + Math.min(0.35, tickCount / 90))
      }, 36)
    }

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
  const shakeClass =
    intensity > 0.85
      ? 'fx-portal-quake'
      : intensity > 0.55
        ? 'fx-portal-tremble'
        : busy
          ? 'fx-portal-hum'
          : ''

  const outerGlow = `0 0 ${30 + intensity * 70}px rgba(0, 255, 255, ${0.4 + intensity * 0.5}),
                     0 0 ${55 + intensity * 90}px rgba(255, 40, 0, ${0.3 + intensity * 0.45}),
                     0 0 ${100 + intensity * 50}px rgba(255, 120, 0, ${0.2 + intensity * 0.3})`

  return (
    <div
      className={`relative flex flex-col items-center w-full max-w-[min(96vw,640px)] mx-auto fx-enter ${shakeClass}`}
    >
      <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] max-h-[min(72vh,520px)] overflow-hidden rounded-2xl">
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 70% 55% at 50% 42%, rgba(0,40,80,0.5) 0%, transparent 70%),
              radial-gradient(ellipse 90% 70% at 50% 100%, rgba(20,0,40,0.8) 0%, transparent 55%),
              linear-gradient(180deg, #020617 0%, #0a1628 40%, #1a0a20 100%)
            `,
          }}
        />

        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[70%] h-[28%] pointer-events-none"
          style={{
            background: `linear-gradient(to top, rgba(0,255,255,${0.08 + intensity * 0.12}), transparent)`,
            clipPath: 'polygon(15% 100%, 85% 100%, 100% 0%, 0% 0%)',
            boxShadow: intensity > 0.5 ? `0 0 40px rgba(0,255,255,${intensity * 0.2})` : undefined,
          }}
        />
        <div
          className="absolute bottom-0 left-[18%] w-[2px] h-[26%] origin-bottom pointer-events-none"
          style={{
            background: `linear-gradient(to top, rgba(0,255,255,${0.35 + intensity * 0.4}), transparent)`,
            transform: 'skewX(-12deg)',
          }}
        />
        <div
          className="absolute bottom-0 right-[18%] w-[2px] h-[26%] origin-bottom pointer-events-none"
          style={{
            background: `linear-gradient(to top, rgba(0,255,255,${0.35 + intensity * 0.4}), transparent)`,
            transform: 'skewX(12deg)',
          }}
        />

        {[8, 18, 82, 92].map((left, i) => (
          <div
            key={i}
            className="absolute top-[12%] bottom-[22%] w-[3px] rounded-full pointer-events-none"
            style={{
              left: `${left}%`,
              background:
                i % 2 === 0
                  ? `linear-gradient(180deg, transparent, #00f0ff, #ff00aa, transparent)`
                  : `linear-gradient(180deg, transparent, #ff9500, #ff2d55, transparent)`,
              opacity: 0.35 + intensity * 0.4,
              boxShadow: `0 0 ${8 + intensity * 16}px ${i % 2 === 0 ? '#00f0ff' : '#ff6b00'}`,
              animation: busy ? `fx-neon-flicker ${1.2 + i * 0.2}s ease-in-out infinite` : undefined,
            }}
          />
        ))}

        {busy && (
          <>
            <div
              className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
              style={{
                width: '58%',
                paddingBottom: '58%',
                border: `2px solid rgba(0,255,255,${0.25 + intensity * 0.35})`,
                boxShadow: `0 0 ${20 + intensity * 40}px rgba(0,255,255,0.3), inset 0 0 30px rgba(255,0,150,0.15)`,
                animation: 'fx-portal-ring 2.4s linear infinite',
              }}
            />
            <div
              className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
              style={{
                width: '72%',
                paddingBottom: '72%',
                border: `1px solid rgba(255,80,0,${0.2 + intensity * 0.3})`,
                animation: 'fx-portal-ring 3.2s linear infinite reverse',
              }}
            />
          </>
        )}

        <div
          className={`absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 aspect-square w-[min(58%,280px)] sm:w-[min(52%,320px)] ${
            landed ? 'fx-neon-land' : ''
          }`}
          style={{
            filter: landed
              ? 'brightness(1.3) saturate(1.4)'
              : intensity > 0.6
                ? `brightness(${1 + intensity * 0.22}) saturate(${1 + intensity * 0.3})`
                : undefined,
            zIndex: 10,
          }}
        >
          <div
            className="absolute -inset-[8px] rounded-full pointer-events-none"
            style={{
              background:
                'conic-gradient(from 0deg, #00f0ff, #ff00aa, #ffcc00, #00ff88, #00f0ff)',
              opacity: 0.5 + intensity * 0.4,
              filter: `blur(${3 + intensity * 4}px)`,
              animation: busy ? 'fx-neon-rotate 3.5s linear infinite' : undefined,
            }}
          />
          <div
            className="absolute -inset-[2px] rounded-full border-[3px] pointer-events-none"
            style={{
              borderColor:
                intensity > 0.75 ? '#a5f3fc' : intensity > 0.4 ? '#22d3ee' : '#06b6d4',
              boxShadow: outerGlow,
              transition: 'box-shadow 0.12s linear, border-color 0.15s',
            }}
          />

          <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 z-30">
            <div
              className="w-0 h-0 border-l-[14px] border-r-[14px] border-b-[26px] border-l-transparent border-r-transparent border-b-amber-400"
              style={{
                filter: `drop-shadow(0 0 ${8 + intensity * 12}px #ffaa00)`,
              }}
            />
            <div className="absolute left-1/2 -translate-x-1/2 top-full w-2.5 h-3.5 bg-gradient-to-b from-amber-400 to-amber-700 rounded-b-sm" />
          </div>

          <div
            className="absolute inset-0 rounded-full overflow-hidden border-[4px] border-black/60"
            style={{
              background: gradient,
              transform: `rotate(${rotation}deg)`,
              transition:
                animating && !spinning
                  ? 'transform 3.2s cubic-bezier(0.05, 0.75, 0.08, 1)'
                  : undefined,
              boxShadow: `
                inset 0 0 35px rgba(0,0,0,0.5),
                0 0 ${18 + intensity * 45}px rgba(255,60,0,${0.25 + intensity * 0.4})
              `,
            }}
          >
            {players.map((_, i) => {
              const a = i * slice
              return (
                <div
                  key={`d-${i}`}
                  className="absolute left-1/2 top-1/2 w-[50%] h-[1.5px] origin-left pointer-events-none"
                  style={{
                    transform: `rotate(${a - 90}deg)`,
                    background:
                      'linear-gradient(90deg, transparent 10%, rgba(255,255,255,0.5) 40%, rgba(255,255,255,0.95) 100%)',
                    boxShadow: '0 0 5px rgba(255,255,255,0.45)',
                  }}
                />
              )
            })}

            {players.map((p, i) => {
              const angle = -90 + i * slice + slice / 2
              const maxLen = n > 10 ? 7 : n > 7 ? 9 : 11
              const label =
                p.name.length > maxLen ? p.name.slice(0, maxLen - 1) + '…' : p.name
              return (
                <div
                  key={p.id}
                  className="absolute left-1/2 top-1/2 origin-left text-white font-black whitespace-nowrap pointer-events-none"
                  style={{
                    transform: `rotate(${angle}deg) translate(${n > 8 ? 38 : 44}px, -50%)`,
                    width: n > 10 ? '30%' : '36%',
                    fontSize: n > 12 ? '8px' : n > 8 ? '10px' : '12px',
                    textShadow:
                      '0 0 5px rgba(0,0,0,0.95), 0 1px 2px rgba(0,0,0,0.9), 0 0 10px rgba(255,255,255,0.2)',
                  }}
                >
                  {label}
                </div>
              )
            })}

            <div
              className="absolute inset-[30%] rounded-full flex items-center justify-center"
              style={{
                background:
                  'radial-gradient(circle at 35% 30%, #fff8e7 0%, #ffb347 22%, #ff5e00 55%, #1a0500 100%)',
                boxShadow: `
                  0 0 ${16 + intensity * 28}px rgba(255,120,0,${0.6 + intensity * 0.35}),
                  inset 0 0 14px rgba(0,0,0,0.4),
                  0 0 0 2px rgba(255,200,80,0.75)
                `,
                border: '2px solid rgba(255,220,140,0.9)',
              }}
            >
              <span
                className="font-black tracking-widest text-amber-50"
                style={{
                  fontSize: n > 10 ? '10px' : '13px',
                  textShadow: '0 0 10px rgba(255,180,40,0.95)',
                }}
              >
                AH
              </span>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-[26%] pointer-events-none overflow-hidden">
          <div
            className="absolute bottom-[42%] left-[8%] right-[8%] h-[2px] rounded-full"
            style={{
              background: `linear-gradient(90deg, transparent, rgba(0,200,255,${0.25 + intensity * 0.35}), transparent)`,
              boxShadow: intensity > 0.5 ? `0 0 12px rgba(0,255,255,0.3)` : undefined,
            }}
          />
          {AUDIENCE.map((a, i) => (
            <div
              key={i}
              className={`absolute bottom-0 ${
                intensity > 0.7 ? 'fx-audience-panic' : busy ? 'fx-audience-sway' : ''
              }`}
              style={{
                left: `${a.x}%`,
                transform: `translateX(-50%) scale(${a.scale})`,
                animationDelay: `${a.delay}s`,
                width: 28,
                height: 52,
              }}
            >
              <div
                className="absolute left-1/2 -translate-x-1/2 top-0 w-[14px] h-[14px] rounded-full"
                style={{
                  background: '#0f172a',
                  boxShadow:
                    intensity > 0.6
                      ? `0 0 8px rgba(255,100,50,${0.3 + intensity * 0.3})`
                      : '0 0 4px rgba(0,0,0,0.5)',
                }}
              />
              <div
                className="absolute left-1/2 -translate-x-1/2 top-[12px] w-[20px] h-[28px] rounded-t-[10px]"
                style={{
                  background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
                }}
              />
              <div
                className="absolute left-1/2 -translate-x-1/2 bottom-0 w-[26px] h-[12px] rounded-t-md"
                style={{
                  background: 'linear-gradient(180deg, #1e293b, #020617)',
                  boxShadow: '0 0 6px rgba(0,100,150,0.25)',
                }}
              />
            </div>
          ))}
        </div>

        <div
          className="absolute inset-0 pointer-events-none rounded-2xl"
          style={{
            background: `
              radial-gradient(ellipse 80% 70% at 50% 40%, transparent 40%, rgba(0,0,0,0.45) 100%)
            `,
            boxShadow:
              intensity > 0.7
                ? `inset 0 0 ${40 + intensity * 30}px rgba(255,40,0,${0.15 + intensity * 0.15})`
                : undefined,
          }}
        />
      </div>

      {selectedName && !busy && landed && (
        <div className="text-center mt-4 fx-neon-name-reveal z-20">
          <p
            className="text-4xl sm:text-5xl font-black tracking-wide"
            style={{
              color: '#fff',
              textShadow: `
                0 0 14px #ff6b00,
                0 0 32px #ff2d55,
                0 0 56px #00f0ff,
                0 2px 4px rgba(0,0,0,0.85)
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
          className="fx-btn relative mt-4 px-14 py-4 rounded-2xl text-xl font-black disabled:opacity-50 z-20"
          style={{
            background: busy
              ? 'linear-gradient(135deg, #7f1d1d, #991b1b)'
              : 'linear-gradient(135deg, #dc2626, #f97316, #eab308)',
            boxShadow: busy
              ? '0 0 22px rgba(220,38,38,0.45)'
              : '0 0 32px rgba(249,115,22,0.6), 0 4px 20px rgba(0,0,0,0.4)',
            color: '#fff',
            textShadow: '0 1px 3px rgba(0,0,0,0.55)',
          }}
        >
          {busy ? 'تدور… 🔥' : 'لف العجلة 🔥'}
        </button>
      )}
    </div>
  )
}
