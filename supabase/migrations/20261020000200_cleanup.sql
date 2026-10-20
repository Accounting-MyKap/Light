-- Weekly cleanup of abandoned guest accounts (spec 5.5).
-- A guest is an anonymous auth user. If it was created more than 90 days ago and has not
-- played in the last 90 days, nobody is coming back to it: delete it. Its results and daily
-- completions go with it (on delete cascade from auth.users).

create extension if not exists pg_cron with schema pg_catalog;

-- Returns how many users it deleted.
-- Runs as security definer because it deletes from auth.users and has to see every result.
create function public.cleanup_inactive_anonymous_users()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from auth.users u
  where u.is_anonymous
    and u.created_at < now() - interval '90 days'
    and not exists (
      select 1
      from public.results r
      where r.user_id = u.id
        and r.played_at >= now() - interval '90 days'
    );

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- Supabase grants execute on new public functions to anon and authenticated by default,
-- on top of the grant to public. Only the cron job (running as postgres) may call it.
revoke execute on function public.cleanup_inactive_anonymous_users() from public, anon, authenticated;

-- Sundays at 04:00 UTC. Unschedule first so this migration can be applied again.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'light-cleanup-anonymous-users') then
    perform cron.unschedule('light-cleanup-anonymous-users');
  end if;

  perform cron.schedule(
    'light-cleanup-anonymous-users',
    '0 4 * * 0',
    'select public.cleanup_inactive_anonymous_users();'
  );
end;
$$;
