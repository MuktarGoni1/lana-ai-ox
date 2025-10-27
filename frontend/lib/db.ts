import { createClient } from '@supabase/supabase-js'

// DEBUG: Print environment variables to console
console.log('SUPABASE URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('SUPABASE KEY:', Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY));

// Get environment variables with fallback
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[db] Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)