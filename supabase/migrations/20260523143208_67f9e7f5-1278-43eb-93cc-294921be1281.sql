
-- Public game-assets bucket for admin-uploaded replacement art
INSERT INTO storage.buckets (id, name, public)
VALUES ('game-assets', 'game-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
CREATE POLICY "Game assets are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'game-assets');

-- Admin write/update/delete
CREATE POLICY "Admins can upload game assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'game-assets' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update game assets"
ON storage.objects FOR UPDATE
USING (bucket_id = 'game-assets' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete game assets"
ON storage.objects FOR DELETE
USING (bucket_id = 'game-assets' AND public.has_role(auth.uid(), 'admin'::public.app_role));
