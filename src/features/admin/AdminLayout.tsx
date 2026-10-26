import { Outlet, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export function AdminLayout() {
  const navigate = useNavigate()

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/admin" className="font-bold text-red-700 text-lg">
            Ava Hermina Games
          </Link>
          <nav className="hidden md:flex gap-4 text-sm">
            <Link to="/admin" className="text-slate-600 hover:text-red-600">
              الرئيسية
            </Link>
            <Link to="/admin/sessions/new" className="text-slate-600 hover:text-red-600">
              جولة جديدة
            </Link>
            <Link to="/admin/sessions" className="text-slate-600 hover:text-red-600">
              السجل
            </Link>
            <Link to="/admin/players" className="text-slate-600 hover:text-red-600">
              الأسماء
            </Link>
            <Link to="/admin/groups" className="text-slate-600 hover:text-red-600">
              المجموعات
            </Link>
            <Link to="/admin/questions" className="text-slate-600 hover:text-red-600">
              الأسئلة
            </Link>
            <Link to="/admin/settings" className="text-slate-600 hover:text-red-600">
              الإعدادات
            </Link>
          </nav>
        </div>
        <button onClick={handleLogout} className="text-sm text-slate-500 hover:text-red-600">
          تسجيل الخروج
        </button>
      </header>
      <main className="p-6 max-w-6xl mx-auto">
        <Outlet />
      </main>
    </div>
  )
}
