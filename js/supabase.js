// Copiare questo file in /js/supabase.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const SUPABASE_URL = 'https://exphxbeqwpwrsigdmilc.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_jEq6R22qxk2SHGI5YEmEow_SfZG7j8c';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});
