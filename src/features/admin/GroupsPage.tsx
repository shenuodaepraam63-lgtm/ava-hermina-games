import { useEffect, useState } from 'react'
import { listGroups, createGroup, updateGroup, type QuestionGroup } from '../../services/groups.service'
import { getGameBySlug } from '../../services/settings.service'

export function GroupsPage() {
  const [groups, setGroups] = useState<QuestionGroup[]>([])
  const [gameId, setGameId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const game = await getGameBySlug('abqarino')
      setGameId(game.id)
      const data = await listGroups(game.id)
      setGroups(data)
    } catch (e: any) {
      setError(e.message || 'فشل التحميل')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!gameId || !name.trim()) return
    setSaving(true)
    setError(null)
    try {
      await createGroup({ game_id: gameId, name, description })
      setName('')
      setDescription('')
      await load()
    } catch (e: any) {
      setError(e.message || 'فشل الإضافة')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(g: QuestionGroup) {
    try {
      await updateGroup(g.id, { is_active: !g.is_active })
      await load()
    } catch (e: any) {
      setError(e.message || 'فشل التحديث')
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">مجموعات الأسئلة</h1>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</div>
      )}

      <form onSubmit={handleAdd} className="bg-white border border-slate-200 rounded-2xl p-5 mb-8 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="اسم المجموعة (مثل: الكتاب المقدس)"
            className="px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
            required
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="وصف مختصر (اختياري)"
            className="px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="px-6 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 disabled:opacity-50"
        >
          إضافة مجموعة
        </button>
      </form>

      {loading ? (
        <p className="text-slate-500">جاري التحميل...</p>
      ) : groups.length === 0 ? (
        <p className="text-slate-500">لا توجد مجموعات بعد.</p>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-right px-4 py-3 font-medium">الاسم</th>
                <th className="text-right px-4 py-3 font-medium">الوصف</th>
                <th className="text-right px-4 py-3 font-medium">الحالة</th>
                <th className="text-right px-4 py-3 font-medium">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium">{g.name}</td>
                  <td className="px-4 py-3 text-slate-500">{g.description || '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        g.is_active ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {g.is_active ? 'نشط' : 'معطل'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActive(g)} className="text-red-600 hover:underline text-xs">
                      {g.is_active ? 'تعطيل' : 'تفعيل'}
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
