begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

-- ---------------------------------------------------------------- the function exists

select has_function('public', 'cleanup_inactive_anonymous_users', 'cleanup_inactive_anonymous_users exists');
select is_definer('public', 'cleanup_inactive_anonymous_users', 'cleanup_inactive_anonymous_users is security definer');
select function_returns('public', 'cleanup_inactive_anonymous_users', 'integer',
  'cleanup_inactive_anonymous_users returns an integer');

-- ---------------------------------------------------------------- fixtures, as postgres
-- A: anonymous, created 100 days ago, last played 95 days ago -> deleted
-- B: anonymous, created 100 days ago, last played 10 days ago -> kept
-- C: anonymous, created 10 days ago, never played             -> kept
-- D: permanent,  created 200 days ago, never played           -> kept

insert into auth.users (id, aud, role, is_anonymous, created_at) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'authenticated', 'authenticated', true,  now() - interval '100 days'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'authenticated', 'authenticated', true,  now() - interval '100 days'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'authenticated', 'authenticated', true,  now() - interval '10 days'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'authenticated', 'authenticated', false, now() - interval '200 days');

-- A has a result, but an old one: it must not protect the account, and it must go with it.
-- B has an old result and a recent one: the recent one is what keeps the account.
insert into public.results (id, user_id, game_id, level, score, accuracy, duration_ms, played_at) values
  (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'arrows', 3, 500, 0.9, 60000, now() - interval '95 days'),
  (gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'arrows', 3, 400, 0.9, 60000, now() - interval '95 days'),
  (gen_random_uuid(), 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'arrows', 3, 600, 0.9, 60000, now() - interval '10 days');

-- ---------------------------------------------------------------- first run

select is(public.cleanup_inactive_anonymous_users(), 1,
  'the cleanup deletes one user and reports it');

select is((select count(*)::int from auth.users where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 0,
  'A (anonymous, 100 days old, no recent result) is deleted');
select is((select count(*)::int from public.results where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 0,
  'A''s results are deleted in cascade');
select is((select count(*)::int from auth.users where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 1,
  'B (anonymous, 100 days old, played 10 days ago) is kept');
select is((select count(*)::int from auth.users where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'), 1,
  'C (anonymous, only 10 days old) is kept');
select is((select count(*)::int from auth.users where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'), 1,
  'D (permanent account, 200 days old) is kept');

-- ---------------------------------------------------------------- second run

select is(public.cleanup_inactive_anonymous_users(), 0,
  'running it again deletes nothing');

-- ---------------------------------------------------------------- the weekly job

select is(
  (select schedule from cron.job where jobname = 'light-cleanup-anonymous-users'),
  '0 4 * * 0',
  'the job light-cleanup-anonymous-users runs on Sundays at 04:00 UTC'
);
select is(
  (select command from cron.job where jobname = 'light-cleanup-anonymous-users'),
  'select public.cleanup_inactive_anonymous_users();',
  'the job calls the cleanup function'
);

-- ---------------------------------------------------------------- nobody but the job can call it

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'role', 'authenticated')::text, true);

select throws_ok(
  $$ select public.cleanup_inactive_anonymous_users() $$,
  '42501', null,
  'authenticated cannot execute cleanup_inactive_anonymous_users'
);

reset role;
set local role anon;
select set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);

select throws_ok(
  $$ select public.cleanup_inactive_anonymous_users() $$,
  '42501', null,
  'anon cannot execute cleanup_inactive_anonymous_users'
);

select * from finish();
rollback;
