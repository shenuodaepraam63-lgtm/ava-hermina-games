import { useEffect, useState } from 'react'
import { listGroups, type QuestionGroup } from '../../services/groups.service'
import {
  listQuestions,
  createQuestion,
  updateQuestion,
  type Question,
} from '../../services/questions.service'
import { getGameBySlug } from '../../services/settings.service'
import { uploadMedia } from '../../lib/cloudinary'

export function QuestionsPage() {
  const [groups, setGroups] = useState<QuestionGroup[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [filterGroup, setFilterGroup] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const [groupId, setGroupId] = useState('')
  const [questionText, setQuestionText] = useState('')
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [explanation, setExplanation] = useState('')
  const [sourceRef, setSourceRef] = useState('')
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [mediaPublicId, setMediaPublicId] = useState<string | null>(null)
  const [mediaType, setMediaType] = useState<'image' | 'audio' | null>(null)
  const [options, setOptions] = useState([
    { option_text: '', is_correct: true },
    { option_text: '', is_correct: false },
    { option_text: '', is_correct: false },
    { option_text: '', is_correct: false },
  ])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const game = await getGameBySlug('abqarino')
      const gs = await listGroups(game.id)
      setGroups(gs)
      if (!groupId && gs[0]) setGroupId(gs[0].id)
      const qs = await listQuestions(filterGroup || undefined)
      setQuestions(qs)
    } catch (e: any) {
      setError(e.message || 'فشل التحميل')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [filterGroup])

  function setCorrect(idx: number) {
    setOptions((prev) => prev.map((o, i) => ({ ...o, is_correct: i === idx })))
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const media = await uploadMedia(file)
      setMediaUrl(media.url)
      setMediaPublicId(media.public_id)
      setMediaType(media.media_type)
    } catch (err: any) {
      setError(err.message || 'فشل رفع الملف')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const filled = options.filter((o) => o.option_text.trim())
      await createQuestion({
        group_id: groupId,
        question_text: questionText,
        difficulty,
        explanation,
        source_reference: sourceRef,
        media_url: mediaUrl,
        media_public_id: mediaPublicId,
        media_type: mediaType,
        options: filled,
      })
      setQuestionText('')
      setExplanation('')
      setSourceRef('')
      setMediaUrl(null)
      setMediaPublicId(null)
      setMediaType(null)
      setOptions([
        { option_text: '', is_correct: true },
        { option_text: '', is_correct: false },
        { option_text: '', is_correct: false },
        { option_text: '', is_correct: false },
      ])
      setShowForm(false)
      await load()
    } catch (e: any) {
      setError(e.message || 'فشل حفظ السؤال')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(q: Question) {
    try {
      await updateQuestion(q.id, { is_active: !q.is_active })
      await load()
    } catch (e: any) {
      setError(e.message || 'فشل التحديث')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-slate-900">إدارة الأسئلة</h1>
        <div className="flex gap-2">
          <select
            value={filterGroup}
            onChange={(e) => setFilterGroup(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-xl text-sm"
          >
            <option value="">كل المجموعات</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700"
          >
            {showForm ? 'إلغاء' : 'سؤال جديد'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-2xl p-5 mb-8 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              required
              className="px-4 py-2.5 border border-slate-300 rounded-xl"
            >
              {groups.filter((g) => g.is_active).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as any)}
              className="px-4 py-2.5 border border-slate-300 rounded-xl"
            >
              <option value="easy">سهل</option>
              <option value="medium">متوسط</option>
              <option value="hard">صعب</option>
            </select>
          </div>

          <textarea
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            placeholder="نص السؤال..."
            required
            rows={3}
            className="w-full px-4 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-red-500"
          />

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">صورة أو صوت (Cloudinary — اختياري)</p>
            <input
              type="file"
              accept="image/*,audio/*"
              onChange={handleFile}
              disabled={uploading}
              className="block w-full text-sm text-slate-600"
            />
            {uploading && <p className="text-xs text-slate-500">جاري الرفع...</p>}
            {mediaUrl && mediaType === 'image' && (
              <img src={mediaUrl} alt="" className="max-h-40 rounded-xl border border-slate-200" />
            )}
            {mediaUrl && mediaType === 'audio' && (
              <audio controls src={mediaUrl} className="w-full" />
            )}
            {mediaUrl && (
              <button
                type="button"
                onClick={() => {
                  setMediaUrl(null)
                  setMediaPublicId(null)
                  setMediaType(null)
                }}
                className="text-xs text-red-600"
              >
                إزالة الوسائط
              </button>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">الاختيارات (اختر الصحيحة)</p>
            {options.map((o, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <input
                  type="radio"
                  name="correct"
                  checked={o.is_correct}
                  onChange={() => setCorrect(idx)}
                  className="accent-red-600"
                />
                <input
                  value={o.option_text}
                  onChange={(e) =>
                    setOptions((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, option_text: e.target.value } : x))
                    )
                  }
                  placeholder={`خيار ${idx + 1}`}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
            ))}
          </div>

          <input
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="شرح مختصر (اختياري)"
            className="w-full px-4 py-2.5 border border-slate-300 rounded-xl"
          />
          <input
            value={sourceRef}
            onChange={(e) => setSourceRef(e.target.value)}
            placeholder="المرجع / المصدر (اختياري)"
            className="w-full px-4 py-2.5 border border-slate-300 rounded-xl"
          />

          <button
            type="submit"
            disabled={saving || uploading}
            className="px-6 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? 'جاري الحفظ...' : 'حفظ السؤال'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-slate-500">جاري التحميل...</p>
      ) : questions.length === 0 ? (
        <p className="text-slate-500">لا توجد أسئلة بعد. أضف أول سؤال.</p>
      ) : (
        <div className="space-y-3">
          {questions.map((q) => (
            <div
              key={q.id}
              className="bg-white border border-slate-200 rounded-2xl p-4 flex justify-between gap-4"
            >
              <div className="flex gap-3 min-w-0">
                {q.media_url && q.media_type === 'image' && (
                  <img
                    src={q.media_url}
                    alt=""
                    className="w-16 h-16 object-cover rounded-lg shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{q.question_text}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {q.difficulty} · {q.question_options?.length || 0} خيارات ·{' '}
                    {q.media_type ? `${q.media_type} · ` : ''}
                    {q.is_active ? 'نشط' : 'معطل'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => toggleActive(q)}
                className="text-xs text-red-600 hover:underline whitespace-nowrap"
              >
                {q.is_active ? 'تعطيل' : 'تفعيل'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
