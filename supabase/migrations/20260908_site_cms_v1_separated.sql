-- DELGROSSO SITE CMS v1
-- Applied to: https://bhsanrbadsqcpbtxupmr.supabase.co
-- This migration is for SITE CONTENT ONLY. It does not modify GESTIONALE tables.

create extension if not exists pgcrypto;

create table if not exists public.site_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_site_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.site_admins where user_id = auth.uid()); $$;
revoke all on function public.is_site_admin() from public;
grant execute on function public.is_site_admin() to authenticated;

create table if not exists public.site_carousel_viaggi (
  id uuid primary key default gen_random_uuid(), title text, subtitle text,
  image_url text not null, link_url text, published boolean not null default true,
  sort_order integer not null default 0, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.site_posts (
  id uuid primary key default gen_random_uuid(), title text not null, excerpt text, body text,
  cover_url text, category text not null default 'News', published boolean not null default false,
  published_at timestamptz, sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.site_party_events (
  id uuid primary key default gen_random_uuid(), title text not null, event_date date,
  description text, cover_url text, gallery_urls jsonb not null default '[]'::jsonb,
  published boolean not null default true, sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create or replace function public.site_touch_updated_at()
returns trigger language plpgsql set search_path = public
as $$ begin new.updated_at = now(); return new; end; $$;

drop trigger if exists site_carousel_viaggi_touch on public.site_carousel_viaggi;
create trigger site_carousel_viaggi_touch before update on public.site_carousel_viaggi for each row execute function public.site_touch_updated_at();
drop trigger if exists site_posts_touch on public.site_posts;
create trigger site_posts_touch before update on public.site_posts for each row execute function public.site_touch_updated_at();
drop trigger if exists site_party_events_touch on public.site_party_events;
create trigger site_party_events_touch before update on public.site_party_events for each row execute function public.site_touch_updated_at();

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('site-media','site-media',true,15728640,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public=true,file_size_limit=15728640,allowed_mime_types=array['image/jpeg','image/png','image/webp','image/gif'];

alter table public.site_admins enable row level security;
alter table public.site_carousel_viaggi enable row level security;
alter table public.site_posts enable row level security;
alter table public.site_party_events enable row level security;

drop policy if exists site_carousel_viaggi_public_read on public.site_carousel_viaggi;
create policy site_carousel_viaggi_public_read on public.site_carousel_viaggi for select to public using (published=true);
drop policy if exists site_carousel_viaggi_admin_all on public.site_carousel_viaggi;
create policy site_carousel_viaggi_admin_all on public.site_carousel_viaggi for all to authenticated using (public.is_site_admin()) with check (public.is_site_admin());

drop policy if exists site_posts_public_read on public.site_posts;
create policy site_posts_public_read on public.site_posts for select to public using (published=true);
drop policy if exists site_posts_admin_all on public.site_posts;
create policy site_posts_admin_all on public.site_posts for all to authenticated using (public.is_site_admin()) with check (public.is_site_admin());

drop policy if exists site_party_events_public_read on public.site_party_events;
create policy site_party_events_public_read on public.site_party_events for select to public using (published=true);
drop policy if exists site_party_events_admin_all on public.site_party_events;
create policy site_party_events_admin_all on public.site_party_events for all to authenticated using (public.is_site_admin()) with check (public.is_site_admin());

drop policy if exists site_admins_self_read on public.site_admins;
create policy site_admins_self_read on public.site_admins for select to authenticated using (user_id=auth.uid());

-- Existing site content tables: anonymous writes are removed; only site admins may write.
drop policy if exists carousel_home_public_write on public.carousel_home;
drop policy if exists carousel_flotta_public_write on public.carousel_flotta;
drop policy if exists flotta_public_write on public.flotta_page;
drop policy if exists gallery_eventi_public_write on public.gallery_eventi;
drop policy if exists site_fleet_admin_all on public.site_fleet;
drop policy if exists site_media_admin_delete on public.site_media;
drop policy if exists site_media_admin_insert on public.site_media;
drop policy if exists site_media_admin_update on public.site_media;
drop policy if exists site_settings_admin_all on public.site_settings;
create policy carousel_home_site_admin_write on public.carousel_home for all to authenticated using (public.is_site_admin()) with check (public.is_site_admin());
create policy carousel_flotta_site_admin_write on public.carousel_flotta for all to authenticated using (public.is_site_admin()) with check (public.is_site_admin());
create policy flotta_page_site_admin_write on public.flotta_page for all to authenticated using (public.is_site_admin()) with check (public.is_site_admin());
create policy gallery_eventi_site_admin_write on public.gallery_eventi for all to authenticated using (public.is_site_admin()) with check (public.is_site_admin());
create policy site_fleet_site_admin_write on public.site_fleet for all to authenticated using (public.is_site_admin()) with check (public.is_site_admin());
create policy site_media_site_admin_write on public.site_media for all to authenticated using (public.is_site_admin()) with check (public.is_site_admin());
create policy site_settings_site_admin_write on public.site_settings for all to authenticated using (public.is_site_admin()) with check (public.is_site_admin());

-- Storage: public can view media; only site admins can change it.
drop policy if exists site_media_public_read on storage.objects;
create policy site_media_public_read on storage.objects for select to public using (bucket_id='site-media');
drop policy if exists site_media_admin_insert on storage.objects;
create policy site_media_admin_insert on storage.objects for insert to authenticated with check (bucket_id='site-media' and public.is_site_admin());
drop policy if exists site_media_admin_update on storage.objects;
create policy site_media_admin_update on storage.objects for update to authenticated using (bucket_id='site-media' and public.is_site_admin()) with check (bucket_id='site-media' and public.is_site_admin());
drop policy if exists site_media_admin_delete on storage.objects;
create policy site_media_admin_delete on storage.objects for delete to authenticated using (bucket_id='site-media' and public.is_site_admin());

create index if not exists idx_site_carousel_viaggi_published_order on public.site_carousel_viaggi(published,sort_order);
create index if not exists idx_site_posts_published_date on public.site_posts(published,published_at desc,sort_order);
create index if not exists idx_site_party_events_published_order on public.site_party_events(published,sort_order);
