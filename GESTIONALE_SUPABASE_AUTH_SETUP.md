DELGROSSO VIAGGI - Supabase Gestionale Auth bridge

The Gestionale operational tables remain in Supabase project chkuayhbmitdmzmmvona. Public website bookings continue to use create_public_booking and write directly to public.prenotazioni.

The Gestionale login now establishes a Supabase Auth session before loading the dashboard. The Supabase project must contain these two Auth users:
- nicola@delgrossoviaggi.it
- raffaele@delgrossoviaggi.it

Password for the existing local accounts remains the same: Delgrosso@26.

After deployment, log out and log in again in the Gestionale so the Supabase Auth session is created. RLS policies on prenotazioni/viaggi/etc. remain restricted to authenticated users.

IMPORTANT: change the default Gestionale password after migration; the old local authentication bundle previously contained the default password client-side.
