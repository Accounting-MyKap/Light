-- Quiz section: two new areas and the 14 quiz games. max_score matches QUIZ_MAX_SCORE in src/games/quiz/engine.ts.
alter table public.games drop constraint games_area_check;
alter table public.games add constraint games_area_check check (area in
  ('memory','attention','speed','flexibility','math','logic','language','trivia','accounting'));

insert into public.games (id, area, max_score) values
  ('trivia-mix', 'trivia', 300), ('trivia-history', 'trivia', 300), ('trivia-science', 'trivia', 300),
  ('trivia-geography', 'trivia', 300), ('trivia-math', 'trivia', 300), ('trivia-arts', 'trivia', 300),
  ('trivia-entertainment', 'trivia', 300), ('trivia-sports', 'trivia', 300), ('trivia-technology', 'trivia', 300),
  ('accounting-mix', 'accounting', 300), ('accounting-concepts', 'accounting', 300),
  ('accounting-colombia', 'accounting', 300), ('accounting-us', 'accounting', 300),
  ('accounting-lending', 'accounting', 300);
