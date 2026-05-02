CREATE TABLE public.exploration_leaderboard (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  tiles_explored integer NOT NULL DEFAULT 0,
  world_seed bigint,
  achieved_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.exploration_leaderboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read exploration leaderboard"
  ON public.exploration_leaderboard
  FOR SELECT
  USING (true);

CREATE INDEX idx_exploration_leaderboard_count
  ON public.exploration_leaderboard (tiles_explored DESC, achieved_at ASC);

CREATE OR REPLACE FUNCTION public.submit_exploration_count(_count integer, _world_seed bigint DEFAULT NULL)
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

  INSERT INTO public.exploration_leaderboard (user_id, tiles_explored, world_seed)
  VALUES (caller, _count, _world_seed)
  ON CONFLICT (user_id) DO UPDATE
    SET tiles_explored = GREATEST(public.exploration_leaderboard.tiles_explored, EXCLUDED.tiles_explored),
        achieved_at = CASE WHEN EXCLUDED.tiles_explored > public.exploration_leaderboard.tiles_explored
                           THEN now() ELSE public.exploration_leaderboard.achieved_at END,
        world_seed = COALESCE(EXCLUDED.world_seed, public.exploration_leaderboard.world_seed),
        updated_at = now();

  RETURN jsonb_build_object('ok', true, 'count', _count);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_exploration_leaderboard(_limit integer DEFAULT 10)
RETURNS TABLE(
  rank integer,
  user_id uuid,
  username text,
  tiles_explored integer,
  world_seed bigint,
  achieved_at timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (row_number() OVER (ORDER BY el.tiles_explored DESC, el.achieved_at ASC))::int AS rank,
    el.user_id,
    u.username,
    el.tiles_explored,
    el.world_seed,
    el.achieved_at
  FROM public.exploration_leaderboard el
  JOIN public.usernames u ON u.user_id = el.user_id
  ORDER BY el.tiles_explored DESC, el.achieved_at ASC
  LIMIT GREATEST(1, LEAST(coalesce(_limit, 10), 100));
$$;