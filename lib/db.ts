import { createClient } from '@supabase/supabase-js'
import { env } from './env'

const url = env.SUPABASE_URL!
const key = env.SUPABASE_ANON_KEY!

export const supabase = createClient(url, key)