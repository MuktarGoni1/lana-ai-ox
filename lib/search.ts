import { supabase } from './db'

export async function saveSearch(title: string) {
  try {
    // Get the current user's session
    const { data: sessionData } = await supabase.auth.getSession()
    const uid = sessionData.session?.user?.id
    
    // ONLY save search history for properly authenticated users
    // No fallback authentication - search history is a registered user feature
    if (!uid) {
      return {
        success: false,
        message: 'Search completed! To save your search history, please register or sign in.',
        suggestion: true
      }
    }
    
    // Production-safe logging
    if (process.env.NODE_ENV === 'development') {
      console.log('[saveSearch] inserting:', title)
    }

    const { data, error } = await supabase
      .from('searches')
      .insert({ uid: uid, title, created_at: new Date().toISOString() })

    if (process.env.NODE_ENV === 'development') {
      console.log('[saveSearch] supabase reply:', { ok: !!data, error: error?.message })
    }

    if (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('❌ saveSearch error:', error.message)
      }
      
      // Handle specific database errors
      if (error.code === 'PGRST301') {
        return {
          success: false,
          message: 'Database connection error. Search completed but not saved.',
          suggestion: false
        }
      } else if (error.code === '23505') {
        return {
          success: true,
          message: 'Search completed and already in your history!',
          suggestion: false
        }
      } else {
        return {
          success: false,
          message: `Search completed but couldn't be saved: ${error.message}`,
          suggestion: false
        }
      }
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ saveSearch success')
      }
      return {
        success: true,
        message: 'Search saved to your history!',
        suggestion: false
      }
    }
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ saveSearch exception:', error)
    }
    return {
      success: false,
      message: 'Search completed but couldn\'t be saved due to an error.',
      suggestion: false
    }
  }
}