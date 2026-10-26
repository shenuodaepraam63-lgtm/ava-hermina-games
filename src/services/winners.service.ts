import { supabase } from '../lib/supabase'

export type GameWinner = {
  id: string
  game_id: string
  session_id: string | null
  roster_player_id: string | null
  player_name: string
  score: number
  created_at: string
}

export async function listWinners(gameId?: string, limit = 50) {
  let q = supabase
    .from('game_winners')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (gameId) q = q.eq('game_id', gameId)
  const { data, error } = await q
  if (error) throw error
  return (data || []) as GameWinner[]
}
