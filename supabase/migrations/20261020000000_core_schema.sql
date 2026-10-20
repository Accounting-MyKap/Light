-- Core schema for syncing results: catalog of games, results and daily completions.
-- Row-level security is on for every table; results are immutable (no update grant or policy).

create table public.games (
  id        text primary key,
  area      text not null check (area in
              ('memory','attention','speed','flexibility','math','logic','language')),
  max_score integer not null check (max_score > 0)  -- theoretical bound; anything above it is rejected
);

create table public.results (
  id          uuid primary key,                       -- generated on the device
  user_id     uuid not null default auth.uid()
              references auth.users on delete cascade,
  game_id     text not null references public.games,
  level       smallint not null check (level between 1 and 10),
  score       integer not null check (score >= 0),
  accuracy    real not null check (accuracy between 0 and 1),
  -- up to 1 hour, so a long Sequence Lights game with pauses is not rejected
  duration_ms integer not null check (duration_ms between 5000 and 3600000),
  is_daily    boolean not null default false,
  played_at   timestamptz not null,
  created_at  timestamptz not null default now()
);
create index on public.results (game_id, played_at);
create index on public.results (user_id, played_at);

create table public.daily_completions (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  day     date not null,          -- local date on the device
  games   text[] not null,
  primary key (user_id, day)
);

-- Table privileges -----------------------------------------------------------

-- Hosted projects created since 2026-05-30 no longer grant anything on new public tables to the API roles,
-- while the local stack still does. Revoking first makes local behave like hosted; then grant exactly what
-- the app needs. Row-level security below still decides which rows each role reaches.
revoke all on public.games, public.results, public.daily_completions from anon, authenticated, service_role;
grant select on public.games to anon, authenticated;
grant select, insert, delete on public.results, public.daily_completions to authenticated;
grant all on public.games, public.results, public.daily_completions to service_role;

-- max_score matches maxScore in the game registry (src/games).
insert into public.games (id, area, max_score) values
  ('sequence-lights', 'memory',      960),
  ('arrows',          'attention',   8000),
  ('same-different',  'speed',       12000),
  ('rule-switch',     'flexibility', 10000),
  ('quick-math',      'math',        8000);

-- Row-level security ---------------------------------------------------------

alter table public.games             enable row level security;
alter table public.results           enable row level security;
alter table public.daily_completions enable row level security;

create policy "games are readable by everyone"
  on public.games for select
  to anon, authenticated
  using (true);

create policy "users read their own results"
  on public.results for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "users insert their own results"
  on public.results for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "users delete their own results"
  on public.results for delete
  to authenticated
  using (user_id = (select auth.uid()));

create policy "users read their own daily completions"
  on public.daily_completions for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "users insert their own daily completions"
  on public.daily_completions for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "users delete their own daily completions"
  on public.daily_completions for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- Result validation ----------------------------------------------------------

-- Rejects a score above the game's max_score and a played_at more than 5 minutes
-- in the future. An unknown game_id is left to the foreign key (23503).
create function public.validate_result()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_max_score integer;
begin
  select g.max_score into v_max_score
  from public.games g
  where g.id = new.game_id;

  if new.score > v_max_score then
    raise exception 'score % exceeds max_score % for game %',
      new.score, v_max_score, new.game_id
      using errcode = 'P0001';
  end if;

  if new.played_at > now() + interval '5 minutes' then
    raise exception 'played_at % is in the future', new.played_at
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger validate_result
  before insert on public.results
  for each row execute function public.validate_result();
