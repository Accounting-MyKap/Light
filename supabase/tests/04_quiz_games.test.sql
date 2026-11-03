begin;
create extension if not exists pgtap with schema extensions;

select plan(5);

-- A guest (anonymous user), created as postgres, which can write to auth.users.
insert into auth.users (id, aud, role, is_anonymous, created_at) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'authenticated', 'authenticated', true, now());

-- ---------------------------------------------------------------- catalog

select results_eq(
  $$ select id, area, max_score from public.games where area in ('trivia', 'accounting') order by id collate "C" $$,
  $$ values ('accounting-colombia', 'accounting', 300),
            ('accounting-concepts', 'accounting', 300),
            ('accounting-lending', 'accounting', 300),
            ('accounting-mix', 'accounting', 300),
            ('accounting-us', 'accounting', 300),
            ('trivia-arts', 'trivia', 300),
            ('trivia-entertainment', 'trivia', 300),
            ('trivia-geography', 'trivia', 300),
            ('trivia-history', 'trivia', 300),
            ('trivia-math', 'trivia', 300),
            ('trivia-mix', 'trivia', 300),
            ('trivia-science', 'trivia', 300),
            ('trivia-sports', 'trivia', 300),
            ('trivia-technology', 'trivia', 300) $$,
  'games holds the 14 quiz games with a max score of 300'
);

-- ---------------------------------------------------------------- area check

select throws_ok(
  $$ insert into public.games (id, area, max_score) values ('x', 'cooking', 10) $$,
  '23514', null,
  'an unknown area is rejected'
);
select lives_ok(
  $$ insert into public.games (id, area, max_score) values ('quiz-check', 'accounting', 10) $$,
  'the accounting area is accepted'
);

-- ---------------------------------------------------------------- quiz score bound (as the guest)

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'role', 'authenticated')::text, true);

select lives_ok(
  $$ insert into public.results (id, game_id, level, score, accuracy, duration_ms, played_at)
     values ('11111111-1111-1111-1111-111111111111', 'trivia-history', 3, 300, 1, 120000, now()) $$,
  'a quiz result at the max score of 300 is accepted'
);
select throws_ok(
  $$ insert into public.results (id, game_id, level, score, accuracy, duration_ms, played_at)
     values ('22222222-2222-2222-2222-222222222222', 'trivia-history', 3, 301, 1, 120000, now()) $$,
  'P0001', null,
  'a quiz result above 300 is rejected'
);

select * from finish();
rollback;
