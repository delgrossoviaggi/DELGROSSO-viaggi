import { supabase } from '../js/supabase.js';

export async function getPublicConfirmation(bookingId, token) {
  const { data, error } = await supabase.rpc('get_public_confirmation', {
    p_booking_id: bookingId,
    p_token: token
  });
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}
