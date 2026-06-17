
## The problem
The current tile editor asks you to describe rules (neighbors, shapes, bitmasks) before you ever see results. You shouldn't have to. You already have the sliced tiles and reference gifs — you just need a place to arrange them and have the dungeon copy your arrangements.

## What I'll build

### 1. A "Tile Patterns" painter (new admin page)
- Blank 8×8 grid.
- Left panel: your existing sliced tiles (already in `game_data_overrides`, kind='sliced').
- Click a tile, click a grid cell → it paints. That's it. No shapes, no bitmasks, no neighbor toggles.
- "Save pattern" → stores the grid as one named example (e.g. "stone corner room").
- "Tag" field: which **tile family** it belongs to (e.g. `stone-wall`, `brick-wall`). Patterns for the same family pool together.

### 2. Pattern storage
- New key namespace in `game_data_overrides`: `tile_pattern:<id>`.
- Shape: `{ name, family, width, height, cells: [{x,y,tileKey}] }`.
- No schema migration needed — reuses the existing override table you're already using for tiles.

### 3. The "rule learner" (pure function, no UI)
- Reads all patterns for a family.
- For each painted cell, records: "this tileKey was used when its 8 neighbors looked like [N=stone, NE=empty, E=stone, …]."
- Builds a lookup: `neighborSignature → [candidate tileKeys]`.
- That's the entire ruleset. No hand-authored bitmasks.

### 4. Dungeon renderer hook
- When the dungeon needs to draw a wall tile, it asks the learner: "given these 8 neighbors, what tile?"
- Picks from candidates (random if multiple match — gives natural variation).
- Falls back to a designated "default" tile if no pattern covered that situation (ugly but never crashes).
- The current Blob-47 path stays as-is. A wall family opts in by setting `useExamples: true` on its meta. **Nothing existing breaks.**

### 5. The repeatable process for future tile sets
When you upload a new sheet later:
1. Slice it (existing flow, unchanged).
2. Open Tile Patterns → pick the new family tag.
3. Paint 2–5 small examples of what walls/floors/corners should look like.
4. Mark the family `useExamples: true`.
5. Generate a dungeon — it copies your style.

No code changes per tile set. Ever.

## Technical notes
- New file: `src/admin/TilePatternPainter.tsx` (the grid painter + save).
- New file: `src/game/tilePatternLearner.ts` (pure function: patterns → lookup).
- New route entry in `AdminTiles.tsx` (tab alongside existing editors).
- Renderer hook added in the wall draw path, gated on `useExamples`.
- Existing `TileAssetManager.tsx` is **not modified**. Existing Blob-47 data is **not touched**.

## What I'm NOT doing
- Not removing the Blob-47 editor.
- Not modifying any of your existing tile assignments.
- Not changing how slicing works.
- Not touching the renderer's current code path for families without `useExamples`.

## Order of work in one go
1. Build the painter UI + save flow.
2. Build the learner.
3. Wire one wall family through the new path end-to-end.
4. Show you the result in the actual dungeon so you can judge before we touch anything else.

If step 4 looks wrong, we iterate on the painter. Nothing else in the project moves.
