import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listSessions } from '../../services/sessions.service'

export function SessionsHistoryPage() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const data = await listSessions()
        setRows(data || [])
      } catch (e: any) {
        setError(e.message || 'فشل التحميل')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">سجل الجولات</h1>
        <Link
          to="/admin/sessions/new"
          className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700"
        >
          جولة جديدة
        </Link>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</div>
      )}

      {loading ? (
        <p className="text-slate-500">جاري التحميل...</p>
      ) : rows.length === 0 ? (
        <p className="text-slate-500">لا توجد جولات بعد.</p>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-right px-4 py-3">التاريخ</th>
                <th className="text-right px-4 py-3">الحالة</th>
                <th className="text-right px-4 py-3">فتح</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-3" dir="ltr">
                    {new Date(r.created_at).toLocaleString('ar-EG')}
                  </td>
                  <td className="px-4 py-3">{r.status}</td>
                  <td className="px-4 py-3">
                    <Link to={`/play/abqarino/${r.id}`} className="text-red-600 hover:underline">
                      فتح الجولة
                    </Link>
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
