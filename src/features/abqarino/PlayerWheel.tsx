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
  /** يُستدعى مرة واحدة بعد توقف العجلة وظهور الاسم */
  onLanded?: (playerName: string) => void
  disabled?: boolean
  /** إخفاء زر اللف أثناء مرحلة الاحتفال */
  hideSpinButton?: boolean
}

const COLORS = [
  '#dc2626',
  '#b91c1c',
  '#991b1b',
  '#7f1d1d',
  '#ef4444',
  '#f87171',
  '#9f1239',
  '#be123c',
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
  const tickRef = useRef<number | null>(null)
  const prevSpinning = useRef(false)
  const angleRef = useRef(0)
  const landedNotified = useRef(false)

  const n = Math.max(players.length, 1)
  const slice = 360 / n

  const selectedIndex = useMemo(() => {
    if (!selectedRosterId) return -1
    return players.findIndex((p) => p.id === selectedRosterId)
  }, [players, selectedRosterId])

  useEffect(() => {
    if (spinning && !prevSpinning.current) {
      setAnimating(true)
      setLanded(false)
      landedNotified.current = false
      sfx.spinStart()
      const id = window.setInterval(() => {
        angleRef.current += 36
        setRotation(angleRef.current)
        sfx.spinTick()
      }, 40)
      tickRef.current = id
    }

    if (!spinning && prevSpinning.current && selectedIndex >= 0) {
      if (tickRef.current) {
        window.clearInterval(tickRef.current)
        tickRef.current = null
      }
      const targetSliceCenter = selectedIndex * slice + slice / 2
      const extraTurns = 5 + Math.floor(Math.random() * 2)
      const finalRotation =
        angleRef.current +
        extraTurns * 360 +
        ((360 - targetSliceCenter - (angleRef.current % 360) + 360) % 360)
      angleRef.current = finalRotation
      setRotation(finalRotation)
      setAnimating(true)
      const t = window.setTimeout(() => {
        setAnimating(false)
        setLanded(true)
        sfx.spinEnd()
        if (!landedNotified.current) {
          landedNotified.current = true
          const name = players[selectedIndex]?.name || ''
          onLanded?.(name)
        }
      }, 3200)
      return () => window.clearTimeout(t)
    }
    prevSpinning.current = spinning
  }, [spinning, selectedIndex, slice, players, onLanded])

  useEffect(() => {
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current)
    }
  }, [])

  const gradient = useMemo(() => {
    if (players.length === 0) return '#334155'
    const parts = players.map((_, i) => {
      const c = COLORS[i % COLORS.length]
      const a = (i * slice).toFixed(2)
      const b = ((i + 1) * slice).toFixed(2)
      return `${c} ${a}deg ${b}deg`
    })
    return `conic-gradient(from -90deg, ${parts.join(', ')})`
  }, [players, slice])

  const busy = spinning || animating
  const selectedName = players.find((p) => p.id === selectedRosterId)?.name

  return (
    <div className="flex flex-col items-center gap-6 fx-enter">
      <div className={`relative w-72 h-72 sm:w-80 sm:h-80 ${busy ? 'fx-wheel-glow' : ''}`}>
        <div className="absolute left-1/2 -translate-x-1/2 -top-2 z-20 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]">
          <div className="w-0 h-0 border-l-[14px] border-r-[14px] border-t-[24px] border-l-transparent border-r-transparent border-t-amber-400" />
        </div>

        <div
          className={`absolute inset-0 rounded-full border-[5px] border-amber-400/90 shadow-[0_0_40px_rgba(220,38,38,0.35)] overflow-hidden ${
            landed ? 'fx-pop' : ''
          }`}
          style={{
            background: gradient,
            transform: `rotate(${rotation}deg)`,
            transition:
              animating && !spinning
                ? 'transform 3.2s cubic-bezier(0.08, 0.85, 0.12, 1)'
                : undefined,
            filter: spinning ? 'brightness(1.1)' : undefined,
          }}
        >
          {players.map((p, i) => {
            const angle = -90 + i * slice + slice / 2
            return (
              <div
                key={p.id}
                className="absolute left-1/2 top-1/2 origin-left text-[10px] sm:text-xs font-bold text-white whitespace-nowrap pointer-events-none"
                style={{
                  transform: `rotate(${angle}deg) translate(48px, -50%)`,
                  width: '36%',
                  textShadow: '0 1px 3px rgba(0,0,0,0.75)',
                }}
              >
                {p.name.length > 11 ? p.name.slice(0, 10) + '…' : p.name}
              </div>
            )
          })}
          <div className="absolute inset-[36%] rounded-full bg-slate-950 border-2 border-amber-400/80 flex items-center justify-center">
            <span className="text-amber-300 font-black text-sm tracking-wide">AH</span>
          </div>
        </div>
      </div>

      {selectedName && !busy && landed && (
        <p className="text-3xl sm:text-4xl font-black text-amber-300 fx-pop drop-shadow-lg">
          {selectedName}
        </p>
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
          className="fx-btn px-12 py-4 bg-red-600 hover:bg-red-500 rounded-2xl text-xl font-black disabled:opacity-50"
        >
          {busy ? 'تدور…' : 'لف العجلة'}
        </button>
      )}
    </div>
  )
}
