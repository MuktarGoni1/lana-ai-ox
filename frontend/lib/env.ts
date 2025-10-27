// Environment variable validation
export const env = {
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NODE_ENV: process.env.NODE_ENV,
  API_BASE: process.env.NEXT_PUBLIC_API_BASE,
} as const

// Validate required environment variables
export function validateEnv() {
  const isProd = process.env.NODE_ENV === 'production'
  const required = [
    { key: 'NEXT_PUBLIC_SUPABASE_URL', value: env.SUPABASE_URL },
    { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', value: env.SUPABASE_ANON_KEY },
  ]

  const missing = required.filter(({ value }) => !value)
  
  if (missing.length > 0) {
    const missingKeys = missing.map(({ key }) => key).join(', ')
    if (isProd) {
      throw new Error(`Missing required environment variables: ${missingKeys}`)
    } else {
      // Development: warn instead of crash
      if (typeof console !== 'undefined') {
        console.warn(`[env] Missing environment variables: ${missingKeys}`)
      }
    }
  }

  return true
}

// Only validate on client side to avoid SSR issues
if (typeof window !== 'undefined') {
  try {
    validateEnv()
  } catch (error) {
    if (typeof console !== 'undefined') {
      console.error('[env] Validation error:', error)
    }
  }
}