create table if not exists public.vault_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  wrapped_vault_key jsonb not null,
  kdf jsonb not null,
  settings jsonb not null default '{}'::jsonb,
  device_id text not null,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.vault_entries (
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_id text not null,
  envelope jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text not null,
  primary key (user_id, entry_id)
);

create table if not exists public.vault_deletes (
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_id text not null,
  deleted_at timestamptz not null,
  device_id text not null,
  primary key (user_id, entry_id)
);

alter table public.vault_profiles enable row level security;
alter table public.vault_entries enable row level security;
alter table public.vault_deletes enable row level security;

create policy "vault profiles are owner scoped"
on public.vault_profiles
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "vault entries are owner scoped"
on public.vault_entries
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "vault deletes are owner scoped"
on public.vault_deletes
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
