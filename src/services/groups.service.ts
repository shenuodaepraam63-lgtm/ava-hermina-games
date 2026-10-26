import { supabase } from '../lib/supabase'

export type QuestionGroup = {
  id: string
  game_id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  cover_image_url: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\u0600-\u06FFa-z0-9-]/g, '')
}

export async function listGroups(gameId?: string, activeOnly = false) {
  let query = supabase
    .from('question_groups')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (gameId) query = query.eq('game_id', gameId)
  if (activeOnly) query = query.eq('is_active', true)

  const { data, error } = await query
  if (error) throw error
  return data as QuestionGroup[]
}

export async function createGroup(input: {
  game_id: string
  name: string
  description?: string
  icon?: string
}) {
  const slug = slugify(input.name) || `group-${Date.now()}`
  const { data, error } = await supabase
    .from('question_groups')
    .insert({
      game_id: input.game_id,
      name: input.name.trim(),
      slug,
      description: input.description?.trim() || null,
      icon: input.icon || null,
    })
    .select()
    .single()

  if (error) throw error
  return data as QuestionGroup
}

export async function updateGroup(
  id: string,
  updates: Partial<Pick<QuestionGroup, 'name' | 'description' | 'icon' | 'is_active' | 'sort_order' | 'cover_image_url'>>
) {
  const payload: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() }
  if (updates.name) {
    payload.slug = slugify(updates.name) || undefined
  }
  const { data, error } = await supabase
    .from('question_groups')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as QuestionGroup
}
