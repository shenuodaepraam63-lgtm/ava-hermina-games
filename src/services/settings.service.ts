import { supabase } from '../lib/supabase'

export type DifficultySlot = {
  difficulty: 'easy' | 'medium' | 'hard'
  count: number
}

export type AbqarinoSettings = {
  question_time_seconds: number
  points_per_correct_answer: number
  winning_score: number
  questions_per_round: number
  shuffle_questions: boolean
  allow_repeated_players: boolean
  show_correct_answer_after_response: boolean
  show_explanation_after_response: boolean
  enable_sound_effects: boolean
  default_difficulty: string
  selection_mode: string
  /** ترتيب الصعوبة في الجولة: مثلاً 3 صعب ثم 3 سهل ثم 4 متوسط */
  difficulty_plan?: DifficultySlot[]
}

export type GameSettingsRow = {
  id: string
  game_id: string
  settings: AbqarinoSettings
  version: number
  updated_at: string
}

export async function getGameBySlug(slug: string) {
  const { data, error } = await supabase.from('games').select('*').eq('slug', slug).single()
  if (error) throw error
  return data as { id: string; slug: string; name: string; engine_key: string }
}

export async function getSettings(gameId: string) {
  const { data, error } = await supabase
    .from('game_settings')
    .select('*')
    .eq('game_id', gameId)
    .single()

  if (error) throw error
  return data as GameSettingsRow
}

export async function updateSettings(gameId: string, settings: Partial<AbqarinoSettings>) {
  const current = await getSettings(gameId)
  const merged = { ...current.settings, ...settings }

  if (merged.question_time_seconds <= 0) {
    throw new Error('وقت السؤال يجب أن يكون أكبر من صفر')
  }
  if (merged.winning_score <= 0) {
    throw new Error('نقاط الفوز يجب أن تكون أكبر من صفر')
  }

  // مزامنة questions_per_round مع مجموع difficulty_plan
  if (merged.difficulty_plan && merged.difficulty_plan.length > 0) {
    merged.questions_per_round = merged.difficulty_plan.reduce((s, x) => s + Math.max(0, x.count || 0), 0)
  }

  const { data, error } = await supabase
    .from('game_settings')
    .update({
      settings: merged,
      version: current.version + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('game_id', gameId)
    .select()
    .single()

  if (error) throw error
  return data as GameSettingsRow
}
