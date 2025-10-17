-- Supabase SQL — Tablas y RLS para NebulaKeys
-- Ejecuta esto en el SQL editor de tu proyecto Supabase.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  stripe_customer_id text unique
);

create table if not exists public.subscriptions (
  subscription_id text primary key,
  user_id uuid references public.profiles(user_id) on delete cascade,
  status text,
  price_id text,
  current_period_end timestamp with time zone,
  cancel_at timestamp with time zone
);

create table if not exists public.wishlists (
  id bigserial primary key,
  user_id uuid references public.profiles(user_id) on delete cascade,
  game_id text not null,
  created_at timestamp with time zone default now()
);

create table if not exists public.shipments (
  id bigserial primary key,
  user_id uuid references public.profiles(user_id) on delete cascade,
  address text,
  status text default 'pending',
  created_at timestamp with time zone default now()
);

create table if not exists public.rotations (
  id bigserial primary key,
  user_id uuid references public.profiles(user_id) on delete cascade,
  period_start date not null,
  period_end date not null,
  notes text
);

-- RLS
alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.wishlists enable row level security;
alter table public.shipments enable row level security;
alter table public.rotations enable row level security;

-- Policies: cada usuario solo ve/gestiona lo suyo
create policy "select own profile" on public.profiles for select using ( user_id = auth.uid() );
create policy "update own profile" on public.profiles for update using ( user_id = auth.uid() );

create policy "select own subs" on public.subscriptions for select using ( user_id = auth.uid() );

create policy "wishlist ins own" on public.wishlists for insert with check ( user_id = auth.uid() );
create policy "wishlist own" on public.wishlists for select using ( user_id = auth.uid() );
create policy "wishlist del own" on public.wishlists for delete using ( user_id = auth.uid() );

create policy "shipments own" on public.shipments for all using ( user_id = auth.uid() ) with check ( user_id = auth.uid() );
create policy "rotations own" on public.rotations for all using ( user_id = auth.uid() ) with check ( user_id = auth.uid() );
