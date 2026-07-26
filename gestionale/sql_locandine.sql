CREATE TABLE IF NOT EXISTS public.locandine(
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
titolo text,
url text,
created_at timestamp with time zone default now()
);

ALTER TABLE public.locandine ENABLE ROW LEVEL SECURITY;
