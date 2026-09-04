-- DELGROSSO VIAGGI - token di conferma e stato invio WhatsApp/SMS
ALTER TABLE public.prenotazioni
  ADD COLUMN IF NOT EXISTS confirmation_token text,
  ADD COLUMN IF NOT EXISTS notification_channel text,
  ADD COLUMN IF NOT EXISTS notification_status text,
  ADD COLUMN IF NOT EXISTS notification_message_sid text,
  ADD COLUMN IF NOT EXISTS notification_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS notification_attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS notification_error text;

CREATE UNIQUE INDEX IF NOT EXISTS prenotazioni_confirmation_token_unique
  ON public.prenotazioni (confirmation_token)
  WHERE confirmation_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS prenotazioni_notification_status_idx
  ON public.prenotazioni (notification_status);
