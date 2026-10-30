import { useEffect, useMemo, useRef, useState } from 'react'
import { sfx } from '../../lib/sounds'

function useViewport() {
  const [vp, setVp] = useState({ w: 1080, h: 600, landscape: true })
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      setVp({ w, h, landscape: w > h })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])
  return vp
}

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

const SEGMENT_COLORS = [
  '#148ed0',
  '#ffad2f',
  '#db3cae',
  '#25d99a',
  '#7e4ce0',
  '#ff762d',
  '#16bfe8',
  '#a84be0',
  '#2aab79',
  '#f0448c',
  '#1c6ed1',
  '#e79d25',
]

const AUDIENCE_COUNT = 15

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
  const vp = useViewport()

  const n = Math.max(players.length, 1)
  const slice = 360 / n

  const wheelSize = useMemo(() => {
    if (vp.landscape) {
      const maxByH = vp.h * 0.58
      const maxByW = vp.w * 0.42
      return Math.min(maxByH, maxByW, 380)
    }
    const maxByW = vp.w * 0.78
    const maxByH = vp.h * 0.48
    return Math.min(maxByW, maxByH, 540)
  }, [vp])

  const scale = wheelSize / 500
  const diamondSize = Math.max(28, Math.round(45 * scale))
  const pointerBaseW = Math.max(70, Math.round(118 * scale))
  const pointerBaseH = Math.max(20, Math.round(34 * scale))
  const pointerBorder = Math.max(14, Math.round(23 * scale))
  const pointerHeight = Math.max(40, Math.round(65 * scale))

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

    // السهم ثابت من فوق (زاوية 0). ندور العجلة لحد ما منتصف القطاع ييجي تحت السهم
    const targetSliceCenter = Math.max(0, idx) * slice + slice / 2
    const extraTurns = 7 + Math.floor(Math.random() * 3)
    const current = ((angleRef.current % 360) + 360) % 360
    // بعد الدوران: (targetSliceCenter + rotation) % 360 === 0  ⇒  rotation ≡ -target
    const delta = (360 - targetSliceCenter - current + 360) % 360
    const finalRotation = angleRef.current + extraTurns * 360 + delta
    angleRef.current = finalRotation
    setRotation(finalRotation)
    setAnimating(true)

    const DECEL_MS = 5600
    let step = 0
    const totalSteps = 56
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
      if (step % 3 === 0 && t > 0.45) sfx.spinTickSlow()
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
      }, 40)
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

  const busy = spinning || animating
  const selectedName = players.find((p) => p.id === selectedRosterId)?.name

  const segments = useMemo(() => {
    const cx = 250
    const cy = 250
    const r = 247
    const polar = (radius: number, angle: number) => {
      const a = ((angle - 90) * Math.PI) / 180
      return [cx + radius * Math.cos(a), cy + radius * Math.sin(a)] as const
    }

    const paths: {
      d: string
      color: string
      labelX: number
      labelY: number
      mid: number
      name: string
      beadX: number
      beadY: number
    }[] = []

    const list = players.length > 0 ? players : [{ id: 'empty', name: '—' }]
    const step = 360 / list.length

    list.forEach((p, i) => {
      const start = i * step
      const end = (i + 1) * step
      const [x1, y1] = polar(r, start)
      const [x2, y2] = polar(r, end)
      const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`
      const mid = start + step / 2
      const labelR = list.length <= 3 ? 175 : list.length <= 5 ? 170 : 166
      const [lx, ly] = polar(labelR, mid)
      const [bx, by] = polar(236, mid)
      paths.push({
        d,
        color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
        labelX: lx,
        labelY: ly,
        mid,
        name: p.name,
        beadX: bx,
        beadY: by,
      })
    })

    const dots: { x: number; y: number; big: boolean }[] = []
    for (let i = 0; i < 48; i++) {
      const [x, y] = polar(244, i * 7.5)
      dots.push({ x, y, big: i % 4 === 0 })
    }

    return { paths, dots, step }
  }, [players])

  return (
    <div className="fixed inset-0 z-40 overflow-hidden" dir="rtl">
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse at 50% 38%, rgba(16,91,133,.34), transparent 43%),
            radial-gradient(ellipse at 50% 105%, rgba(255,128,32,.13), transparent 40%),
            linear-gradient(180deg,#02040a 0%,#071322 55%,#02040a 100%)
          `,
        }}
      />

      <div
        className="absolute inset-0 pointer-events-none opacity-80"
        style={{
          background:
            'repeating-linear-gradient(90deg,transparent 0 8%,rgba(38,205,255,.12) 8.1%,transparent 8.35% 17%)',
        }}
      />
      <div
        className="absolute top-[4%] bottom-[10%] pointer-events-none"
        style={{
          width: vp.landscape ? '12%' : '23%',
          left: vp.landscape ? '-4%' : '-7%',
          border: '1px solid rgba(53,234,255,.25)',
          borderRight: 'none',
          background: 'linear-gradient(90deg,rgba(8,40,70,.5),transparent)',
          boxShadow: 'inset -8px 0 24px rgba(53,234,255,.08)',
        }}
      />
      <div
        className="absolute top-[4%] bottom-[10%] pointer-events-none"
        style={{
          width: vp.landscape ? '12%' : '23%',
          right: vp.landscape ? '-4%' : '-7%',
          border: '1px solid rgba(53,234,255,.25)',
          borderLeft: 'none',
          background: 'linear-gradient(270deg,rgba(8,40,70,.5),transparent)',
          boxShadow: 'inset 8px 0 24px rgba(53,234,255,.08)',
        }}
      />
      <div
        className="absolute left-[-10%] right-[-10%] bottom-[-5%] h-[22%] pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% 0%, rgba(255,140,40,.18), transparent 55%)',
          borderTop: '2px solid rgba(53,234,255,.35)',
        }}
      />

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-2">
        <div
          className="relative"
          style={{
            width: wheelSize,
            height: wheelSize,
          }}
        >
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              inset: -Math.round(18 * scale),
              border: `${Math.max(3, Math.round(5 * scale))}px solid rgba(53,234,255,.35)`,
              boxShadow:
                intensity > 0.5
                  ? `0 0 ${30 + intensity * 40}px rgba(53,234,255,${0.25 + intensity * 0.35}),0 0 ${60 + intensity * 50}px rgba(255,140,40,${0.12 + intensity * 0.2})`
                  : '0 0 24px rgba(53,234,255,.2)',
            }}
          />

          <div
            className="relative h-full w-full overflow-hidden rounded-full"
            style={{
              border: `${Math.max(4, Math.round(6 * scale))}px solid #1a3a4a`,
              boxShadow:
                '0 0 0 3px #0a1520, inset 0 0 30px rgba(0,0,0,.6), 0 0 40px rgba(53,234,255,.15)',
            }}
          >
            <div
              className="h-full w-full rounded-full"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition:
                  animating && !spinning
                    ? 'transform 5.5s cubic-bezier(0.12, 0.72, 0.08, 1)'
                    : undefined,
                boxShadow: 'inset 0 0 22px #000,0 0 15px rgba(0,0,0,.7)',
              }}
            >
              <svg viewBox="0 0 500 500" className="h-full w-full">
                <defs>
                  <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="1.2" result="b" />
                    <feMerge>
                      <feMergeNode in="b" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {segments.paths.map((s, i) => {
                  const isWinner = landed && selectedIndex === i
                  return (
                    <path
                      key={`seg-${i}`}
                      d={s.d}
                      fill={s.color}
                      stroke={isWinner ? '#fff3bd' : '#071521'}
                      strokeWidth={isWinner ? 7 : 4}
                      style={{
                        filter: isWinner
                          ? 'brightness(1.35) drop-shadow(0 0 12px rgba(255,200,80,.85))'
                          : undefined,
                      }}
                    />
                  )
                })}

                {segments.paths.map((s, i) => {
                  const maxLen = n > 10 ? 8 : n > 6 ? 10 : 12
                  const label =
                    s.name.length > maxLen ? s.name.slice(0, maxLen - 1) + '…' : s.name
                  const fontSize = n > 10 ? 14 : n > 6 ? 16 : 18
                  return (
                    <g key={`lbl-${i}`} transform={`rotate(${s.mid}, 250, 250)`}>
                      <text
                        x={s.labelX}
                        y={s.labelY}
                        transform={`rotate(${-s.mid}, ${s.labelX}, ${s.labelY})`}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#fff"
                        fontSize={fontSize}
                        fontWeight="bold"
                        paintOrder="stroke"
                        stroke="rgba(0,0,0,.55)"
                        strokeWidth={3}
                        strokeLinejoin="round"
                        filter="url(#softGlow)"
                      >
                        {label}
                      </text>
                    </g>
                  )
                })}

                {segments.paths.map((s, i) => (
                  <circle
                    key={`bead-${i}`}
                    cx={s.beadX}
                    cy={s.beadY}
                    r={4}
                    fill="#fff4bf"
                    stroke="#ffb83d"
                    strokeWidth={2}
                    filter="url(#softGlow)"
                  />
                ))}

                {segments.dots.map((d, i) => (
                  <circle
                    key={`dot-${i}`}
                    cx={d.x}
                    cy={d.y}
                    r={d.big ? 2.7 : 1.4}
                    fill={d.big ? '#fff0b0' : '#55edff'}
                    opacity={d.big ? 1 : 0.75}
                  />
                ))}
              </svg>
            </div>
          </div>

          <div
            className="absolute left-1/2 top-1/2 z-[3] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: '25%',
              aspectRatio: '1',
              background:
                'radial-gradient(circle at 35% 25%,#f8ffff 0 3%,#48eaff 8%,#12618d 22%,#08172b 43%,#ffb83f 48%,#74330c 55%,#08172a 62%,#20d8ed 75%,#07101d 84%)',
              border: '4px solid #bafaff',
              boxShadow:
                '0 0 0 5px #142d3d,0 0 0 8px #f3ad3d,0 0 22px #35eaff,inset 0 0 17px #000',
            }}
          >
            <div
              className="absolute rounded-full"
              style={{
                inset: '25%',
                border: '2px solid rgba(255,255,255,.85)',
                boxShadow: '0 0 14px #fff, inset 0 0 12px #35eaff',
              }}
            />
            <span
              className="absolute inset-0 flex items-center justify-center font-black tracking-widest text-white"
              style={{
                fontSize: n > 10 ? 11 : 13,
                textShadow: '0 0 8px #35eaff, 0 1px 2px #000',
              }}
            >
              AH
            </span>
          </div>

          {/* سهم الاختيار — ثابت فوق العجلة ويشير للقطاع الفائز */}
          <div
            className="absolute left-1/2 z-[20]"
            style={{
              top: -Math.round(pointerHeight * 0.92),
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: `${pointerBorder}px solid transparent`,
              borderRight: `${pointerBorder}px solid transparent`,
              borderTop: `${pointerHeight}px solid #ffbe43`,
              filter:
                'drop-shadow(0 0 6px #fff2b4) drop-shadow(0 0 16px #ff9b24) drop-shadow(0 4px 10px rgba(0,0,0,.55))',
            }}
            aria-hidden
          >
            <div
              className="absolute"
              style={{
                top: Math.round(pointerHeight * 0.12),
                left: -Math.round(pointerBorder * 0.55),
                borderLeft: `${Math.round(pointerBorder * 0.55)}px solid transparent`,
                borderRight: `${Math.round(pointerBorder * 0.55)}px solid transparent`,
                borderTop: `${Math.round(pointerHeight * 0.62)}px solid #fff0ae`,
              }}
            />
          </div>

          {/* قاعدة الماس فوق السهم */}
          <div
            className="absolute left-1/2 z-[21]"
            style={{
              top: -Math.round(pointerHeight * 0.92 + diamondSize * 0.55),
              width: diamondSize,
              height: diamondSize,
              transform: 'translateX(-50%) rotate(45deg)',
              border: `${Math.max(2, Math.round(3 * scale))}px solid #fff3bd`,
              background:
                'linear-gradient(135deg,#fff 0%,#ffc34b 28%,#ff6b2a 55%,#fff5b6 70%,#24eaff 100%)',
              boxShadow:
                '0 0 10px #fff,0 0 25px #35eaff,0 0 42px rgba(255,165,45,.8)',
            }}
          >
            <div
              className="absolute"
              style={{
                inset: Math.max(4, Math.round(7 * scale)),
                border: '2px solid #fff',
                background: 'linear-gradient(135deg,transparent,#ffef9c)',
              }}
            />
          </div>
        </div>

        {/* قاعدة ذهبية تحت العجلة (زينة فقط — الاختيار من السهم فوق) */}
        <div
          className="relative z-[7] mx-auto"
          style={{
            marginTop: -Math.round(8 * scale),
            width: pointerBaseW,
            height: pointerBaseH,
            borderRadius: '50%',
            background:
              'linear-gradient(180deg,#fff3bb,#ffb52e 25%,#8a450d 60%,#151b25 78%,#32eaff)',
            boxShadow:
              '0 0 20px rgba(255,177,45,.6),0 0 28px rgba(53,234,255,.25)',
          }}
        />

        <div
          className="text-center font-bold"
          style={{
            marginTop: vp.landscape ? 6 : 16,
            minHeight: vp.landscape ? 20 : 28,
            fontSize: vp.landscape ? 13 : 16,
            color: '#fff1ba',
            textShadow: '0 0 12px rgba(255,190,67,.45)',
          }}
        >
          {selectedName && !busy && landed
            ? `✨ السهم اختار: ${selectedName} ✨`
            : busy
              ? 'العجلة تدور... راقب السهم!'
              : 'جاهز للتحدّي؟ اضغط دوران — الاختيار بالسهم'}
        </div>

        {!hideSpinButton && (
          <div className="flex justify-center" style={{ marginTop: vp.landscape ? 8 : 20 }}>
            <button
              type="button"
              onClick={() => {
                sfx.unlock()
                sfx.uiTap()
                onSpinRequest()
              }}
              disabled={disabled || busy || players.length === 0}
              className="rounded-full font-black disabled:cursor-wait disabled:opacity-60"
              style={{
                padding: vp.landscape ? '8px 22px' : '13px 28px',
                fontSize: vp.landscape ? 13 : 16,
                color: '#06111a',
                background: busy
                  ? 'linear-gradient(110deg,#9a6b2a,#6b3a10)'
                  : 'linear-gradient(110deg,#fff0a8,#ffb42e 45%,#35eaff)',
                boxShadow: busy
                  ? '0 4px 0 #4a2a08'
                  : '0 0 18px rgba(53,234,255,.3),0 6px 0 #75440c',
              }}
            >
              {busy ? 'تدور…' : '✦ أدر العجلة ✦'}
            </button>
          </div>
        )}
      </div>

      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 z-[1] flex items-end justify-around opacity-85"
        style={{ height: vp.landscape ? 40 : 60 }}
        aria-hidden
      >
        {Array.from({ length: AUDIENCE_COUNT }).map((_, i) => (
          <i
            key={i}
            className="relative block rounded-t-[45%]"
            style={{
              width: i % 4 === 0 ? 58 : 'clamp(22px,4vw,48px)',
              height: i % 3 === 0 ? 32 : 42,
              background: '#02040a',
              transform: vp.landscape ? 'scale(0.75)' : undefined,
            }}
          >
            <span
              className="absolute left-1/2 top-[-17px] block h-[22px] w-[22px] -translate-x-1/2 rounded-full"
              style={{ background: '#02040a' }}
            />
          </i>
        ))}
      </div>
    </div>
  )
}
