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
  '#00f0ff',
  '#0077ff',
  '#00ff9d',
  '#ff2d95',
  '#b24dff',
  '#ffd000',
  '#ff6b00',
  '#00d4ff',
  '#ff4d6d',
  '#7b61ff',
  '#ffe566',
  '#ff8fab',
]

const AUDIENCE = [
  { x: 4, scale: 0.78, delay: 0 },
  { x: 10, scale: 0.92, delay: 0.07 },
  { x: 16, scale: 1.05, delay: 0.03 },
  { x: 22, scale: 0.88, delay: 0.11 },
  { x: 28, scale: 1.1, delay: 0.05 },
  { x: 34, scale: 0.95, delay: 0.09 },
  { x: 40, scale: 0.85, delay: 0.02 },
  { x: 60, scale: 0.9, delay: 0.06 },
  { x: 66, scale: 1.08, delay: 0.12 },
  { x: 72, scale: 0.92, delay: 0.04 },
  { x: 78, scale: 1.02, delay: 0.1 },
  { x: 84, scale: 0.86, delay: 0.08 },
  { x: 90, scale: 0.98, delay: 0.01 },
  { x: 96, scale: 0.8, delay: 0.13 },
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
    const extraTurns = 7 + Math.floor(Math.random() * 3)
    const finalRotation =
      angleRef.current +
      extraTurns * 360 +
      ((360 - targetSliceCenter - (angleRef.current % 360) + 360) % 360)
    angleRef.current = finalRotation
    setRotation(finalRotation)
    setAnimating(true)

    const DECEL_MS = 6000
    let step = 0
    const totalSteps = 60
    intensityTimerRef.current = window.setInterval(() => {
      step += 1
      const t = Math.min(1, step / totalSteps)
      const eased =
        t < 0.35
          ? t * 0.5
          : t < 0.7
            ? 0.175 + (t - 0.35) * 0.9
            : 0.49 + Math.pow((t - 0.7) / 0.3, 1.6) * 0.51
      setIntensity(Math.min(1, eased))
      if (step % 3 === 0 && t > 0.45) {
        sfx.spinTickSlow()
      }
    }, DECEL_MS / totalSteps)

    if (landTimerRef.current) window.clearTimeout(landTimerRef.current)
    landTimerRef.current = window.setTimeout(() => {
      if (intensityTimerRef.current) {
        window.clearInterval(intensityTimerRef.current)
        intensityTimerRef.current = null
      }
      const name = players[idx]?.name || players[0]?.name || ''
      notifyLanded(name)
    }, DECEL_MS)
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
        const boost = Math.min(6, Math.floor(tickCount / 40))
        angleRef.current += 18 + boost
        setRotation(angleRef.current)
        if (tickCount % 2 === 0) sfx.spinTick()
        setIntensity(0.3 + Math.min(0.3, tickCount / 120))
      }, 55)
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
    if (players.length === 0) return '#0a0f1a'
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

  const rimGlow = `
    0 0 ${28 + intensity * 60}px rgba(0, 255, 255, ${0.5 + intensity * 0.45}),
    0 0 ${55 + intensity * 80}px rgba(255, 80, 0, ${0.25 + intensity * 0.35}),
    0 0 ${90 + intensity * 50}px rgba(120, 0, 255, ${0.15 + intensity * 0.2}),
    inset 0 0 20px rgba(0, 200, 255, 0.15)
  `

  return (
    <div
      className={`fixed inset-0 z-40 flex flex-col items-center justify-center overflow-hidden fx-enter ${shakeClass}`}
    >
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 50% 40% at 50% 35%, rgba(0,80,140,0.45) 0%, transparent 60%),
              radial-gradient(ellipse 80% 50% at 50% 100%, rgba(40,0,80,0.7) 0%, transparent 50%),
              radial-gradient(circle at 20% 20%, rgba(0,100,150,0.12), transparent 40%),
              radial-gradient(circle at 80% 25%, rgba(120,0,180,0.1), transparent 40%),
              linear-gradient(180deg, #01050c 0%, #050d1a 30%, #0a0618 70%, #020208 100%)
            `,
          }}
        />

        <div
          className="absolute bottom-0 left-0 right-0 h-[40%] pointer-events-none"
          style={{
            background: `
              linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%),
              repeating-linear-gradient(
                90deg,
                transparent,
                transparent 48px,
                rgba(0,220,255,0.04) 48px,
                rgba(0,220,255,0.04) 49px
              )
            `,
            transform: 'perspective(600px) rotateX(55deg)',
            transformOrigin: 'center bottom',
            opacity: 0.7,
          }}
        />

        <div
          className="absolute top-0 left-0 right-0 h-[22%] pointer-events-none opacity-30"
          style={{
            background:
              'linear-gradient(180deg, rgba(0,255,255,0.08), transparent), repeating-linear-gradient(90deg, transparent 0, transparent 60px, rgba(255,180,50,0.05) 60px, rgba(255,180,50,0.05) 62px)',
          }}
        />

        {[4, 96].map((left, i) => (
          <div
            key={`scr-${i}`}
            className="absolute top-[12%] bottom-[22%] w-[8%] rounded-lg pointer-events-none overflow-hidden"
            style={{
              left: `${left}%`,
              transform: 'translateX(-50%)',
              background: 'linear-gradient(180deg, #031018, #01060c)',
              border: '1px solid rgba(0,240,255,0.45)',
              boxShadow: `
                0 0 ${12 + intensity * 16}px rgba(0,220,255,0.35),
                inset 0 0 20px rgba(0,100,150,0.4)
              `,
            }}
          >
            <div
              className="absolute inset-[2px] rounded-md"
              style={{
                background: `
                  repeating-linear-gradient(0deg, transparent, transparent 5px, rgba(0,255,220,0.1) 5px, rgba(0,255,220,0.1) 6px),
                  repeating-linear-gradient(90deg, transparent, transparent 10px, rgba(0,150,255,0.06) 10px, rgba(0,150,255,0.06) 11px),
                  linear-gradient(180deg, rgba(0,60,100,0.5), rgba(80,0,120,0.35))
                `,
                opacity: 0.85 + intensity * 0.15,
              }}
            />
            <div
              className="absolute top-1 left-1 right-1 h-1.5 rounded-sm"
              style={{
                background: 'linear-gradient(90deg, #00f0ff, #ff00aa, #00f0ff)',
                opacity: 0.7 + intensity * 0.3,
                boxShadow: '0 0 8px rgba(0,240,255,0.6)',
              }}
            />
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[70%] h-0.5 rounded bg-cyan-400/60" />
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[50%] h-[20%] rounded-sm border border-cyan-400/30 bg-cyan-500/10" />
          </div>
        ))}

        {[12, 18, 82, 88].map((left, i) => (
          <div
            key={`p-${i}`}
            className="absolute top-[8%] bottom-[20%] w-[3px] rounded-full pointer-events-none"
            style={{
              left: `${left}%`,
              background:
                i % 2 === 0
                  ? 'linear-gradient(180deg, transparent 0%, #00f0ff 25%, #ff00cc 55%, #00f0ff 80%, transparent 100%)'
                  : 'linear-gradient(180deg, transparent 0%, #ff9f0a 25%, #ff2d55 55%, #ff9f0a 80%, transparent 100%)',
              opacity: 0.35 + intensity * 0.45,
              boxShadow: `0 0 ${10 + intensity * 18}px ${i % 2 === 0 ? '#00e5ff' : '#ff8c00'}`,
              animation: busy ? `fx-neon-flicker ${1 + i * 0.2}s ease-in-out infinite` : undefined,
            }}
          />
        ))}

        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[55%] h-[28%] pointer-events-none"
          style={{
            background: `linear-gradient(to top, rgba(0,240,255,${0.12 + intensity * 0.15}), transparent)`,
            clipPath: 'polygon(20% 100%, 80% 100%, 100% 0%, 0% 0%)',
          }}
        />
        <div
          className="absolute bottom-0 left-[22%] w-[2px] h-[26%] origin-bottom pointer-events-none"
          style={{
            background: `linear-gradient(to top, rgba(0,255,255,${0.55 + intensity * 0.35}), transparent)`,
            transform: 'skewX(-12deg)',
            boxShadow: '0 0 12px rgba(0,255,255,0.5)',
          }}
        />
        <div
          className="absolute bottom-0 right-[22%] w-[2px] h-[26%] origin-bottom pointer-events-none"
          style={{
            background: `linear-gradient(to top, rgba(0,255,255,${0.55 + intensity * 0.35}), transparent)`,
            transform: 'skewX(12deg)',
            boxShadow: '0 0 12px rgba(0,255,255,0.5)',
          }}
        />

        {busy && (
          <>
            <div
              className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
              style={{
                width: '58%',
                paddingBottom: '58%',
                border: `2px solid rgba(0,255,255,${0.35 + intensity * 0.35})`,
                boxShadow: `0 0 ${24 + intensity * 40}px rgba(0,255,255,0.3)`,
                animation: 'fx-portal-ring 2.4s linear infinite',
              }}
            />
            <div
              className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
              style={{
                width: '70%',
                paddingBottom: '70%',
                border: `1px solid rgba(255,100,0,${0.25 + intensity * 0.3})`,
                animation: 'fx-portal-ring 3.2s linear infinite reverse',
              }}
            />
            <div
              className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
              style={{
                width: '82%',
                paddingBottom: '82%',
                border: `1px dashed rgba(180,0,255,${0.15 + intensity * 0.2})`,
                animation: 'fx-portal-ring 4.5s linear infinite',
              }}
            />
          </>
        )}

        <div
          className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 z-10"
          style={{ width: 'min(68vw, 420px)' }}
        >
          <div
            className="absolute left-1/2 -translate-x-1/2 top-[94%] w-[75%] pointer-events-none"
            style={{ zIndex: 1 }}
          >
            {[0, 1, 2, 3].map((lvl) => (
              <div
                key={lvl}
                className="mx-auto rounded-full"
                style={{
                  width: `${100 - lvl * 14}%`,
                  height: 5 + lvl * 2,
                  marginTop: lvl === 0 ? 0 : 1.5,
                  background:
                    lvl === 0
                      ? 'linear-gradient(90deg, #1a0800, #ffc040, #ff8c00, #ffc040, #1a0800)'
                      : lvl === 1
                        ? 'linear-gradient(90deg, #051018, #00e0ff, #051018)'
                        : lvl === 2
                          ? 'linear-gradient(90deg, #0a0a12, #444, #0a0a12)'
                          : 'linear-gradient(90deg, #050508, #222, #050508)',
                  boxShadow:
                    lvl === 0
                      ? `0 0 ${12 + intensity * 16}px rgba(255,160,40,0.65)`
                      : lvl === 1
                        ? `0 0 8px rgba(0,220,255,0.4)`
                        : '0 0 4px rgba(0,0,0,0.5)',
                  border:
                    lvl === 0
                      ? '1px solid rgba(255,230,150,0.7)'
                      : '1px solid rgba(0,0,0,0.5)',
                }}
              />
            ))}
          </div>

          <div
            className={`relative aspect-square w-full ${landed ? 'fx-neon-land' : ''}`}
            style={{
              filter: landed
                ? 'brightness(1.3) saturate(1.4)'
                : intensity > 0.6
                  ? `brightness(${1 + intensity * 0.22}) saturate(${1 + intensity * 0.3})`
                  : undefined,
            }}
          >
            <div
              className="absolute -inset-[14px] rounded-full pointer-events-none"
              style={{
                background:
                  'conic-gradient(from 0deg, #00f0ff, #ff00aa, #ffcc00, #00ff88, #7b61ff, #00f0ff)',
                opacity: 0.5 + intensity * 0.45,
                filter: `blur(${5 + intensity * 4}px)`,
                animation: busy ? 'fx-neon-rotate 3.5s linear infinite' : undefined,
              }}
            />

            <div
              className="absolute -inset-[7px] rounded-full pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle, transparent 70%, #0a0e14 72%, #2a3545 76%, #0a0e14 82%, transparent 84%)',
                boxShadow: rimGlow,
              }}
            />

            <div
              className="absolute -inset-[2px] rounded-full pointer-events-none"
              style={{
                border: '3px solid',
                borderColor:
                  intensity > 0.75 ? '#b0ffff' : intensity > 0.4 ? '#22d3ee' : '#06b6d4',
                boxShadow: rimGlow,
                transition: 'box-shadow 0.12s linear, border-color 0.15s',
              }}
            />

            <div
              className="absolute left-1/2 -translate-x-1/2 z-30 pointer-events-none"
              style={{ top: '-16px' }}
            >
              <div
                className="relative w-6 h-6 rotate-45"
                style={{
                  background:
                    'linear-gradient(135deg, #ffffff 0%, #ffd700 35%, #ff8c00 100%)',
                  boxShadow: `
                    0 0 12px rgba(255,200,50,1),
                    0 0 24px rgba(0,240,255,0.6),
                    inset 0 0 8px rgba(255,255,255,0.8)
                  `,
                  border: '1px solid rgba(255,245,200,0.95)',
                }}
              >
                <div
                  className="absolute inset-[3px]"
                  style={{
                    background: 'linear-gradient(135deg, #fff, #a5f3fc)',
                    opacity: 0.9,
                  }}
                />
              </div>
            </div>

            <div
              className="absolute left-1/2 -translate-x-1/2 z-30"
              style={{ bottom: '-8px' }}
            >
              <div
                className="w-0 h-0 border-l-[14px] border-r-[14px] border-b-[26px] border-l-transparent border-r-transparent border-b-amber-400"
                style={{
                  filter: `drop-shadow(0 0 ${10 + intensity * 14}px #ffaa00)`,
                }}
              />
              <div
                className="absolute left-1/2 -translate-x-1/2 top-full w-3 h-3.5 rounded-b-sm"
                style={{
                  background: 'linear-gradient(180deg, #ffc040, #cc5500)',
                  boxShadow: '0 0 8px rgba(255,160,40,0.7)',
                }}
              />
            </div>

            <div
              className="absolute inset-0 rounded-full overflow-hidden"
              style={{
                background: gradient,
                transform: `rotate(${rotation}deg)`,
                transition:
                  animating && !spinning
                    ? 'transform 6s cubic-bezier(0.12, 0.6, 0.05, 1)'
                    : undefined,
                boxShadow: `
                  inset 0 0 50px rgba(0,0,0,0.6),
                  inset 0 0 20px rgba(0,0,0,0.4),
                  0 0 ${20 + intensity * 45}px rgba(255,60,0,${0.25 + intensity * 0.35})
                `,
                border: '4px solid rgba(8,12,20,0.9)',
              }}
            >
              <div
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{
                  background:
                    'radial-gradient(circle at 50% 50%, transparent 35%, rgba(0,0,0,0.25) 70%, rgba(0,0,0,0.5) 100%)',
                }}
              />

              {players.map((_, i) => {
                const a = i * slice
                return (
                  <div
                    key={`div-${i}`}
                    className="absolute left-1/2 top-1/2 w-[50%] h-[2px] origin-left pointer-events-none"
                    style={{
                      transform: `rotate(${a - 90}deg)`,
                      background:
                        'linear-gradient(90deg, transparent 5%, rgba(255,255,255,0.25) 25%, rgba(255,255,255,0.95) 100%)',
                      boxShadow: '0 0 6px rgba(255,255,255,0.5)',
                    }}
                  />
                )
              })}

              {players.map((p, i) => {
                const angle = -90 + i * slice + slice / 2
                const maxLen = n > 10 ? 8 : n > 6 ? 10 : 12
                const label =
                  p.name.length > maxLen ? p.name.slice(0, maxLen - 1) + '…' : p.name
                const fontSize =
                  n > 12 ? '10px' : n > 8 ? '12px' : n > 5 ? '14px' : '16px'
                return (
                  <div
                    key={p.id}
                    className="absolute left-1/2 top-1/2 origin-left text-white font-black whitespace-nowrap pointer-events-none"
                    style={{
                      transform: `rotate(${angle}deg) translate(${n > 8 ? 40 : 48}px, -50%)`,
                      width: n > 10 ? '30%' : '36%',
                      fontSize,
                      textShadow:
                        '0 0 6px rgba(0,0,0,1), 0 2px 4px rgba(0,0,0,1), 0 0 12px rgba(255,255,255,0.25)',
                      letterSpacing: '0.02em',
                    }}
                  >
                    {label}
                  </div>
                )
              })}

              <div
                className="absolute inset-[26%] rounded-full flex items-center justify-center"
                style={{
                  background: `
                    radial-gradient(circle at 38% 32%,
                      #ffffff 0%,
                      #a5f3fc 12%,
                      #00d4ff 28%,
                      #0066aa 48%,
                      #ff8c00 68%,
                      #1a0500 100%)
                  `,
                  boxShadow: `
                    0 0 ${18 + intensity * 30}px rgba(0,240,255,${0.6 + intensity * 0.35}),
                    0 0 ${28 + intensity * 24}px rgba(255,140,0,${0.4 + intensity * 0.3}),
                    inset 0 0 20px rgba(0,0,0,0.5),
                    0 0 0 2px rgba(255,220,120,0.8),
                    0 0 0 6px rgba(0,30,50,0.7),
                    0 0 0 8px rgba(0,200,255,0.35)
                  `,
                  border: '2px solid rgba(180,250,255,0.9)',
                }}
              >
                <div
                  className="absolute inset-[20%] rounded-full"
                  style={{
                    background:
                      'radial-gradient(circle at 40% 35%, #fff 0%, #e0f7ff 30%, #00c0e0 100%)',
                    boxShadow: `0 0 ${10 + intensity * 14}px rgba(255,255,255,0.85)`,
                    opacity: 0.95,
                  }}
                />
                <div
                  className="absolute inset-[8%] rounded-full pointer-events-none"
                  style={{
                    border: '1px solid rgba(255,255,255,0.35)',
                    boxShadow: 'inset 0 0 8px rgba(0,200,255,0.3)',
                  }}
                />
                <span
                  className="relative font-black tracking-[0.2em] text-white z-10"
                  style={{
                    fontSize: n > 10 ? '11px' : '14px',
                    textShadow:
                      '0 0 10px rgba(0,220,255,1), 0 1px 3px rgba(0,0,0,0.9)',
                  }}
                >
                  AH
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-[22%] pointer-events-none overflow-hidden z-20">
          <div
            className="absolute bottom-[36%] left-[6%] right-[6%] h-[2px] rounded-full"
            style={{
              background: `linear-gradient(90deg, transparent, rgba(0,220,255,${0.25 + intensity * 0.35}), transparent)`,
              boxShadow: intensity > 0.5 ? '0 0 10px rgba(0,255,255,0.3)' : undefined,
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
                width: 24,
                height: 46,
              }}
            >
              <div
                className="absolute left-1/2 -translate-x-1/2 top-0 w-[12px] h-[12px] rounded-full"
                style={{
                  background: '#080c14',
                  boxShadow:
                    intensity > 0.55
                      ? `0 0 7px rgba(255,120,50,${0.3 + intensity * 0.3})`
                      : '0 0 3px rgba(0,0,0,0.5)',
                }}
              />
              <div
                className="absolute left-1/2 -translate-x-1/2 top-[10px] w-[17px] h-[24px] rounded-t-[8px]"
                style={{ background: 'linear-gradient(180deg, #121a28, #080c14)' }}
              />
              <div
                className="absolute left-1/2 -translate-x-1/2 bottom-0 w-[22px] h-[10px] rounded-t-md"
                style={{
                  background: 'linear-gradient(180deg, #121a28, #020408)',
                  boxShadow: '0 0 5px rgba(0,80,120,0.35)',
                }}
              />
            </div>
          ))}
        </div>

        <div
          className="absolute inset-0 pointer-events-none z-30"
          style={{
            background:
              'radial-gradient(ellipse 70% 60% at 50% 40%, transparent 30%, rgba(0,0,0,0.55) 100%)',
            boxShadow:
              intensity > 0.7
                ? `inset 0 0 ${40 + intensity * 30}px rgba(255,40,0,${0.12 + intensity * 0.12})`
                : undefined,
          }}
        />
      </div>

      {selectedName && !busy && landed && (
        <div className="relative text-center mt-3 fx-neon-name-reveal z-50 px-4">
          <p
            className="text-4xl sm:text-5xl font-black tracking-wide"
            style={{
              color: '#fff',
              textShadow: `
                0 0 16px #00f0ff,
                0 0 32px #ff6b00,
                0 0 56px #ff2d95,
                0 2px 4px rgba(0,0,0,0.9)
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
          className="fx-btn absolute bottom-[2.5%] left-1/2 -translate-x-1/2 px-12 py-3.5 rounded-2xl text-lg sm:text-xl font-black disabled:opacity-50 z-50"
          style={{
            background: busy
              ? 'linear-gradient(135deg, #7f1d1d, #991b1b)'
              : 'linear-gradient(135deg, #dc2626, #f97316, #eab308)',
            boxShadow: busy
              ? '0 0 22px rgba(220,38,38,0.45)'
              : '0 0 36px rgba(249,115,22,0.7), 0 4px 20px rgba(0,0,0,0.45)',
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
