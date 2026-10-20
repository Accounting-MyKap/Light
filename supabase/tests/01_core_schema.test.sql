begin;
create extension if not exists pgtap with schema extensions;

select plan(32);

-- Two guests (anonymous users), created as postgres, which can write to auth.users.
insert into auth.users (id, aud, role, is_anonymous, created_at) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'authenticated', 'authenticated', true, now()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'authenticated', 'authenticated', true, now());

-- ---------------------------------------------------------------- schema and catalog

select has_table('public', 'games', 'public.games exists');
select has_table('public', 'results', 'public.results exists');
select has_table('public', 'daily_completions', 'public.daily_completions exists');

select results_eq(
  $$ select id, area, max_score from public.games order by id collate "C" $$,
  $$ values ('arrows', 'attention', 8000),
            ('quick-math', 'math', 8000),
            ('rule-switch', 'flexibility', 10000),
            ('same-different', 'speed', 12000),
            ('sequence-lights', 'memory', 960) $$,
  'games holds the 5 games with their score bounds'
);

-- ---------------------------------------------------------------- A inserts own results

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'role', 'authenticated')::text, true);

select lives_ok(
  $$ insert into public.results (id, game_id, level, score, accuracy, duration_ms, played_at)
     values ('11111111-1111-1111-1111-111111111111', 'arrows', 3, 1200, 0.9, 60000, now()) $$,
  'A can insert a valid result without giving user_id'
);
select is(
  (select user_id from public.results where id = '11111111-1111-1111-1111-111111111111'),
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  'the result ends up with user_id = A'
);
select throws_ok(
  $$ insert into public.results (id, user_id, game_id, level, score, accuracy, duration_ms, played_at)
     values ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
             'arrows', 3, 1200, 0.9, 60000, now()) $$,
  '42501', null,
  'A cannot insert a result on behalf of B'
);
select lives_ok(
  $$ insert into public.results (id, game_id, level, score, accuracy, duration_ms, played_at)
     values ('11111111-1111-1111-1111-111111111111', 'arrows', 3, 1200, 0.9, 60000, now())
     on conflict (id) do nothing $$,
  'resending the same result with on conflict do nothing does not fail'
);
select is(
  (select count(*)::int from public.results where id = '11111111-1111-1111-1111-111111111111'),
  1,
  'resending the same result does not duplicate it'
);

-- ---------------------------------------------------------------- B cannot see or touch A's rows

select set_config('request.jwt.claims',
  json_build_object('sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'role', 'authenticated')::text, true);

select is(
  (select count(*)::int from public.results),
  0,
  'B does not see A''s results'
);
select lives_ok(
  $$ delete from public.results $$,
  'B can try to delete, but RLS leaves it with no rows'
);
select lives_ok(
  $$ update public.results set score = 0 $$,
  'B can try to update, but RLS leaves it with no rows'
);

reset role;
select results_eq(
  $$ select score from public.results where id = '11111111-1111-1111-1111-111111111111' $$,
  $$ values (1200) $$,
  'A''s result is still there, unchanged, after B''s attempts'
);

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'role', 'authenticated')::text, true);

update public.results set score = 0 where id = '11111111-1111-1111-1111-111111111111';
select is(
  (select score from public.results where id = '11111111-1111-1111-1111-111111111111'),
  1200,
  'not even A can update own results: they are immutable'
);

-- ---------------------------------------------------------------- anon role (no session)

reset role;
set local role anon;
select set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);

select is(
  (select count(*)::int from public.games),
  5,
  'anon can read games'
);
select throws_ok(
  $$ insert into public.results (id, game_id, level, score, accuracy, duration_ms, played_at)
     values ('33333333-3333-3333-3333-333333333333', 'arrows', 3, 1200, 0.9, 60000, now()) $$,
  '42501', null,
  'anon cannot insert into results'
);

-- ---------------------------------------------------------------- validation (as A)

reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'role', 'authenticated')::text, true);

select throws_ok(
  $$ insert into public.results (id, game_id, level, score, accuracy, duration_ms, played_at)
     values ('44444444-4444-4444-4444-444444444444', 'arrows', 3, 8001, 0.9, 60000, now()) $$,
  'P0001', null,
  'a score above games.max_score is rejected'
);
select throws_ok(
  $$ insert into public.results (id, game_id, level, score, accuracy, duration_ms, played_at)
     values ('55555555-5555-5555-5555-555555555555', 'arrows', 3, 1200, 0.9, 60000,
             now() + interval '10 minutes') $$,
  'P0001', null,
  'a played_at 10 minutes in the future is rejected'
);
select lives_ok(
  $$ insert into public.results (id, game_id, level, score, accuracy, duration_ms, played_at)
     values ('66666666-6666-6666-6666-666666666666', 'arrows', 3, 1200, 0.9, 60000,
             now() + interval '4 minutes') $$,
  'a played_at 4 minutes in the future is accepted'
);
select throws_ok(
  $$ insert into public.results (id, game_id, level, score, accuracy, duration_ms, played_at)
     values ('77777777-7777-7777-7777-777777777777', 'no-such-game', 3, 1200, 0.9, 60000, now()) $$,
  '23503', null,
  'an unknown game_id is rejected'
);
select throws_ok(
  $$ insert into public.results (id, game_id, level, score, accuracy, duration_ms, played_at)
     values ('88888888-8888-8888-8888-888888888888', 'arrows', 11, 1200, 0.9, 60000, now()) $$,
  '23514', null,
  'level 11 is rejected'
);
select throws_ok(
  $$ insert into public.results (id, game_id, level, score, accuracy, duration_ms, played_at)
     values ('99999999-9999-9999-9999-999999999999', 'arrows', 3, 1200, 0.9, 4000, now()) $$,
  '23514', null,
  'duration_ms 4000 is rejected'
);
select lives_ok(
  $$ insert into public.results (id, game_id, level, score, accuracy, duration_ms, played_at)
     values ('10101010-1010-1010-1010-101010101010', 'arrows', 3, 1200, 0.9, 3600000, now()) $$,
  'duration_ms 3600000 is accepted'
);

-- ---------------------------------------------------------------- daily_completions

select lives_ok(
  $$ insert into public.daily_completions (day, games)
     values ('2026-10-20', '{arrows,quick-math,rule-switch}') $$,
  'A can record a completed day'
);

select set_config('request.jwt.claims',
  json_build_object('sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'role', 'authenticated')::text, true);
select is(
  (select count(*)::int from public.daily_completions),
  0,
  'B does not see A''s completed days'
);

select set_config('request.jwt.claims',
  json_build_object('sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'role', 'authenticated')::text, true);
select lives_ok(
  $$ insert into public.daily_completions (day, games)
     values ('2026-10-20', '{arrows,quick-math,rule-switch}')
     on conflict (user_id, day) do nothing $$,
  'repeating the same day with on conflict do nothing does not fail'
);
select is(
  (select count(*)::int from public.daily_completions where day = '2026-10-20'),
  1,
  'repeating the same day does not duplicate it'
);
select throws_ok(
  $$ insert into public.daily_completions (user_id, day, games)
     values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '2026-10-21', '{arrows}') $$,
  '42501', null,
  'A cannot record a day on behalf of B'
);

-- ---------------------------------------------------------------- A can delete own rows

select lives_ok(
  $$ delete from public.results where id = '11111111-1111-1111-1111-111111111111' $$,
  'A can delete own result'
);
select is(
  (select count(*)::int from public.results where id = '11111111-1111-1111-1111-111111111111'),
  0,
  'A''s result is gone'
);
select lives_ok(
  $$ delete from public.daily_completions where day = '2026-10-20' $$,
  'A can delete own completed day'
);
select is(
  (select count(*)::int from public.daily_completions),
  0,
  'A''s completed day is gone'
);

select * from finish();
rollback;
