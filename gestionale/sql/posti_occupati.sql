CREATE TABLE IF NOT EXISTS public.posti_occupati(
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
viaggio_id uuid,
prenotazione_id uuid,
posto text,
created_at timestamp with time zone default now()
);

ALTER TABLE public.posti_occupati ENABLE ROW LEVEL SECURITY;
