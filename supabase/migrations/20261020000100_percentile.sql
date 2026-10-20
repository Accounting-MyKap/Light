-- Percentile of a score among the other active players of a game (spec 5.3).
-- Returns 0..100, or null when fewer than 20 other players were active in the last 30 days.
-- Runs as security definer because RLS hides other players' results from the caller;
-- it only ever returns a single number, never anyone else's score.
create function public.get_percentile(p_game_id text, p_best_score integer)
returns integer
language sql stable security definer set search_path = '' as $$
  with others as (
    select user_id, max(score) as best
    from public.results
    where game_id = p_game_id
      and played_at >= now() - interval '30 days'
      and user_id <> auth.uid()
    group by user_id
  )
  select case when count(*) < 20 then null
              else floor(100.0 * count(*) filter (where best < p_best_score) / count(*))::int
         end
  from others;
$$;

-- Supabase grants execute on new public functions to anon and authenticated by default,
-- on top of the grant to public. Only signed-in users (guests included) may call it.
revoke execute on function public.get_percentile(text, integer) from public, anon;
grant execute on function public.get_percentile(text, integer) to authenticated;
