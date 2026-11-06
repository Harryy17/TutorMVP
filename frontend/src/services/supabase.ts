import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://podzeuinowjbsvxtpovc.supabase.co'
).trim()

const supabaseKey = (
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_KjlCDt5LADGg95HIkgBniA_vzAlXD2v'
).trim()

export const supabase = createClient(supabaseUrl, supabaseKey)

