import { Link } from 'react-router-dom'

export function AdminDashboard() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">لوحة التحكم</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link
          to="/admin/sessions/new"
          className="bg-red-600 text-white p-6 rounded-2xl hover:bg-red-700 transition shadow-sm"
        >
          <h2 className="font-semibold text-lg mb-1">بدء جولة عبقرينو</h2>
          <p className="text-sm text-red-100">اختيار المشاركين وبدء اللعب</p>
        </Link>

        <Link
          to="/admin/sessions"
          className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-red-300 hover:shadow-sm transition"
        >
          <h2 className="font-semibold text-lg text-slate-800 mb-1">سجل الجولات</h2>
          <p className="text-sm text-slate-500">استعادة أو مراجعة جولة سابقة</p>
        </Link>

        <Link
          to="/admin/players"
          className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-red-300 hover:shadow-sm transition"
        >
          <h2 className="font-semibold text-lg text-slate-800 mb-1">أسماء المخدومين</h2>
          <p className="text-sm text-slate-500">إدارة قائمة الأسماء للعجلة</p>
        </Link>

        <Link
          to="/admin/groups"
          className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-red-300 hover:shadow-sm transition"
        >
          <h2 className="font-semibold text-lg text-slate-800 mb-1">مجموعات الأسئلة</h2>
          <p className="text-sm text-slate-500">الكتاب المقدس، التاريخ، الفنون...</p>
        </Link>

        <Link
          to="/admin/questions"
          className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-red-300 hover:shadow-sm transition"
        >
          <h2 className="font-semibold text-lg text-slate-800 mb-1">الأسئلة</h2>
          <p className="text-sm text-slate-500">إضافة وتعديل أسئلة عبقرينو</p>
        </Link>

        <Link
          to="/admin/settings"
          className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-red-300 hover:shadow-sm transition"
        >
          <h2 className="font-semibold text-lg text-slate-800 mb-1">إعدادات عبقرينو</h2>
          <p className="text-sm text-slate-500">الوقت، النقاط، الفوز</p>
        </Link>
      </div>
    </div>
  )
}
