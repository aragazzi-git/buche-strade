-- ============================================================
-- BUCHE STRADE — Schema Supabase v2
-- Esegui questo intero script nell'SQL Editor di Supabase
-- Dashboard Supabase → SQL Editor → New query → incolla → Run
-- ============================================================

-- 1. Tabella profili utente (estende auth.users di Supabase)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  nome text,
  role text not null default 'user' check (role in ('user', 'supervisor', 'admin')),
  created_at timestamptz default now()
);

-- Trigger: crea automaticamente un profilo quando un utente si registra
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, nome, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'user'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Tabella segnalazioni
create table if not exists public.segnalazioni (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  lat double precision not null,
  lng double precision not null,
  address text not null,
  pericolosita text not null check (pericolosita in ('bassa', 'media', 'alta', 'critica')),
  stato text not null default 'segnalata' check (stato in ('segnalata', 'in_lavorazione', 'risolta', 'rifiutata')),
  descrizione text,
  foto_url text,
  foto_validata boolean default false,
  note_comune text,
  segnalante_nome text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Trigger: aggiorna updated_at automaticamente
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists on_segnalazione_updated on public.segnalazioni;
create trigger on_segnalazione_updated
  before update on public.segnalazioni
  for each row execute procedure public.handle_updated_at();

-- 3. Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.segnalazioni enable row level security;

-- Elimina policy esistenti per ricrearle pulite
drop policy if exists "Profilo personale" on public.profiles;
drop policy if exists "Aggiorna profilo personale" on public.profiles;
drop policy if exists "Admin vede tutti i profili" on public.profiles;
drop policy if exists "Cittadino vede validate e proprie" on public.segnalazioni;
drop policy if exists "Inserisci segnalazione" on public.segnalazioni;
drop policy if exists "Admin aggiorna segnalazioni" on public.segnalazioni;
drop policy if exists "Admin elimina segnalazioni" on public.segnalazioni;

-- PROFILES
create policy "Profilo personale" on public.profiles
  for select using (auth.uid() = id);

create policy "Aggiorna profilo personale" on public.profiles
  for update using (auth.uid() = id);

create policy "Admin vede tutti i profili" on public.profiles
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'supervisor'))
  );

-- SEGNALAZIONI
create policy "Cittadino vede validate e proprie" on public.segnalazioni
  for select using (
    foto_validata = true
    or user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'supervisor'))
  );

create policy "Inserisci segnalazione" on public.segnalazioni
  for insert with check (auth.uid() is not null);

create policy "Admin aggiorna segnalazioni" on public.segnalazioni
  for update using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'supervisor'))
  );

create policy "Admin elimina segnalazioni" on public.segnalazioni
  for delete using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- 4. Storage bucket per le foto
insert into storage.buckets (id, name, public)
values ('foto-buche', 'foto-buche', true)
on conflict (id) do nothing;

-- Policy storage
drop policy if exists "Foto pubbliche" on storage.objects;
drop policy if exists "Upload foto autenticati" on storage.objects;
drop policy if exists "Elimina proprie foto" on storage.objects;

create policy "Foto pubbliche" on storage.objects
  for select using (bucket_id = 'foto-buche');

create policy "Upload foto autenticati" on storage.objects
  for insert with check (
    bucket_id = 'foto-buche' and auth.uid() is not null
  );

create policy "Elimina proprie foto" on storage.objects
  for delete using (
    bucket_id = 'foto-buche' and (
      auth.uid()::text = (storage.foldername(name))[1]
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    )
  );

-- ============================================================
-- DOPO LA REGISTRAZIONE: promuovi il tuo account ad admin
-- Registrati nell'app, poi esegui qui:
--
--   update public.profiles set role = 'admin' where email = 'TUA@EMAIL.COM';
--
-- Per aggiungere un supervisor:
--   update public.profiles set role = 'supervisor' where email = 'ALTRO@EMAIL.COM';
-- ============================================================
