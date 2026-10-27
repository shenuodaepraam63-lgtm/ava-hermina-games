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
  '#00d4ff',
  '#0a84ff',
  '#30d158',
  '#ff2d55',
  '#bf5af2',
  '#ffd60a',
  '#ff9f0a',
  '#64d2ff',
  '#ff375f',
  '#5e5ce6',
  '#ffd426',
  '#ff6482',
]

const AUDIENCE = [
  { x: 5, scale: 0.82, delay: 0 },
  { x: 12, scale: 0.95, delay: 0.08 },
  { x: 19, scale: 1.05, delay: 0.04 },
  { x: 26, scale: 0.9, delay: 0.12 },
  { x: 33, scale: 1.08, delay: 0.06 },
  { x: 40, scale: 0.92, delay: 0.1 },
  { x: 60, scale: 0.95, delay: 0.05 },
  { x: 67, scale: 1.1, delay: 0.14 },
  { x: 74, scale: 0.88, delay: 0.07 },
  { x: 81, scale: 1.02, delay: 0.11 },
  { x: 88, scale: 0.9, delay: 0.03 },
  { x: 95, scale: 0.98, delay: 0.09 },
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
    if (players.length === 0) return '#0f172a'
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
    0 0 ${24 + intensity * 50}px rgba(0, 240, 255, ${0.45 + intensity * 0.4}),
    0 0 ${48 + intensity * 70}px rgba(255, 100, 0, ${0.2 + intensity * 0.35}),
    0 0 ${80 + intensity * 40}px rgba(0, 200, 255, ${0.15 + intensity * 0.2})
  `

  return (
    <div
      className={`fixed inset-0 z-40 flex flex-col items-center justify-center overflow-hidden fx-enter ${shakeClass}`}
    >
      {/* Full viewport stage — edge to edge, no card frame */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 55% 45% at 50% 38%, rgba(0,60,100,0.35) 0%, transparent 65%),
              radial-gradient(ellipse 100% 60% at 50% 100%, rgba(10,0,30,0.9) 0%, transparent 50%),
              linear-gradient(180deg, #020617 0%, #06101f 35%, #0c0618 100%)
            `,
          }}
        />
        <div
          className="absolute top-0 left-[10%] right-[10%] h-[18%] pointer-events-none opacity-40"
          style={{
            background:
              'linear-gradient(180deg, rgba(0,200,255,0.15), transparent), repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(255,180,50,0.06) 40px, rgba(255,180,50,0.06) 42px)',
          }}
        />

        {[6, 94].map((left, i) => (
          <div
            key={`scr-${i}`}
            className="absolute top-[18%] bottom-[28%] w-[7%] rounded-md pointer-events-none overflow-hidden"
            style={{
              left: `${left}%`,
              transform: 'translateX(-50%)',
              background: 'linear-gradient(180deg, #0a1628, #020617)',
              border: '1px solid rgba(0,220,255,0.35)',
              boxShadow: `0 0 ${8 + intensity * 12}px rgba(0,200,255,0.25), inset 0 0 12px rgba(0,100,150,0.3)`,
            }}
          >
            <div
              className="absolute inset-[3px] rounded-sm"
              style={{
                background: `
                  repeating-linear-gradient(0deg, transparent, transparent 6px, rgba(0,255,200,0.08) 6px, rgba(0,255,200,0.08) 7px),
                  linear-gradient(180deg, rgba(0,80,120,0.4), rgba(80,0,100,0.3))
                `,
                opacity: 0.7 + intensity * 0.25,
              }}
            />
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-cyan-400/80" />
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-[60%] h-0.5 rounded bg-amber-400/50" />
          </div>
        ))}

        {[14, 22, 78, 86].map((left, i) => (
          <div
            key={`p-${i}`}
            className="absolute top-[10%] bottom-[24%] w-[2px] rounded-full pointer-events-none"
            style={{
              left: `${left}%`,
              background:
                i % 2 === 0
                  ? 'linear-gradient(180deg, transparent, #00f0ff 30%, #ff00aa 70%, transparent)'
                  : 'linear-gradient(180deg, transparent, #ff9f0a 30%, #ff2d55 70%, transparent)',
              opacity: 0.3 + intensity * 0.4,
              boxShadow: `0 0 ${6 + intensity * 14}px ${i % 2 === 0 ? '#00e5ff' : '#ff8c00'}`,
              animation: busy ? `fx-neon-flicker ${1.1 + i * 0.25}s ease-in-out infinite` : undefined,
            }}
          />
        ))}

        <div
          className="absolute bottom-0 left-0 right-0 h-[30%] pointer-events-none"
          style={{
            background: `linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(5,15,30,0.5) 60%, transparent 100%)`,
          }}
        />
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[62%] h-[26%] pointer-events-none"
          style={{
            background: `linear-gradient(to top, rgba(0,220,255,${0.1 + intensity * 0.12}), transparent)`,
            clipPath: 'polygon(18% 100%, 82% 100%, 100% 0%, 0% 0%)',
          }}
        />
        <div
          className="absolute bottom-0 left-[20%] w-[2px] h-[24%] origin-bottom pointer-events-none"
          style={{
            background: `linear-gradient(to top, rgba(0,240,255,${0.5 + intensity * 0.35}), transparent)`,
            transform: 'skewX(-14deg)',
            boxShadow: `0 0 8px rgba(0,240,255,0.4)`,
          }}
        />
        <div
          className="absolute bottom-0 right-[20%] w-[2px] h-[24%] origin-bottom pointer-events-none"
          style={{
            background: `linear-gradient(to top, rgba(0,240,255,${0.5 + intensity * 0.35}), transparent)`,
            transform: 'skewX(14deg)',
            boxShadow: `0 0 8px rgba(0,240,255,0.4)`,
          }}
        />
        <div
          className="absolute bottom-[2%] left-1/2 -translate-x-1/2 w-[28%] h-[8%] rounded-full pointer-events-none blur-md"
          style={{
            background: `radial-gradient(ellipse, rgba(255,160,40,${0.25 + intensity * 0.3}), transparent 70%)`,
          }}
        />

        {busy && (
          <>
            <div
              className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
              style={{
                width: '56%',
                paddingBottom: '56%',
                border: `2px solid rgba(0,240,255,${0.3 + intensity * 0.3})`,
                boxShadow: `0 0 ${18 + intensity * 35}px rgba(0,240,255,0.25)`,
                animation: 'fx-portal-ring 2.5s linear infinite',
              }}
            />
            <div
              className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
              style={{
                width: '68%',
                paddingBottom: '68%',
                border: `1px solid rgba(255,120,0,${0.2 + intensity * 0.25})`,
                animation: 'fx-portal-ring 3.4s linear infinite reverse',
              }}
            />
          </>
        )}

        <div
          className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2 z-10"
          style={{ width: 'min(70vw, 400px)' }}
        >
          <div
            className="absolute left-1/2 -translate-x-1/2 top-[92%] w-[70%] pointer-events-none"
            style={{ zIndex: 1 }}
          >
            {[0, 1, 2].map((lvl) => (
              <div
                key={lvl}
                className="mx-auto rounded-full"
                style={{
                  width: `${100 - lvl * 18}%`,
                  height: 6 + lvl * 2,
                  marginTop: lvl === 0 ? 0 : 2,
                  background:
                    lvl === 0
                      ? 'linear-gradient(90deg, #1a0a00, #ffb347, #ff8c00, #ffb347, #1a0a00)'
                      : lvl === 1
                        ? 'linear-gradient(90deg, #0a1520, #00c8e0, #0a1520)'
                        : 'linear-gradient(90deg, #050508, #333, #050508)',
                  boxShadow:
                    lvl === 0
                      ? `0 0 ${10 + intensity * 14}px rgba(255,160,40,0.55)`
                      : `0 0 6px rgba(0,200,255,0.25)`,
                  border: lvl === 0 ? '1px solid rgba(255,220,150,0.6)' : '1px solid rgba(0,0,0,0.4)',
                }}
              />
            ))}
          </div>

          <div
            className={`relative aspect-square w-full ${landed ? 'fx-neon-land' : ''}`}
            style={{
              filter: landed
                ? 'brightness(1.28) saturate(1.35)'
                : intensity > 0.6
                  ? `brightness(${1 + intensity * 0.2}) saturate(${1 + intensity * 0.28})`
                  : undefined,
            }}
          >
            <div
              className="absolute -inset-[10px] rounded-full pointer-events-none"
              style={{
                background:
                  'conic-gradient(from 0deg, #00f0ff, #ff00aa, #ffcc00, #00ff88, #00f0ff)',
                opacity: 0.45 + intensity * 0.4,
                filter: `blur(${4 + intensity * 3}px)`,
                animation: busy ? 'fx-neon-rotate 4s linear infinite' : undefined,
              }}
            />
            <div
              className="absolute -inset-[5px] rounded-full pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle, transparent 72%, #1a1a1e 73%, #3a3a42 78%, #1a1a1e 85%, transparent 86%)',
                boxShadow: rimGlow,
              }}
            />
            <div
              className="absolute -inset-[2px] rounded-full border-[3px] pointer-events-none"
              style={{
                borderColor:
                  intensity > 0.75 ? '#a5f3fc' : intensity > 0.4 ? '#22d3ee' : '#06b6d4',
                boxShadow: rimGlow,
                transition: 'box-shadow 0.12s linear, border-color 0.15s',
              }}
            />

            <div
              className="absolute left-1/2 -translate-x-1/2 z-30 pointer-events-none"
              style={{ top: '-14px' }}
            >
              <div
                className="relative w-5 h-5 rotate-45"
                style={{
                  background: 'linear-gradient(135deg, #fff 0%, #ffd700 40%, #ff8c00 100%)',
                  boxShadow: `
                    0 0 10px rgba(255,200,50,0.9),
                    0 0 20px rgba(0,220,255,0.5),
                    inset 0 0 6px rgba(255,255,255,0.7)
                  `,
                  border: '1px solid rgba(255,240,200,0.9)',
                }}
              >
                <div
                  className="absolute inset-[3px]"
                  style={{
                    background: 'linear-gradient(135deg, #fff, #a5f3fc)',
                    opacity: 0.85,
                  }}
                />
              </div>
            </div>

            <div className="absolute left-1/2 -translate-x-1/2 z-30" style={{ bottom: '-6px' }}>
              <div
                className="w-0 h-0 border-l-[13px] border-r-[13px] border-b-[24px] border-l-transparent border-r-transparent border-b-amber-400"
                style={{
                  filter: `drop-shadow(0 0 ${8 + intensity * 12}px #ffaa00)`,
                }}
              />
              <div
                className="absolute left-1/2 -translate-x-1/2 top-full w-2.5 h-3 rounded-b-sm"
                style={{
                  background: 'linear-gradient(180deg, #ffb347, #cc6600)',
                  boxShadow: '0 0 6px rgba(255,160,40,0.6)',
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
                    ? 'transform 3.2s cubic-bezier(0.05, 0.75, 0.08, 1)'
                    : undefined,
                boxShadow: `
                  inset 0 0 40px rgba(0,0,0,0.55),
                  0 0 ${16 + intensity * 40}px rgba(255,80,0,${0.2 + intensity * 0.35})
                `,
                border: '3px solid rgba(10,10,15,0.8)',
              }}
            >
              {players.map((_, i) => {
                const a = i * slice
                return (
                  <div
                    key={`div-${i}`}
                    className="absolute left-1/2 top-1/2 w-[50%] h-[1.5px] origin-left pointer-events-none"
                    style={{
                      transform: `rotate(${a - 90}deg)`,
                      background:
                        'linear-gradient(90deg, transparent 8%, rgba(255,255,255,0.35) 30%, rgba(255,255,255,0.9) 100%)',
                      boxShadow: '0 0 4px rgba(255,255,255,0.4)',
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
                      transform: `rotate(${angle}deg) translate(${n > 8 ? 36 : 42}px, -50%)`,
                      width: n > 10 ? '28%' : '34%',
                      fontSize: n > 12 ? '8px' : n > 8 ? '10px' : '12px',
                      textShadow:
                        '0 0 4px rgba(0,0,0,1), 0 1px 2px rgba(0,0,0,0.95), 0 0 8px rgba(255,255,255,0.15)',
                    }}
                  >
                    {label}
                  </div>
                )
              })}

              <div
                className="absolute inset-[28%] rounded-full flex items-center justify-center"
                style={{
                  background: `
                    radial-gradient(circle at 40% 35%,
                      #e0f7ff 0%,
                      #00d4ff 18%,
                      #0077aa 40%,
                      #ff8c00 62%,
                      #1a0500 100%)
                  `,
                  boxShadow: `
                    0 0 ${14 + intensity * 26}px rgba(0,220,255,${0.55 + intensity * 0.35}),
                    0 0 ${22 + intensity * 20}px rgba(255,140,0,${0.35 + intensity * 0.3}),
                    inset 0 0 16px rgba(0,0,0,0.45),
                    0 0 0 2px rgba(255,200,100,0.7),
                    0 0 0 5px rgba(0,40,60,0.6)
                  `,
                  border: '2px solid rgba(180,240,255,0.85)',
                }}
              >
                <div
                  className="absolute inset-[22%] rounded-full"
                  style={{
                    background:
                      'radial-gradient(circle at 40% 35%, #fff 0%, #a5f3fc 40%, #00a0c0 100%)',
                    boxShadow: `0 0 ${8 + intensity * 12}px rgba(255,255,255,0.7)`,
                    opacity: 0.9,
                  }}
                />
                <span
                  className="relative font-black tracking-widest text-white z-10"
                  style={{
                    fontSize: n > 10 ? '9px' : '12px',
                    textShadow: '0 0 8px rgba(0,200,255,0.9), 0 1px 2px rgba(0,0,0,0.8)',
                  }}
                >
                  AH
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-[24%] pointer-events-none overflow-hidden z-20">
          <div
            className="absolute bottom-[38%] left-[8%] right-[8%] h-[2px] rounded-full"
            style={{
              background: `linear-gradient(90deg, transparent, rgba(0,200,255,${0.2 + intensity * 0.3}), transparent)`,
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
                width: 26,
                height: 48,
              }}
            >
              <div
                className="absolute left-1/2 -translate-x-1/2 top-0 w-[13px] h-[13px] rounded-full"
                style={{
                  background: '#0a0f1a',
                  boxShadow:
                    intensity > 0.55
                      ? `0 0 6px rgba(255,120,50,${0.25 + intensity * 0.3})`
                      : '0 0 3px rgba(0,0,0,0.5)',
                }}
              />
              <div
                className="absolute left-1/2 -translate-x-1/2 top-[11px] w-[18px] h-[26px] rounded-t-[9px]"
                style={{ background: 'linear-gradient(180deg, #152033, #0a0f1a)' }}
              />
              <div
                className="absolute left-1/2 -translate-x-1/2 bottom-0 w-[24px] h-[11px] rounded-t-md"
                style={{
                  background: 'linear-gradient(180deg, #152033, #020617)',
                  boxShadow: '0 0 5px rgba(0,80,120,0.3)',
                }}
              />
            </div>
          ))}
        </div>

        <div
          className="absolute inset-0 pointer-events-none z-30"
          style={{
            background:
              'radial-gradient(ellipse 75% 65% at 50% 38%, transparent 35%, rgba(0,0,0,0.5) 100%)',
            boxShadow:
              intensity > 0.7
                ? `inset 0 0 ${35 + intensity * 25}px rgba(255,50,0,${0.12 + intensity * 0.12})`
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
                0 0 14px #00d4ff,
                0 0 28px #ff6b00,
                0 0 48px #ff2d55,
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
          className="fx-btn relative mt-5 px-14 py-4 rounded-2xl text-xl font-black disabled:opacity-50 z-50"
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
