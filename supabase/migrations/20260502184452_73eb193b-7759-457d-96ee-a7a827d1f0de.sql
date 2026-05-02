-- Most-discovered monsters leaderboard
CREATE TABLE public.discovery_leaderboard (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  discovered_count integer NOT NULL DEFAULT 0,
  achieved_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.discovery_leaderboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read discovery leaderboard"
  ON public.discovery_leaderboard
  FOR SELECT
  USING (true);

CREATE INDEX idx_discovery_leaderboard_count
  ON public.discovery_leaderboard (discovered_count DESC, achieved_at ASC);

-- Submit current discovered count; only updates when higher than stored.
CREATE OR REPLACE FUNCTION public.submit_discovery_count(_count integer)
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

  INSERT INTO public.discovery_leaderboard (user_id, discovered_count)
  VALUES (caller, _count)
  ON CONFLICT (user_id) DO UPDATE
    SET discovered_count = GREATEST(public.discovery_leaderboard.discovered_count, EXCLUDED.discovered_count),
        achieved_at = CASE WHEN EXCLUDED.discovered_count > public.discovery_leaderboard.discovered_count
                           THEN now() ELSE public.discovery_leaderboard.achieved_at END,
        updated_at = now();

  RETURN jsonb_build_object('ok', true, 'count', _count);
END;
$$;

-- Public top-N read.
CREATE OR REPLACE FUNCTION public.get_discovery_leaderboard(_limit integer DEFAULT 10)
RETURNS TABLE(
  rank integer,
  user_id uuid,
  username text,
  discovered_count integer,
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
    dl.achieved_at
  FROM public.discovery_leaderboard dl
  JOIN public.usernames u ON u.user_id = dl.user_id
  ORDER BY dl.discovered_count DESC, dl.achieved_at ASC
  LIMIT GREATEST(1, LEAST(coalesce(_limit, 10), 100));
$$;