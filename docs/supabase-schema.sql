-- ============================================================
-- Elendheim Games — Supabase schema
-- Run this in your Supabase project: SQL Editor → New query → paste → Run.
-- Then enable anonymous sign-ins: Authentication → Providers → Anonymous → ON.
-- ============================================================

-- 1) PROFILES ------------------------------------------------
-- One row per player. id matches the Supabase auth user id
-- (works for anonymous users too; they upgrade to a real
-- account later without changing this id).
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  name         text not null default 'Player' check (char_length(name) <= 16),
  avatar_color text not null default '#f5a623',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 2) GAME STATS ----------------------------------------------
-- One row per (player, game). Holds everything the local
-- storage layer already tracks.
create table if not exists public.game_stats (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  game_id      text not null,
  high_score   integer not null default 0,
  wins         integer not null default 0,
  best_streak  integer not null default 0,
  best_time_ms integer,
  plays        integer not null default 0,
  updated_at   timestamptz not null default now(),
  primary key (user_id, game_id)
);

-- 3) LEADERBOARD ---------------------------------------------
-- Public, read-only view joining stats to profile names.
-- security_invoker = on makes the view run with the *querying* user's
-- permissions and RLS (not the creator's), which is the safe default.
create or replace view public.leaderboard
  with (security_invoker = on) as
  select s.game_id,
         s.user_id,
         p.name,
         p.avatar_color,
         s.high_score,
         s.wins,
         s.best_streak,
         s.best_time_ms,
         s.plays
  from public.game_stats s
  join public.profiles p on p.id = s.user_id;

-- 4) ROW-LEVEL SECURITY --------------------------------------
-- Anyone may READ profiles + stats (for leaderboards),
-- but you may only WRITE your own rows.
alter table public.profiles  enable row level security;
alter table public.game_stats enable row level security;

create policy "profiles are readable by everyone"
  on public.profiles for select using (true);
create policy "you can insert your own profile"
  on public.profiles for insert with check (auth.uid() = id);
create policy "you can update your own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "stats are readable by everyone"
  on public.game_stats for select using (true);
create policy "you can upsert your own stats"
  on public.game_stats for insert with check (auth.uid() = user_id);
create policy "you can update your own stats"
  on public.game_stats for update using (auth.uid() = user_id);

-- 5) keep updated_at fresh -----------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger profiles_touch   before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger game_stats_touch before update on public.game_stats
  for each row execute function public.touch_updated_at();
