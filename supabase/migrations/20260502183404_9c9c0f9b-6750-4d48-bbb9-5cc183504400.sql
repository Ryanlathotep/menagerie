DROP TRIGGER IF EXISTS usernames_set_updated_at ON public.usernames;
CREATE TRIGGER usernames_set_updated_at
  BEFORE UPDATE ON public.usernames
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS tower_leaderboard_set_updated_at ON public.tower_leaderboard;
CREATE TRIGGER tower_leaderboard_set_updated_at
  BEFORE UPDATE ON public.tower_leaderboard
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.set_username(_username text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  trimmed text := trim(_username);
  taken_by uuid;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF trimmed !~ '^[A-Za-z0-9_-]{3,20}$' THEN
    RAISE EXCEPTION 'Username must be 3-20 characters: letters, numbers, underscore, hyphen';
  END IF;

  SELECT user_id INTO taken_by
  FROM public.usernames
  WHERE username_lower = lower(trimmed)
    AND user_id <> caller
  LIMIT 1;

  IF taken_by IS NOT NULL THEN
    RAISE EXCEPTION 'Username "%" is already taken', trimmed;
  END IF;

  INSERT INTO public.usernames (user_id, username)
  VALUES (caller, trimmed)
  ON CONFLICT (user_id) DO UPDATE
    SET username = EXCLUDED.username,
        updated_at = now();

  RETURN jsonb_build_object('user_id', caller, 'username', trimmed);
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_tower_floor(
  _tower_id text,
  _floor int,
  _party_snapshot jsonb DEFAULT NULL,
  _run_seconds int DEFAULT NULL
)
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

  IF _floor IS NULL OR _floor < 1 THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'invalid_floor');
  END IF;

  IF _tower_id IS NULL OR length(trim(_tower_id)) = 0 THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'invalid_tower');
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.usernames WHERE user_id = caller) INTO has_name;
  IF NOT has_name THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'no_username');
  END IF;

  INSERT INTO public.tower_leaderboard (user_id, tower_id, best_floor, party_snapshot, run_seconds)
  VALUES (caller, _tower_id, _floor, _party_snapshot, _run_seconds)
  ON CONFLICT (user_id, tower_id) DO UPDATE
    SET best_floor     = GREATEST(public.tower_leaderboard.best_floor, EXCLUDED.best_floor),
        party_snapshot = CASE WHEN EXCLUDED.best_floor > public.tower_leaderboard.best_floor
                              THEN EXCLUDED.party_snapshot ELSE public.tower_leaderboard.party_snapshot END,
        run_seconds    = CASE WHEN EXCLUDED.best_floor > public.tower_leaderboard.best_floor
                              THEN EXCLUDED.run_seconds ELSE public.tower_leaderboard.run_seconds END,
        achieved_at    = CASE WHEN EXCLUDED.best_floor > public.tower_leaderboard.best_floor
                              THEN now() ELSE public.tower_leaderboard.achieved_at END,
        updated_at     = now();

  RETURN jsonb_build_object('ok', true, 'floor', _floor);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_tower_leaderboard(_tower_id text, _limit int DEFAULT 25)
RETURNS TABLE (
  rank        int,
  user_id     uuid,
  username    text,
  best_floor  int,
  party_snapshot jsonb,
  run_seconds int,
  achieved_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (row_number() OVER (ORDER BY tl.best_floor DESC, tl.achieved_at ASC))::int AS rank,
    tl.user_id,
    u.username,
    tl.best_floor,
    tl.party_snapshot,
    tl.run_seconds,
    tl.achieved_at
  FROM public.tower_leaderboard tl
  JOIN public.usernames u ON u.user_id = tl.user_id
  WHERE tl.tower_id = _tower_id
  ORDER BY tl.best_floor DESC, tl.achieved_at ASC
  LIMIT GREATEST(1, LEAST(coalesce(_limit, 25), 100));
$$;

CREATE OR REPLACE FUNCTION public.get_my_username()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT username FROM public.usernames WHERE user_id = auth.uid();
$$;