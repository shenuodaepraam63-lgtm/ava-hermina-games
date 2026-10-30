import { supabase } from '../../lib/supabase'
import { sfx } from '../../lib/sounds'

export type OptionSnap = { id: string; option_text: string; sort_order?: number }

export async function fetchCorrectOptionId(
  questionId: string | null | undefined,
  fallbackId?: string | null
): Promise<string | null> {
  if (fallbackId) return fallbackId
  if (!questionId) return null
  try {
    const { data, error } = await supabase
      .from('question_options')
      .select('id, is_correct')
      .eq('question_id', questionId)
    if (error || !data) return null
    const hit = data.find((o: { is_correct?: boolean }) => o.is_correct)
    return (hit as { id: string } | undefined)?.id || null
  } catch {
    return null
  }
}

/** 80% الإجابة الصحيحة، 20% إجابة خاطئة */
export function pickFriendSuggestion(
  opts: OptionSnap[],
  correctId: string | null
): string {
  if (!opts.length) return '—'
  const correct = correctId ? opts.find((o) => o.id === correctId) : undefined
  const wrong = opts.filter((o) => o.id !== correctId)
  if (correct && Math.random() < 0.8) {
    return correct.option_text
  }
  if (wrong.length) {
    return wrong[Math.floor(Math.random() * wrong.length)].option_text
  }
  return (correct || opts[0]).option_text
}

export function buildAudiencePoll(
  opts: OptionSnap[],
  correctId: string | null
): { id: string; text: string; pct: number }[] {
  if (!opts.length) return []
  let weights = opts.map(() => 8 + Math.random() * 18)
  if (correctId) {
    const idx = opts.findIndex((o) => o.id === correctId)
    if (idx >= 0) weights[idx] = 42 + Math.random() * 28
  }
  const sum = weights.reduce((a, b) => a + b, 0) || 1
  let pcts = weights.map((w) => Math.round((w / sum) * 100))
  const diff = 100 - pcts.reduce((a, b) => a + b, 0)
  if (pcts.length) pcts[0] += diff
  return opts.map((o, i) => ({
    id: o.id,
    text: o.option_text,
    pct: Math.max(0, pcts[i] || 0),
  }))
}

export function playFriendSfx() {
  sfx.revealAnswer()
}

export function playAudienceSfx() {
  sfx.crowd()
}
