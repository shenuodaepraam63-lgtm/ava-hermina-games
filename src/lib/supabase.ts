import { createClient } from '@supabase/supabase-js'
import { env } from './env'

// Note: Types will be generated later from Supabase schema
export const supabase = createClient(
  env.supabaseUrl || '',
  env.supabasePublishableKey || ''
)
