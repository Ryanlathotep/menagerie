
-- Storage hardening
drop policy if exists "Anyone can upload bug screenshots" on storage.objects;
drop policy if exists "Anyone can view bug screenshots" on storage.objects;

create policy "Authenticated users upload own bug screenshots"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'bug-screenshots'
  and auth.uid() is not null
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users update own bug screenshots"
on storage.objects for update
to authenticated
using (
  bucket_id = 'bug-screenshots'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'bug-screenshots'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- bug_reports: require authenticated submission
drop policy if exists "Anyone can submit bug reports" on public.bug_reports;
create policy "Authenticated users submit bug reports"
on public.bug_reports for insert
to authenticated
with check (auth.uid() is not null and auth.uid() = user_id);

-- Leaderboards: revoke direct public reads
drop policy if exists "Anyone can read tower leaderboard" on public.tower_leaderboard;
drop policy if exists "Anyone can read discovery leaderboard" on public.discovery_leaderboard;
drop policy if exists "Anyone can read exploration leaderboard" on public.exploration_leaderboard;

-- Recreate leaderboard RPCs without user_id
drop function if exists public.get_tower_leaderboard(text, integer);
drop function if exists public.get_discovery_leaderboard(integer);
drop function if exists public.get_exploration_leaderboard(integer);

create function public.get_tower_leaderboard(_tower_id text, _limit integer default 25)
returns table(rank integer, username text, best_floor integer, party_snapshot jsonb, run_seconds integer, achieved_at timestamp with time zone)
language sql stable security definer set search_path to 'public'
as $$
  select
    (row_number() over (order by tl.best_floor desc, tl.achieved_at asc))::int,
    u.username, tl.best_floor, tl.party_snapshot, tl.run_seconds, tl.achieved_at
  from public.tower_leaderboard tl
  join public.usernames u on u.user_id = tl.user_id
  where tl.tower_id = _tower_id
  order by tl.best_floor desc, tl.achieved_at asc
  limit greatest(1, least(coalesce(_limit, 25), 100));
$$;

create function public.get_discovery_leaderboard(_limit integer default 10)
returns table(rank integer, username text, discovered_count integer, world_seed bigint, achieved_at timestamp with time zone)
language sql stable security definer set search_path to 'public'
as $$
  select
    (row_number() over (order by dl.discovered_count desc, dl.achieved_at asc))::int,
    u.username, dl.discovered_count, dl.world_seed, dl.achieved_at
  from public.discovery_leaderboard dl
  join public.usernames u on u.user_id = dl.user_id
  order by dl.discovered_count desc, dl.achieved_at asc
  limit greatest(1, least(coalesce(_limit, 10), 100));
$$;

create function public.get_exploration_leaderboard(_limit integer default 10)
returns table(rank integer, username text, tiles_explored integer, world_seed bigint, achieved_at timestamp with time zone)
language sql stable security definer set search_path to 'public'
as $$
  select
    (row_number() over (order by el.tiles_explored desc, el.achieved_at asc))::int,
    u.username, el.tiles_explored, el.world_seed, el.achieved_at
  from public.exploration_leaderboard el
  join public.usernames u on u.user_id = el.user_id
  order by el.tiles_explored desc, el.achieved_at asc
  limit greatest(1, least(coalesce(_limit, 10), 100));
$$;

-- Lock down internal SECURITY DEFINER helpers
revoke execute on function public.update_updated_at_column() from anon, authenticated, public;
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.is_original_admin(uuid) from anon, authenticated, public;
