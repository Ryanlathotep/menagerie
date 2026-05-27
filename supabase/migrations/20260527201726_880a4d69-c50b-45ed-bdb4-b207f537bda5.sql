
-- 1. Lock down usernames table: only owner can read their own row
DROP POLICY IF EXISTS "Anyone can read usernames" ON public.usernames;
CREATE POLICY "Users can read own username"
  ON public.usernames
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 2. Explicit deny + revoke for leaderboard tables. Reads must go through SECURITY DEFINER RPCs.
REVOKE SELECT ON public.tower_leaderboard FROM anon, authenticated;
REVOKE SELECT ON public.discovery_leaderboard FROM anon, authenticated;
REVOKE SELECT ON public.exploration_leaderboard FROM anon, authenticated;

CREATE POLICY "Deny direct reads"
  ON public.tower_leaderboard
  FOR SELECT
  TO anon, authenticated
  USING (false);

CREATE POLICY "Deny direct reads"
  ON public.discovery_leaderboard
  FOR SELECT
  TO anon, authenticated
  USING (false);

CREATE POLICY "Deny direct reads"
  ON public.exploration_leaderboard
  FOR SELECT
  TO anon, authenticated
  USING (false);
