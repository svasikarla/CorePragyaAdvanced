
import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Use createBrowserClient so sessions are stored in cookies,
// making them readable by server components via createServerClient.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)
