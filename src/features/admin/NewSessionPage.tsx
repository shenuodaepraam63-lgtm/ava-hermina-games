import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listPlayers, type Player } from '../../services/players.service'
import { createSession } from '../../services/sessions.service'

export function NewSessionPage() {
  const navigate = useNavigate()
  const [players, setPlayers] = useState<Player[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const data = await listPlayers(true)
        setPlayers(data)
        setSelected(new Set(data.map((p) => p.id)))
      } catch (e: any) {
        setError(e.message || 'فشل تحميل الأسماء')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleStart() {
    if (selected.size === 0) {
      setError('اختر مشاركاً واحداً على الأقل')
      return
    }
    setCreating(true)
    setError(null)
    try {
      const sessionId = await createSession([...selected])
      try {
        localStorage.setItem('ava_last_session_id', sessionId)
      } catch {
        /* ignore */
      }
      navigate(`/play/abqarino/${sessionId}`)
    } catch (e: any) {
      setError(e.message || 'فشل إنشاء الجولة')
      setCreating(false)
    }
  }

  if (loading) return <p className="text-slate-500">جاري التحميل...</p>

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">جولة جديدة — عبقرينو</h1>
      <p className="text-slate-500 text-sm mb-6">اختر المشاركين ثم ابدأ الجولة</p>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</div>
      )}

      {players.length === 0 ? (
        <p className="text-slate-500">
          لا توجد أسماء نشطة. أضف أسماء من صفحة{' '}
          <a href="/admin/players" className="text-red-600 underline">
            الأسماء
          </a>
          .
        </p>
      ) : (
        <>
          <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 mb-6">
            {players.map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={selected.has(p.id)}
                  onChange={() => toggle(p.id)}
                  className="accent-red-600 w-4 h-4"
                />
                <span className="font-medium">{p.display_name}</span>
              </label>
            ))}
          </div>

          <button
            onClick={handleStart}
            disabled={creating || selected.size === 0}
            className="px-8 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 disabled:opacity-50"
          >
            {creating ? 'جاري الإنشاء...' : `بدء الجولة (${selected.size})`}
          </button>
        </>
      )}
    </div>
  )
}
