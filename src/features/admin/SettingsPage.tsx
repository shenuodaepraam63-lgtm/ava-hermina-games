import { useEffect, useState } from 'react'
import {
  getGameBySlug,
  getSettings,
  updateSettings,
  type AbqarinoSettings,
  type DifficultySlot,
} from '../../services/settings.service'

const DEFAULT_PLAN: DifficultySlot[] = [
  { difficulty: 'hard', count: 2 },
  { difficulty: 'medium', count: 2 },
  { difficulty: 'easy', count: 1 },
]

const DIFF_LABEL: Record<string, string> = {
  hard: 'صعب',
  medium: 'متوسط',
  easy: 'سهل',
}

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
        const s = row.settings
        if (!s.difficulty_plan || s.difficulty_plan.length === 0) {
          s.difficulty_plan = DEFAULT_PLAN
        }
        setSettings(s)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'فشل التحميل')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  function patch<K extends keyof AbqarinoSettings>(key: K, value: AbqarinoSettings[K]) {
    setSettings((s) => (s ? { ...s, [key]: value } : s))
    setOk(false)
  }

  function patchPlan(idx: number, field: 'difficulty' | 'count', value: string | number) {
    setSettings((s) => {
      if (!s) return s
      const plan = [...(s.difficulty_plan || DEFAULT_PLAN)]
      const row = { ...plan[idx] }
      if (field === 'difficulty') row.difficulty = value as DifficultySlot['difficulty']
      else row.count = Math.max(0, Number(value))
      plan[idx] = row
      const total = plan.reduce((a, x) => a + x.count, 0)
      return { ...s, difficulty_plan: plan, questions_per_round: total }
    })
    setOk(false)
  }

  function addPlanRow() {
    setSettings((s) => {
      if (!s) return s
      const plan = [...(s.difficulty_plan || []), { difficulty: 'medium' as const, count: 1 }]
      return {
        ...s,
        difficulty_plan: plan,
        questions_per_round: plan.reduce((a, x) => a + x.count, 0),
      }
    })
  }

  function removePlanRow(idx: number) {
    setSettings((s) => {
      if (!s) return s
      const plan = (s.difficulty_plan || []).filter((_, i) => i !== idx)
      return {
        ...s,
        difficulty_plan: plan.length ? plan : DEFAULT_PLAN,
        questions_per_round: (plan.length ? plan : DEFAULT_PLAN).reduce((a, x) => a + x.count, 0),
      }
    })
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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'فشل الحفظ')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-slate-500">جاري التحميل...</p>
  if (!settings) return <p className="text-red-600">{error || 'لا توجد إعدادات'}</p>

  const plan = settings.difficulty_plan || DEFAULT_PLAN
  const totalQ = plan.reduce((a, x) => a + x.count, 0)

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

        <div className="border border-slate-200 rounded-2xl p-4 space-y-3 bg-slate-50">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-slate-800">توزيع الصعوبة في الجولة</p>
            <span className="text-xs text-slate-500">الإجمالي: {totalQ} سؤال</span>
          </div>
          <p className="text-xs text-slate-500">
            الترتيب من فوق لتحت = ترتيب ظهور الأسئلة. الأسئلة لا تتكرر بين الجولات حتى تنفد ثم تُخلط من جديد.
          </p>
          {plan.map((row, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <select
                value={row.difficulty}
                onChange={(e) => patchPlan(idx, 'difficulty', e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-sm"
              >
                <option value="hard">صعب</option>
                <option value="medium">متوسط</option>
                <option value="easy">سهل</option>
              </select>
              <input
                type="number"
                min={0}
                max={30}
                value={row.count}
                onChange={(e) => patchPlan(idx, 'count', e.target.value)}
                className="w-20 px-3 py-2 border border-slate-300 rounded-xl text-sm"
              />
              <button
                type="button"
                onClick={() => removePlanRow(idx)}
                className="text-xs text-red-600 px-2"
              >
                حذف
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addPlanRow}
            className="text-sm text-red-600 font-medium"
          >
            + صف صعوبة
          </button>
          <p className="text-xs text-slate-400">
            مثال: {plan.map((r) => `${r.count} ${DIFF_LABEL[r.difficulty]}`).join(' ثم ')}
          </p>
        </div>

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
