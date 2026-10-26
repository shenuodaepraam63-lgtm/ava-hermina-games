import { useMemo } from 'react'

const COLORS = ['#dc2626', '#fbbf24', '#22c55e', '#3b82f6', '#e11d48', '#f97316', '#a855f7']

type Props = {
  active: boolean
  count?: number
}

export function Confetti({ active, count = 48 }: Props) {
  const pieces = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.8,
      duration: 2.2 + Math.random() * 1.8,
      color: COLORS[i % COLORS.length],
      rotate: Math.random() * 360,
      w: 6 + Math.random() * 8,
      h: 10 + Math.random() * 10,
    }))
  }, [count, active])

  if (!active) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <span
          key={`${active}-${p.id}`}
          className="fx-confetti-piece"
          style={{
            left: `${p.left}%`,
            width: p.w,
            height: p.h,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  )
}
