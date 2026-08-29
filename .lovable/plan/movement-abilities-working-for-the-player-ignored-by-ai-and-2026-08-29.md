# Movement abilities: working for the player, ignored by AI and the Arena

## What the code shows

Confirmed by reading the relevant files:

- **Player, dungeon** — movement skills work. Selecting one shows legal destination tiles and relocates the player, firing traps, harvesting plants/terrain along the path (`DungeonView.tsx`, `getAttackConfig` in `dungeonCombat.ts`).
- **Player, overworld** — same relocation branch is wired up (`OverworldView.tsx`).
- **Enemy AI** — `scoreMove` in `enemyAI.ts` only scores `melee`/`ranged`/`status`/`heal`. A `movement` move scores 0, so enemies essentially never pick one; and even if noise makes them pick it, the caller treats it as an attack, so nothing happens.
- **Arena** — the arena strategy (`arenaCombat/strategy.ts`) never considers movement skills at all. It either attacks or takes a single one-tile step toward the nearest enemy. The engine (`arenaCombat/engine.ts`) has only two branches: "attack with a move" or "step to `moveTo`" — there is no way for a strategy to say "use this movement skill to relocate", so a movement move handed to the engine runs through `executeCombat` with 0 power and produces a no-op turn.

So: movement abilities are not broken generally — they are missing from every AI-driven fight, including the whole Arena.

## What to build

### 1. Teach the AI to value and use movement skills

In `enemyAI.ts`:
- Add a scoring branch for movement moves: high value when the AI is out of attack reach and the dash closes the gap, when it is low HP and the archetype retreats, or when the pattern is a blink/reposition and the AI is a ranged/mage archetype getting crowded. Near-zero value when already in reach with a usable attack.
- Return the intended relocation alongside the move so callers know it is a reposition, not an attack.

### 2. Add a movement-move branch to arena combat

In `arenaCombat/types.ts`, `strategy.ts`, `engine.ts`:
- Extend `TacticDecision` so a decision can carry both a movement `move` and a destination (`moveTo`), marked as a relocation.
- Give the strategy access to the actor's real movement skills (via `getMonsterMoves`) and let it pick a destination from the move's offsets, respecting `blockedCells`, other combatants, `blink`, `blockedByWalls`, and `blockedByUnits` from `getAttackConfig`.
- In the engine, handle "movement skill" as its own branch: pay stamina, validate the destination against grid bounds/walls/occupancy, relocate, and log it with the move name so the replay shows "X dashes with Shadow Step" instead of a generic "moves".
- Also pass `blockedCells` into the plain one-tile `stepToward` path so ordinary stepping stops walking through prefab walls.

### 3. Combo moves (movement + attack)

Movement patterns can be paired with an attack (`movement` plus `power`/`customShape`). Handle that in the arena branch: relocate first, then resolve the attack from the new position, matching how the dungeon treats it.

### 4. Verification

- Unit-level check that a monster with a known movement skill actually relocates during an arena match (assert positions change by more than one tile and the log names the move).
- Practice Duel run in the browser to confirm relocation events render on the 24x24 board.
- Dungeon spot-check that an enemy with a movement skill closes distance instead of standing still.

## Notes

No changes to move data or the Shape Designer are needed — the movement patterns themselves are fine. This is purely AI decision-making plus the arena engine's missing branch.
