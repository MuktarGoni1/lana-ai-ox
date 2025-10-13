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
      // eslint-disable-next-line no-console
      console.warn(`[env] Missing environment variables: ${missingKeys}`)
    }
  }

  // Validate URL formats for production safety
  if (env.SUPABASE_URL && !/^https:\/\//.test(env.SUPABASE_URL)) {
    if (isProd) {
      throw new Error('SUPABASE_URL must use HTTPS in production')
    } else {
      // eslint-disable-next-line no-console
      console.warn('[env] SUPABASE_URL should use HTTPS in production')
    }
  }

  if (env.API_BASE && !/^https?:\/\/.+/.test(env.API_BASE)) {
    if (isProd) {
      throw new Error('NEXT_PUBLIC_API_BASE must be a valid URL')
    } else {
      // eslint-disable-next-line no-console
      console.warn('[env] NEXT_PUBLIC_API_BASE should be a valid URL')
    }
  }

  return true
}

// Call validation on module load (client-side only to avoid SSR crashes)
if (typeof window !== 'undefined') {
  validateEnv()
}