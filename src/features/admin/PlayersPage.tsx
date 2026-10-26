import { useEffect, useState } from 'react'
import {
  listPlayers,
  createPlayer,
  createManyPlayers,
  updatePlayer,
  type Player,
} from '../../services/players.service'

export function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [bulkNames, setBulkNames] = useState('')
  const [saving, setSaving] = useState(false)
  const [showBulk, setShowBulk] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await listPlayers()
      setPlayers(data)
    } catch (e: any) {
      setError(e.message || 'فشل تحميل الأسماء')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleAddOne(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setSaving(true)
    setError(null)
    try {
      await createPlayer(newName)
      setNewName('')
      await load()
    } catch (e: any) {
      setError(e.message || 'فشل إضافة الاسم')
    } finally {
      setSaving(false)
    }
  }

  async function handleBulkAdd(e: React.FormEvent) {
    e.preventDefault()
    const names = bulkNames.split(/[\n,،]/).map((n) => n.trim()).filter(Boolean)
    if (names.length === 0) return
    setSaving(true)
    setError(null)
    try {
      await createManyPlayers(names)
      setBulkNames('')
      setShowBulk(false)
      await load()
    } catch (e: any) {
      setError(e.message || 'فشل إضافة الأسماء')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(player: Player) {
    try {
      await updatePlayer(player.id, { is_active: !player.is_active })
      await load()
    } catch (e: any) {
      setError(e.message || 'فشل التحديث')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">إدارة أسماء المخدومين</h1>
        <button
          onClick={() => setShowBulk(!showBulk)}
          className="text-sm px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50"
        >
          {showBulk ? 'إضافة اسم واحد' : 'إضافة عدة أسماء'}
        </button>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</div>
      )}

      {!showBulk ? (
        <form onSubmit={handleAddOne} className="flex gap-3 mb-8">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="اسم المخدوم..."
            className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <button
            type="submit"
            disabled={saving || !newName.trim()}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            إضافة
          </button>
        </form>
      ) : (
        <form onSubmit={handleBulkAdd} className="mb-8 space-y-3">
          <textarea
            value={bulkNames}
            onChange={(e) => setBulkNames(e.target.value)}
            placeholder="اكتب الأسماء مفصولة بفاصلة أو سطر جديد..."
            rows={4}
            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <button
            type="submit"
            disabled={saving || !bulkNames.trim()}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            إضافة الكل
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-slate-500">جاري التحميل...</p>
      ) : players.length === 0 ? (
        <p className="text-slate-500">لا توجد أسماء بعد. أضف أول اسم.</p>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-right px-4 py-3 font-medium">الاسم</th>
                <th className="text-right px-4 py-3 font-medium">الحالة</th>
                <th className="text-right px-4 py-3 font-medium">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">{p.display_name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        p.is_active
                          ? 'bg-green-50 text-green-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {p.is_active ? 'نشط' : 'معطل'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(p)}
                      className="text-indigo-600 hover:underline text-xs"
                    >
                      {p.is_active ? 'تعطيل' : 'تفعيل'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
