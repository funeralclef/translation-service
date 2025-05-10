import { createClient } from "@supabase/supabase-js"

// Create a single supabase client for the browser
let supabaseClient: ReturnType<typeof createClient> | null = null

export const createClientComponentClient = () => {
  if (supabaseClient) return supabaseClient

  supabaseClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

  return supabaseClient
}
