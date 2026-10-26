import { Link } from 'react-router-dom'

export function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-red-50 to-white">
      <div className="text-center max-w-2xl">
        <h1 className="text-4xl md:text-5xl font-bold text-red-800 mb-4">Ava Hermina Games</h1>
        <p className="text-lg text-slate-600 mb-8">منصة ألعاب تفاعلية لخدمة مدارس الأحد</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/login"
            className="px-6 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition"
          >
            دخول الأدمن
          </Link>
        </div>
        <p className="mt-12 text-sm text-slate-400">اللعبة الأولى: عبقرينو</p>
      </div>
    </div>
  )
}
