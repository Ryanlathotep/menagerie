DROP FUNCTION IF EXISTS public.get_discovery_leaderboard(integer);
DROP FUNCTION IF EXISTS public.submit_discovery_count(integer);

ALTER TABLE public.discovery_leaderboard
  ADD COLUMN IF NOT EXISTS world_seed bigint;

CREATE OR REPLACE FUNCTION public.submit_discovery_count(_count integer, _world_seed bigint DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  has_name boolean;
BEGIN
  IF caller IS NULL THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'not_authenticated');
  END IF;

  IF _count IS NULL OR _count < 0 THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'invalid_count');
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.usernames WHERE user_id = caller) INTO has_name;
  IF NOT has_name THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'no_username');
  END IF;

  INSERT INTO public.discovery_leaderboard (user_id, discovered_count, world_seed)
  VALUES (caller, _count, _world_seed)
  ON CONFLICT (user_id) DO UPDATE
    SET discovered_count = GREATEST(public.discovery_leaderboard.discovered_count, EXCLUDED.discovered_count),
        achieved_at = CASE WHEN EXCLUDED.discovered_count > public.discovery_leaderboard.discovered_count
                           THEN now() ELSE public.discovery_leaderboard.achieved_at END,
        world_seed = COALESCE(EXCLUDED.world_seed, public.discovery_leaderboard.world_seed),
        updated_at = now();

  RETURN jsonb_build_object('ok', true, 'count', _count);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_discovery_leaderboard(_limit integer DEFAULT 10)
RETURNS TABLE(
  rank integer,
  user_id uuid,
  username text,
  discovered_count integer,
  world_seed bigint,
  achieved_at timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (row_number() OVER (ORDER BY dl.discovered_count DESC, dl.achieved_at ASC))::int AS rank,
    dl.user_id,
    u.username,
    dl.discovered_count,
    dl.world_seed,
    dl.achieved_at
  FROM public.discovery_leaderboard dl
  JOIN public.usernames u ON u.user_id = dl.user_id
  ORDER BY dl.discovered_count DESC, dl.achieved_at ASC
  LIMIT GREATEST(1, LEAST(coalesce(_limit, 10), 100));
$$;