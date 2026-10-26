import { supabase } from '../lib/supabase'

export type QuestionOption = {
  id: string
  question_id: string
  option_text: string
  sort_order: number
  is_correct: boolean
  created_at: string
}

export type Question = {
  id: string
  group_id: string
  question_text: string
  question_type: 'multiple_choice' | 'true_false'
  difficulty: 'easy' | 'medium' | 'hard'
  explanation: string | null
  source_reference: string | null
  media_url: string | null
  media_public_id: string | null
  media_type: 'image' | 'audio' | null
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
  question_options?: QuestionOption[]
}

export async function listQuestions(groupId?: string, activeOnly = false) {
  let query = supabase
    .from('questions')
    .select('*, question_options(*)')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (groupId) query = query.eq('group_id', groupId)
  if (activeOnly) query = query.eq('is_active', true)

  const { data, error } = await query
  if (error) throw error
  return data as Question[]
}

export type CreateQuestionInput = {
  group_id: string
  question_text: string
  question_type?: 'multiple_choice' | 'true_false'
  difficulty?: 'easy' | 'medium' | 'hard'
  explanation?: string
  source_reference?: string
  options: { option_text: string; is_correct: boolean }[]
}

export async function createQuestion(input: CreateQuestionInput) {
  const correctCount = input.options.filter((o) => o.is_correct).length
  if (correctCount !== 1) {
    throw new Error('يجب تحديد إجابة صحيحة واحدة فقط')
  }
  if (input.options.length < 2) {
    throw new Error('يجب إضافة خيارين على الأقل')
  }

  const { data: question, error } = await supabase
    .from('questions')
    .insert({
      group_id: input.group_id,
      question_text: input.question_text.trim(),
      question_type: input.question_type || 'multiple_choice',
      difficulty: input.difficulty || 'medium',
      explanation: input.explanation?.trim() || null,
      source_reference: input.source_reference?.trim() || null,
    })
    .select()
    .single()

  if (error) throw error

  const optionsRows = input.options.map((o, idx) => ({
    question_id: question.id,
    option_text: o.option_text.trim(),
    is_correct: o.is_correct,
    sort_order: idx,
  }))

  const { error: optError } = await supabase.from('question_options').insert(optionsRows)
  if (optError) throw optError

  return question as Question
}

export async function updateQuestion(
  id: string,
  updates: Partial<
    Pick<
      Question,
      | 'question_text'
      | 'difficulty'
      | 'explanation'
      | 'source_reference'
      | 'is_active'
      | 'sort_order'
      | 'group_id'
    >
  >
) {
  const { data, error } = await supabase
    .from('questions')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Question
}

export async function deactivateQuestion(id: string) {
  return updateQuestion(id, { is_active: false })
}
