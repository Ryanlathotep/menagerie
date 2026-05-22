CREATE TABLE public.bug_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  username TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  context JSONB,
  status TEXT NOT NULL DEFAULT 'open',
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can submit a bug
CREATE POLICY "Anyone can submit bug reports"
ON public.bug_reports
FOR INSERT
WITH CHECK (true);

-- Users can view their own reports
CREATE POLICY "Users view own bug reports"
ON public.bug_reports
FOR SELECT
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- Admins can view all
CREATE POLICY "Admins view all bug reports"
ON public.bug_reports
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Admins can update (status, notes)
CREATE POLICY "Admins update bug reports"
ON public.bug_reports
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Admins can delete
CREATE POLICY "Admins delete bug reports"
ON public.bug_reports
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER update_bug_reports_updated_at
BEFORE UPDATE ON public.bug_reports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_bug_reports_status_created ON public.bug_reports (status, created_at DESC);