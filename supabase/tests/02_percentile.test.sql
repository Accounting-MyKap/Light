begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

-- Q is the user who asks. Users 1..25 are the other players; their ids are
-- 00000000-0000-0000-0000-0000000000NN, built by pg_temp.uid(n).
create function pg_temp.uid(n integer) returns uuid
language sql immutable as $$
  select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
$$;

insert into auth.users (id, aud, role, is_anonymous, created_at)
values ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'authenticated', 'authenticated', true, now());
insert into auth.users (id, aud, role, is_anonymous, created_at)
select pg_temp.uid(i), 'authenticated', 'authenticated', true, now()
from generate_series(1, 25) as i;

-- ---------------------------------------------------------------- the function exists

select has_function('public', 'get_percentile', array['text', 'integer'], 'get_percentile exists');
select is_definer('public', 'get_percentile', array['text', 'integer'], 'get_percentile is security definer');

-- ---------------------------------------------------------------- fixtures, as postgres
-- Arrows, played 2 days ago. Player i has two results: a best of i*100 and a worse one of i*50.
-- Q has plenty of good results; they must never count.

insert into public.results (id, user_id, game_id, level, score, accuracy, duration_ms, played_at)
select gen_random_uuid(), pg_temp.uid(i), 'arrows', 3, s, 0.9, 60000, now() - interval '2 days'
from generate_series(1, 19) as i, lateral (values (i * 100), (i * 50)) as v(s);

insert into public.results (id, user_id, game_id, level, score, accuracy, duration_ms, played_at)
select gen_random_uuid(), 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'arrows', 5, s, 0.9, 60000,
       now() - interval '1 day'
from unnest(array[7000, 6500, 6000, 5500, 5000]) as s;

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'role', 'authenticated')::text, true);

-- ---------------------------------------------------------------- fewer than 20 active players

select is(
  public.get_percentile('arrows', 500),
  null::integer,
  '19 active players (not counting Q) give null, even though Q has results of their own'
);

-- ---------------------------------------------------------------- 20 active players

reset role;
insert into public.results (id, user_id, game_id, level, score, accuracy, duration_ms, played_at)
select gen_random_uuid(), pg_temp.uid(20), 'arrows', 3, s, 0.9, 60000, now() - interval '2 days'
from unnest(array[2000, 1000]) as s;

set local role authenticated;

-- With Q's best (7000) counted there would be 21 players and 1050 would be 47, not 50.
select is(public.get_percentile('arrows', 1050), 50,
  '20 active players, bests 100..2000: 1050 beats half of them (Q is not counted)');
select is(public.get_percentile('arrows', 50), 0,
  'a score below every best is percentile 0');
select is(public.get_percentile('arrows', 5000), 100,
  'a score above every best is percentile 100');
select is(public.get_percentile('arrows', 1000), 45,
  'a score equal to a best does not beat it (strictly lower only)');

-- ---------------------------------------------------------------- the 30-day window

reset role;
-- Player 21 has played arrows only once, 31 days ago (below 1050): not active.
insert into public.results (id, user_id, game_id, level, score, accuracy, duration_ms, played_at)
values (gen_random_uuid(), pg_temp.uid(21), 'arrows', 3, 50, 0.9, 60000, now() - interval '31 days');
-- Player 1 also has an old, very high result: it must not raise their best.
insert into public.results (id, user_id, game_id, level, score, accuracy, duration_ms, played_at)
values (gen_random_uuid(), pg_temp.uid(1), 'arrows', 3, 7000, 0.9, 60000, now() - interval '40 days');

set local role authenticated;

select is(public.get_percentile('arrows', 1050), 50,
  'a player whose only result is 31 days old is not counted in the total');
select is(public.get_percentile('arrows', 150), 5,
  'results older than 30 days do not count towards a player''s best');

-- ---------------------------------------------------------------- other games

reset role;
-- Players 1..19 play quick-math, with a score above anything in arrows.
insert into public.results (id, user_id, game_id, level, score, accuracy, duration_ms, played_at)
select gen_random_uuid(), pg_temp.uid(i), 'quick-math', 3, 8000, 0.9, 60000, now() - interval '1 day'
from generate_series(1, 19) as i;

set local role authenticated;

select is(public.get_percentile('arrows', 1050), 50,
  'results from another game do not change the arrows percentile');
select is(public.get_percentile('quick-math', 5000), null::integer,
  'the 20-player threshold is per game: 19 quick-math players give null');

reset role;
-- Players 20 and 21 join quick-math. Player 21 is not active in arrows, only here.
insert into public.results (id, user_id, game_id, level, score, accuracy, duration_ms, played_at)
select gen_random_uuid(), pg_temp.uid(i), 'quick-math', 3, 8000, 0.9, 60000, now() - interval '1 day'
from generate_series(20, 21) as i;

set local role authenticated;

select is(public.get_percentile('quick-math', 5000), 0,
  'with 21 quick-math players the percentile is computed from quick-math results only');

-- ---------------------------------------------------------------- rounding

reset role;
-- A 21st active arrows player (best 2100): 10 of 21 are below 1050, 47.6 rounds down to 47.
insert into public.results (id, user_id, game_id, level, score, accuracy, duration_ms, played_at)
values (gen_random_uuid(), pg_temp.uid(22), 'arrows', 3, 2100, 0.9, 60000, now() - interval '3 days');

set local role authenticated;

select is(public.get_percentile('arrows', 1050), 47,
  'the percentile is rounded down');

-- ---------------------------------------------------------------- anon cannot call it

reset role;
set local role anon;
select set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);

select throws_ok(
  $$ select public.get_percentile('arrows', 1050) $$,
  '42501', null,
  'anon cannot execute get_percentile'
);

select * from finish();
rollback;
