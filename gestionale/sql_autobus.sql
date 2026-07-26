CREATE TABLE IF NOT EXISTS public.autobus(
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
nome text,
tipo text,
posti_totali integer,
created_at timestamp with time zone default now()
);
