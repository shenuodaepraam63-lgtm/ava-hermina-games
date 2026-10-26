import { supabase } from '../lib/supabase'

export type Player = {
  id: string
  display_name: string
  is_active: boolean
  sort_order: number
  notes: string | null
  created_at: string
  updated_at: string
}

export async function listPlayers(activeOnly = false) {
  let query = supabase
    .from('player_roster')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('display_name', { ascending: true })

  if (activeOnly) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query
  if (error) throw error
  return data as Player[]
}

export async function createPlayer(displayName: string, notes?: string) {
  const { data, error } = await supabase
    .from('player_roster')
    .insert({
      display_name: displayName.trim(),
      notes: notes?.trim() || null,
    })
    .select()
    .single()

  if (error) throw error
  return data as Player
}

export async function createManyPlayers(names: string[]) {
  const rows = names
    .map((n) => n.trim())
    .filter(Boolean)
    .map((display_name) => ({ display_name }))

  if (rows.length === 0) return []

  const { data, error } = await supabase
    .from('player_roster')
    .insert(rows)
    .select()

  if (error) throw error
  return data as Player[]
}

export async function updatePlayer(
  id: string,
  updates: Partial<Pick<Player, 'display_name' | 'is_active' | 'sort_order' | 'notes'>>
) {
  const { data, error } = await supabase
    .from('player_roster')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Player
}

export async function deactivatePlayer(id: string) {
  return updatePlayer(id, { is_active: false })
}
