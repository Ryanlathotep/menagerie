## Move Scrolls: Teach & One-Shot Cast

Wire Skill Forge scrolls (`effect: "teach_move:<moveId>"`) so they can do two things from the inventory bar:

1. **Teach** — permanently add the move to a chosen monster.
2. **Cast Now** — fire the move once in combat, ignoring class/element/species/stamina requirements. The scroll is consumed either way.

### 1. Reducer additions (`src/game/state.ts`)
- New action `TEACH_MOVE_FROM_SCROLL { partyIndex, moveId, replaceMoveId?, itemId }`:
  - Add `moveId` to that party member's `knownMoves` (replacing `replaceMoveId` if the pool is full, default cap reuse).
  - Mirror the change onto the matching `UnlockedMonster.knownMoves` so it persists across runs.
  - Decrement the scroll from both `run.inventory` and `saveData.storedItems` (same pattern as `USE_ITEM`).
- No new action needed for Cast Now — it consumes via the existing `USE_ITEM` and reuses the normal attack pipeline.

### 2. Scroll dialog (`src/game/ScrollUseDialog.tsx`, new)
Opens when the player clicks a `teach_move:` scroll from the inventory bar (out of combat *or* in combat).
- Header: "Scroll of <Move Name>" with the move's stats.
- Two buttons:
  - **Teach a Monster** → second step picks a party member; if their move pool is full, a third step picks which existing move to overwrite. Dispatches `TEACH_MOVE_FROM_SCROLL`.
  - **Cast Once** → only enabled when `state.run.battle` exists. Triggers the existing combat attack handler with the scroll's move object, then dispatches `USE_ITEM`.

### 3. Combat integration (`src/pages/Index.tsx`)
- In both the dungeon item handler (~line 1440) and the battle item handler (~line 4256), detect `item.effect?.startsWith('teach_move:')` and open `ScrollUseDialog` instead of falling through to "Used X!".
- Add a thin helper `castScrollMove(move)` that reuses the existing player-attack code path (the same code triggered by the normal move buttons) so element/class/stamina checks are skipped — pass a synthesized move object derived from `getMoveById(moveId)` with `staminaCost: 0` and dispatches the attack against the current `battle.enemyMonster`. Enemy still gets its retaliation turn as normal.
- Out of combat, only "Teach" is shown.

### 4. Surface scrolls in the inventory bar
The inventory bar already lists items with `type === 'potion' || item.effect`. `teach_move:` scrolls already match because they have `effect`. We just confirm the icon/hint label reads "Scroll" and routes through the new handler.

### 5. Greed-risk stays off
No change to the Item World tower greed toggle. Skill Forge still drops scrolls into town storage exactly as it does today.

### Technical notes
- `Move` lookup uses `getMoveById` from `src/game/moves.ts`; scroll's `moveId` is the suffix after `teach_move:`.
- Adding to `UnlockedMonster.knownMoves` mirrors the existing pattern used by leveling-up move unlocks; no migration needed.
- Cast-Now intentionally bypasses class/element/species restrictions (per request) and stamina cost, but still rolls accuracy/crit/damage through `executeCombat` so the move behaves correctly against the target.
- Files touched: `src/game/state.ts`, `src/pages/Index.tsx`, plus new `src/game/ScrollUseDialog.tsx`. No DB/migration changes.
