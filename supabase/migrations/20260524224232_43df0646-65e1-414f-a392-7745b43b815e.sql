
CREATE TABLE public.qa_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ran_at timestamptz NOT NULL DEFAULT now(),
  app_version text,
  world_seed bigint,
  pass_count integer NOT NULL DEFAULT 0,
  fail_count integer NOT NULL DEFAULT 0,
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  console_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.qa_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view all qa runs"
  ON public.qa_runs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins insert qa runs"
  ON public.qa_runs FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    AND auth.uid() = user_id
  );

CREATE POLICY "Admins delete qa runs"
  ON public.qa_runs FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX qa_runs_ran_at_idx ON public.qa_runs (ran_at DESC);
