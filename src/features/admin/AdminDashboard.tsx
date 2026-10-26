import { Link } from 'react-router-dom'

export function AdminDashboard() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">لوحة التحكم</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link
          to="/admin/players"
          className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-sm transition"
        >
          <h2 className="font-semibold text-lg text-slate-800 mb-1">أسماء المخدومين</h2>
          <p className="text-sm text-slate-500">إدارة قائمة الأسماء للعجلة</p>
        </Link>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 opacity-60">
          <h2 className="font-semibold text-lg text-slate-800 mb-1">مجموعات الأسئلة</h2>
          <p className="text-sm text-slate-500">قريباً</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 opacity-60">
          <h2 className="font-semibold text-lg text-slate-800 mb-1">الأسئلة</h2>
          <p className="text-sm text-slate-500">قريباً</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 opacity-60">
          <h2 className="font-semibold text-lg text-slate-800 mb-1">عبقرينو</h2>
          <p className="text-sm text-slate-500">قريباً — بدء جولة</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 opacity-60">
          <h2 className="font-semibold text-lg text-slate-800 mb-1">سجل الجولات</h2>
          <p className="text-sm text-slate-500">قريباً</p>
        </div>
      </div>
    </div>
  )
}
