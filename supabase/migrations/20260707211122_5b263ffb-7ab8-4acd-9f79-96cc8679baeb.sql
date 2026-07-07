-- Rolling cloud-save history: keep up to 5 snapshots per user.
CREATE TABLE public.game_save_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  save_data jsonb NOT NULL,
  label text,
  kind text NOT NULL DEFAULT 'auto',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX game_save_snapshots_user_created_idx
  ON public.game_save_snapshots (user_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.game_save_snapshots TO authenticated;
GRANT ALL ON public.game_save_snapshots TO service_role;

ALTER TABLE public.game_save_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own snapshots"
  ON public.game_save_snapshots FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert their own snapshots"
  ON public.game_save_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete their own snapshots"
  ON public.game_save_snapshots FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- After inserting a new snapshot, prune to the newest 5 per user.
CREATE OR REPLACE FUNCTION public.prune_game_save_snapshots()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.game_save_snapshots
  WHERE user_id = NEW.user_id
    AND id NOT IN (
      SELECT id FROM public.game_save_snapshots
      WHERE user_id = NEW.user_id
      ORDER BY created_at DESC
      LIMIT 5
    );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prune_game_save_snapshots
AFTER INSERT ON public.game_save_snapshots
FOR EACH ROW EXECUTE FUNCTION public.prune_game_save_snapshots();
