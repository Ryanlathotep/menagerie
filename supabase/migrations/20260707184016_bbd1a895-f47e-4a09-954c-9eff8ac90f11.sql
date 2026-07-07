
ALTER TABLE public.crafting_recipes_discovered
  ADD COLUMN IF NOT EXISTS inventor_station_kind text,
  ADD COLUMN IF NOT EXISTS inventor_station_tier int,
  ADD COLUMN IF NOT EXISTS inventor_station_stats jsonb;
