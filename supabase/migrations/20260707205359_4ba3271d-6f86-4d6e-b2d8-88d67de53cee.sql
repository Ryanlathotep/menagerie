CREATE TABLE public.arena_champions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  cadence TEXT NOT NULL CHECK (cadence IN ('daily','weekly','monthly')),
  team_name TEXT NOT NULL,
  team_snapshot JSONB NOT NULL,
  world_seed INT8,
  wins INT NOT NULL DEFAULT 1,
  achieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, cadence)
);

GRANT SELECT ON public.arena_champions TO anon, authenticated;
GRANT INSERT, UPDATE ON public.arena_champions TO authenticated;
GRANT ALL ON public.arena_champions TO service_role;

ALTER TABLE public.arena_champions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "arena_champions read all" ON public.arena_champions FOR SELECT USING (true);
CREATE POLICY "arena_champions insert own" ON public.arena_champions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "arena_champions update own" ON public.arena_champions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX arena_champions_cadence_wins_idx ON public.arena_champions (cadence, wins DESC, achieved_at DESC);