## Rename the Battle Window → Grapple Window, and make it actually mean something

Walking onto an enemy tile currently opens the legacy turn-based **Battle** screen (`state.run.battle`). We'll repurpose this as the **Grapple Window** so close-range melee fighters have a clear advantage and grappling becomes a real tactical lever.

## Rules

**Entering a grapple**
- Walking into an enemy still triggers the window (default behavior — a "natural" grapple).
- Some moves can also force a grapple from range — see Move Designer below.
- On entry, both fighters get a 🤼 **Grappled** status carrying the modifiers below.

**While grappled** (defaults, overridable per move)
- Ranged attacks: **−25% accuracy** (calculated in `combat.calculateHitChance` for `type === 'ranged'`).
- Movement skills: **−25% effectiveness** (UnifiedMovePanel + Index movement resolver shrink offset reach, min 1 tile).
- Escape / Flee action: **−25% success chance** (handleFlee in battle).
- Melee attacks: unaffected — that's the whole point.

**Breaking a grapple**
- Window closes when one side faints, the player flees successfully, or a movement skill carries the player out of adjacency.
- The Grappled status also has a `duration` (default 3 turns) so a long stalemate naturally ends.

## Move Designer additions (Admin → Moves)

New "Grapple" section on every move:

| Field | Default | Effect |
|-------|---------|--------|
| Forces Grapple | off | On hit, opens the Grapple Window (or refreshes if already in one) |
| Escape modifier | −25% | Per-move override; some moves can pin harder or be looser |
| Ranged accuracy mod | −25% | Override |
| Movement skill mod | −25% | Override |
| Duration (turns) | 3 | How long the Grappled status lasts |

## Visual indicator

A sepia ribbon banner at the top of the Grapple Window:

> 🤼 **Grappled** — Ranged acc −25% · Movement −25% · Escape −25% · 3 turns left

Plus a small 🤼 badge on the active monster's status row in `StatusEffectDisplay`.

## Movement-into-range damage

You're right that the Move tab already determines damage. I'll confirm `Index.tsx`'s movement resolver runs the normal attack pipeline (`executeCombat` → damage roll → effectiveness) against any enemy adjacent to the landing tile when `power > 0`. If it currently skips that for movement-typed moves, I'll add the check.

## UI text changes (Grapple Window itself)

- `Index.tsx` battle title → "🤼 Grapple"
- `CombatSwitchPanel` heading stays as "Switch Monster" (it's still that).
- Flee button → "Escape Grapple" with the modified % shown inline.

## Files touched

```text
src/game/statusEffects.ts        + 'grappled' type with modifier metadata
src/game/types.ts                + GrappleConfig on Move
src/game/moves.ts                + (no new fixtures, just type re-export)
src/admin/MovesEditor.tsx        + Grapple form section
src/game/combat.ts               + ranged accuracy debuff when attacker is grappled
src/game/dungeonCombat.ts        + helper to apply grapple on forced-grapple hit
src/game/state.ts                + START_BATTLE auto-applies grappled status; SWITCH_ACTIVE_IN_BATTLE preserves it
src/pages/Index.tsx              + rename UI strings, movement-damage check, escape % modifier, ribbon indicator, distance-break tick
src/game/UnifiedMovePanel.tsx    + shrink movement reach when grappled
```

## Memory updates

- Remove the stale **Core** line "Map-based ONLY tactical combat. No separate encounter screen." (it's been wrong — the battle window does exist).
- Add `mem://gameplay/combat/grapple-system` with the rules above.

## Out of scope (ask if you want them)

- AI choosing to use grapple-forcing moves preferentially — uses normal scoring for now.
- Multi-target grapples / chain grapples.
- Items that prevent or break grapples (could be a follow-up consumable).
