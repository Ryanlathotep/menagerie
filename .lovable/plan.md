# Spawn Stone Fix + World-Gen Admin Tuner

## 1. Fix the spawn stone cluster (quick)

**Cause:** In `src/game/overworld.ts` the `homeLandBias` near (0,0) only pushes elevation UP (to avoid water at spawn). Since the same elevation field also drives stone above `stoneCutoff = 0.80`, that bias creates a giant ore vein right on top of home base.

**Fix:** Replace the one-way push with a *mid-elevation clamp* inside a 6-tile radius — pull elevation toward ~0.55 (above water cutoff, well below stone cutoff). Spawn becomes reliably grassy, water stays away, stone stays away.

No other systems change.

## 2. World Generation admin tuner

Add a new "World Gen" tab in `AdminPanel` for live tuning of non-engine-breaking variables, with the same JSONB override pattern already used for moves/equipment/etc. so changes persist via Supabase and load on boot.

### Variables exposed (Phase 1 — overworld only)

Grouped sliders + number inputs:

- **Spawn safety**: home-bias radius, target mid-elevation, campfire snap-to-grass toggle
- **Elevation cutoffs**: per-biome `waterCutoff` and `stoneCutoff` (5 biomes × 2 = 10 values, default + per-biome overrides)
- **Tree density**: per-biome base chance, forest cluster threshold, cluster gain
- **Stone tier rolls**: distance + probability thresholds for copper/iron/gold/mithril (currently hard-coded in `resourceHierarchy.ts`)
- **Tree tier rolls**: same for maple / elder oak
- **Upgrade cadence**: per-tier `upgradeSteps` and jitter range
- **Enemy spawn**: base chance, difficulty scaling slope, max cap
- **Difficulty scaling**: tiles-per-level (currently Manhattan distance), starting difficulty

### How it plugs in

1. New `data_type: 'world_gen'` row in `game_data_overrides`, single `data_key: 'overworld'`, full settings object as JSON.
2. New file `src/game/worldGenConfig.ts` exporting:
   - `DEFAULT_WORLD_GEN` (current hard-coded values pulled into one struct)
   - `getWorldGenConfig()` returns merged defaults + active overrides
   - `setWorldGenOverrides(rows)` setter called from `App.tsx` boot loader
3. `overworld.ts` and `resourceHierarchy.ts` read from `getWorldGenConfig()` instead of literals.
4. New `src/admin/WorldGenEditor.tsx`:
   - Form grouped by category (Spawn, Elevation, Trees, Stones, Enemies, Difficulty)
   - `Save` writes override row, `Reset to Default` deletes it, `Save as Default` writes the literal values
   - `Rebuild Overworld` button (reuses existing settings action) to see changes immediately
   - Live numeric inputs + sliders for ranges 0–1
5. Add tab + icon to `AdminPanel.tsx`.

### Future reuse (no code yet, just shape)

- Config struct designed as `{ overworld: {...}, dungeon: {...} }` so a future dungeon-gen tuner drops into the same file.
- Player-facing pre-run "World Settings" screen later: read the same `DEFAULT_WORLD_GEN`, present a curated subset, persist into per-save-data instead of the global override. Same `getWorldGenConfig(saveOverride?)` signature.

## Files

- edit `src/game/overworld.ts` — fix bias + read from config
- edit `src/game/resourceHierarchy.ts` — read tier roll thresholds from config
- create `src/game/worldGenConfig.ts`
- create `src/admin/WorldGenEditor.tsx`
- edit `src/admin/AdminPanel.tsx` — add tab
- edit `src/App.tsx` — load `world_gen` overrides on boot
- edit `src/hooks/useGameDataOverrides.ts` — add `'world_gen'` to `DataType` union

No DB migration needed (reuses `game_data_overrides`).
