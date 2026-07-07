# Reskin the Arena with real game systems

The arena logic is closer to correct than it looks — `arenaCombat/engine.ts` already calls the real `executeCombat`, uses real Speed-based turn order, and hydrates real `Monster` objects from `unlockedMonsters` / NPC specs via `createMonster`. What's *wrong* is the **presentation** and the **betting UX**.

## 1. Board uses dungeon tiles + real monster sprites

Replace the oval-and-circles look in `ArenaBoard.tsx`:

- **Floor:** drop the radial-gradient oval. Render a real `<StoneFloorTile />` grid (from `TileGraphics.tsx`) at every cell — the same sprite dungeon interiors use — with a thin sepia border row of `<WallTile />` around it so it reads as an enclosed room.
- **Combatants:** replace `<circle>` + emoji with `<MonsterSprite species=… element=… classType=… size={CELL - 6} />`. Rotate/flip the Team B sprites horizontally so they face inward.
- **HP bar:** keep the existing tiny HP bar above each sprite (unchanged mechanic, just moved on top of the sprite).
- **Crit flash:** keep the yellow ring pulse, apply to the sprite cell.

## 2. Crowd is real monsters, not emoji

`CrowdRing.tsx` picks `SPECIES_EMOJI[sp]`. Swap the emoji `<div>` for a tiny `<MonsterSpriteSmall />`, and — instead of a random species pool — pull `state.saveData.unlockedMonsters` first (the player's own catalog), padding with the room's `crowdSpecies` list only if the player has fewer than `crowdDensity` unique monsters. That way the audience really is "preexisting characters".

## 3. Clickable teams in the Betting tab

In `ArenaHub.tsx#BetsTab`, wrap each team name (`{teamA.name}` / `{teamB.name}`) in a button that opens a new `TeamDetailModal`:

- Hydrates the team via `hydrateNpcTeam` (NPC) or `unlockedMonsters` lookup (player), so it's the exact roster combat will use.
- Lists each Monster with `<MonsterSprite>`, level, full stats (HP/ATK/DEF/SPD/DEX/SPE/STA), equipped items (icon + name per slot), and learned moves (name, element, class, power, stamina cost, cooldown) via the existing `MOVES` table.
- Same modal also opens from the Tournaments tab team dropdown so players can inspect any entered roster.

## 4. Combat rule parity

`executeCombat`, elemental/class matchups, stamina cost, crit, dodge already come from `combat.ts` — no change needed. Two small alignments to feel like real dungeon combat:

- **Ranged 50% penalty** already applies through `executeCombat`. Confirm by leaving the call intact.
- **Grapple window**: when two combatants share a cell (Chebyshev distance 0), stamp the 🤼 grappled status via the shared `statusEffects.ts` helper so downstream damage/movement modifiers match the rest of the game. This is a 4-line addition inside `runArenaCombat`.

## Files touched

- `src/game/arena/ArenaBoard.tsx` — dungeon-tile floor grid, `MonsterSprite` combatants.
- `src/game/arena/CrowdRing.tsx` — `MonsterSpriteSmall` audience sourced from `unlockedMonsters`; drop the emoji map.
- `src/game/arena/ArenaHub.tsx` — clickable team names in Bets tab; open `TeamDetailModal`.
- `src/game/arena/TeamDetailModal.tsx` — **new**, roster inspector reusing existing sprite/stat/moves components.
- `src/game/arenaCombat/engine.ts` — 4-line grapple status hook.

## Out of scope

- Swapping the alternating-turn `runArenaCombat` for the full pathfinding-driven `dungeonCombat` engine. The engine already delegates damage math to `combat.ts`; a full rewrite would risk regressions across replays and analytics. Can be a follow-up if the visual reskin still feels off.
- Multi-room floor variants (grass/lava/void). Easy to add later — `ArenaRoom` already has a `shape` field we can extend with `tileTheme`.
