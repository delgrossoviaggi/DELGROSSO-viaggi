-- Eseguire una sola volta in Supabase SQL Editor, PRIMA di usare la data redazione modificabile.
ALTER TABLE public.preventivi ADD COLUMN IF NOT EXISTS data_redazione date;
UPDATE public.preventivi SET data_redazione = (created_at AT TIME ZONE 'Europe/Rome')::date WHERE data_redazione IS NULL AND created_at IS NOT NULL;
