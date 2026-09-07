import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Supabase DEL GROSSO GESTIONALE
export const SUPABASE_URL = 'https://chkuayhbmitdmzmmvona.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_H29K1BV5ZE1rT8xo0PIzVA_wF6zC7je';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});
