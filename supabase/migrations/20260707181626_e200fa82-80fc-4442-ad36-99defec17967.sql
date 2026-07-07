
CREATE TABLE public.crafting_recipes_discovered (
  hash text PRIMARY KEY,
  blueprint_id text NOT NULL,
  item_name text NOT NULL,
  grid_json jsonb NOT NULL,
  grid_size int NOT NULL DEFAULT 3,
  discovered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  discovered_by_username text,
  world_seed text,
  discovered_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.crafting_recipes_discovered TO anon;
GRANT SELECT, INSERT ON public.crafting_recipes_discovered TO authenticated;
GRANT ALL ON public.crafting_recipes_discovered TO service_role;

ALTER TABLE public.crafting_recipes_discovered ENABLE ROW LEVEL SECURITY;

-- Anyone (even signed-out) can read who invented a recipe.
CREATE POLICY "Discoveries are world-readable"
  ON public.crafting_recipes_discovered
  FOR SELECT
  USING (true);

-- Only the caller can claim a discovery, and only if the row doesn't exist
-- (unique PK enforces first-come-wins). We also stamp their username.
CREATE POLICY "Authenticated users can claim discoveries"
  ON public.crafting_recipes_discovered
  FOR INSERT
  TO authenticated
  WITH CHECK (
    discovered_by IS NULL OR discovered_by = auth.uid()
  );

-- Trigger: auto-fill discovered_by + discovered_by_username from auth context.
CREATE OR REPLACE FUNCTION public.stamp_recipe_discoverer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.discovered_by IS NULL THEN
    NEW.discovered_by := auth.uid();
  END IF;
  IF NEW.discovered_by_username IS NULL AND NEW.discovered_by IS NOT NULL THEN
    SELECT username INTO NEW.discovered_by_username
    FROM public.usernames
    WHERE user_id = NEW.discovered_by;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER stamp_recipe_discoverer_trg
  BEFORE INSERT ON public.crafting_recipes_discovered
  FOR EACH ROW EXECUTE FUNCTION public.stamp_recipe_discoverer();
