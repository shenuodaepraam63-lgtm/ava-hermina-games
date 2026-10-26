import { useEffect, useState } from 'react'
import {
  getGameBySlug,
  getSettings,
  updateSettings,
  type AbqarinoSettings,
} from '../../services/settings.service'

export function SettingsPage() {
  const [gameId, setGameId] = useState<string | null>(null)
  const [settings, setSettings] = useState<AbqarinoSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const game = await getGameBySlug('abqarino')
        setGameId(game.id)
        const row = await getSettings(game.id)
        setSettings(row.settings)
      } catch (e: any) {
        setError(e.message || 'فشل التحميل')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  function patch<K extends keyof AbqarinoSettings>(key: K, value: AbqarinoSettings[K]) {
    setSettings((s) => (s ? { ...s, [key]: value } : s))
    setOk(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!gameId || !settings) return
    setSaving(true)
    setError(null)
    setOk(false)
    try {
      const row = await updateSettings(gameId, settings)
      setSettings(row.settings)
      setOk(true)
    } catch (e: any) {
      setError(e.message || 'فشل الحفظ')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-slate-500">جاري التحميل...</p>
  if (!settings) return <p className="text-red-600">{error || 'لا توجد إعدادات'}</p>

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">إعدادات عبقرينو</h1>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</div>
      )}
      {ok && (
        <div className="mb-4 text-sm text-green-700 bg-green-50 px-4 py-3 rounded-xl">تم الحفظ بنجاح</div>
      )}

      <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 max-w-xl">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">وقت السؤال (ثانية)</span>
          <input
            type="number"
            min={5}
            max={300}
            value={settings.question_time_seconds}
            onChange={(e) => patch('question_time_seconds', Number(e.target.value))}
            className="mt-1 w-full px-4 py-2.5 border border-slate-300 rounded-xl"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">نقاط الإجابة الصحيحة</span>
          <input
            type="number"
            min={1}
            value={settings.points_per_correct_answer}
            onChange={(e) => patch('points_per_correct_answer', Number(e.target.value))}
            className="mt-1 w-full px-4 py-2.5 border border-slate-300 rounded-xl"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">نقاط الفوز</span>
          <input
            type="number"
            min={1}
            value={settings.winning_score}
            onChange={(e) => patch('winning_score', Number(e.target.value))}
            className="mt-1 w-full px-4 py-2.5 border border-slate-300 rounded-xl"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">عدد الأسئلة في الجولة</span>
          <input
            type="number"
            min={1}
            max={50}
            value={settings.questions_per_round}
            onChange={(e) => patch('questions_per_round', Number(e.target.value))}
            className="mt-1 w-full px-4 py-2.5 border border-slate-300 rounded-xl"
          />
        </label>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={settings.shuffle_questions}
            onChange={(e) => patch('shuffle_questions', e.target.checked)}
            className="accent-red-600"
          />
          <span className="text-sm text-slate-700">خلط الأسئلة</span>
        </label>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={settings.allow_repeated_players}
            onChange={(e) => patch('allow_repeated_players', e.target.checked)}
            className="accent-red-600"
          />
          <span className="text-sm text-slate-700">السماح بتكرار نفس المخدوم</span>
        </label>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={settings.show_correct_answer_after_response}
            onChange={(e) => patch('show_correct_answer_after_response', e.target.checked)}
            className="accent-red-600"
          />
          <span className="text-sm text-slate-700">إظهار الإجابة الصحيحة بعد الرد</span>
        </label>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={settings.show_explanation_after_response}
            onChange={(e) => patch('show_explanation_after_response', e.target.checked)}
            className="accent-red-600"
          />
          <span className="text-sm text-slate-700">إظهار الشرح بعد الرد</span>
        </label>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={settings.enable_sound_effects}
            onChange={(e) => patch('enable_sound_effects', e.target.checked)}
            className="accent-red-600"
          />
          <span className="text-sm text-slate-700">تفعيل المؤثرات الصوتية</span>
        </label>

        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 disabled:opacity-50"
        >
          {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
        </button>
      </form>
    </div>
  )
}
