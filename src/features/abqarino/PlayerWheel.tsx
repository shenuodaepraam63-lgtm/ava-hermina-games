import { useEffect, useMemo, useRef, useState } from 'react'
import { sfx } from '../../lib/sounds'

export type WheelPlayer = {
  id: string
  name: string
}

type Props = {
  players: WheelPlayer[]
  /** Roster player id selected by server after spin completes */
  selectedRosterId: string | null
  spinning: boolean
  onSpinRequest: () => void
  disabled?: boolean
}

const COLORS = [
  '#dc2626',
  '#b91c1c',
  '#991b1b',
  '#7f1d1d',
  '#ef4444',
  '#f87171',
  '#450a0a',
  '#9f1239',
]

export function PlayerWheel({ players, selectedRosterId, spinning, onSpinRequest, disabled }: Props) {
  const [rotation, setRotation] = useState(0)
  const [animating, setAnimating] = useState(false)
  const tickRef = useRef<number | null>(null)
  const prevSpinning = useRef(false)

  const n = Math.max(players.length, 1)
  const slice = 360 / n

  const selectedIndex = useMemo(() => {
    if (!selectedRosterId) return -1
    return players.findIndex((p) => p.id === selectedRosterId)
  }, [players, selectedRosterId])

  // When server returns selection while we requested spin, animate to that slice
  useEffect(() => {
    if (spinning && !prevSpinning.current) {
      setAnimating(true)
      // temporary continuous spin while waiting for server
      let angle = rotation
      const id = window.setInterval(() => {
        angle += 28
        setRotation(angle)
        sfx.spinTick()
      }, 50)
      tickRef.current = id
    }
    if (!spinning && prevSpinning.current && selectedIndex >= 0) {
      if (tickRef.current) {
        window.clearInterval(tickRef.current)
        tickRef.current = null
      }
      // Pointer at top ( -90deg visual with CSS). Land so selected slice center is at top.
      const targetSliceCenter = selectedIndex * slice + slice / 2
      const extraTurns = 4 + Math.floor(Math.random() * 2)
      const finalRotation = extraTurns * 360 + (360 - targetSliceCenter)
      setRotation(finalRotation)
      setAnimating(true)
      const t = window.setTimeout(() => {
        setAnimating(false)
        sfx.spinEnd()
      }, 2800)
      return () => window.clearTimeout(t)
    }
    prevSpinning.current = spinning
  }, [spinning, selectedIndex, slice, rotation])

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

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative w-64 h-64 sm:w-80 sm:h-80">
        {/* pointer */}
        <div className="absolute left-1/2 -translate-x-1/2 -top-1 z-20 w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-amber-400 drop-shadow" />

        <div
          className="w-full h-full rounded-full border-4 border-amber-400 shadow-2xl relative overflow-hidden"
          style={{
            background: gradient,
            transform: `rotate(${rotation}deg)`,
            transition: animating && !spinning ? 'transform 2.8s cubic-bezier(0.12, 0.75, 0.08, 1)' : undefined,
          }}
        >
          {players.map((p, i) => {
            const angle = -90 + i * slice + slice / 2
            return (
              <div
                key={p.id}
                className="absolute left-1/2 top-1/2 origin-left text-[10px] sm:text-xs font-bold text-white whitespace-nowrap pointer-events-none"
                style={{
                  transform: `rotate(${angle}deg) translate(42px, -50%)`,
                  width: '38%',
                  textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                }}
              >
                {p.name.length > 12 ? p.name.slice(0, 11) + '…' : p.name}
              </div>
            )
          })}
          <div className="absolute inset-[38%] rounded-full bg-slate-900 border-2 border-amber-500 flex items-center justify-center text-xs text-slate-400">
            AH
          </div>
        </div>
      </div>

      {selectedRosterId && !spinning && !animating && (
        <p className="text-xl font-bold text-amber-300">
          {players.find((p) => p.id === selectedRosterId)?.name}
        </p>
      )}

      <button
        type="button"
        onClick={onSpinRequest}
        disabled={disabled || spinning || animating || players.length === 0}
        className="px-10 py-4 bg-red-600 hover:bg-red-500 rounded-2xl text-xl font-bold disabled:opacity-50 transition"
      >
        {spinning || animating ? 'تدور...' : 'لف العجلة'}
      </button>
    </div>
  )
}
