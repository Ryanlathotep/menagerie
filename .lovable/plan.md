# Arena System Plan

Huge scope — shipping in one plan, split into clear modules. Nothing here touches shipped map combat balance; the new 6x6 combat is a parallel system reused later for scripted dungeons.

## 1. Arena Building (Overworld)

- New player-buildable: `arena` (in `src/game/buildings.ts`), placeable under normal building rules, 3x3 footprint, needs Log Cabin+ tier.
- Right-click / enter → opens **Arena Hub** modal (new `src/game/arena/ArenaHub.tsx`).
- Hub tabs: **Tournaments**, **My Teams**, **Betting Ledger**, **Replays**, **Shop**.

## 2. Tournaments

- Three fixed cadences: **Daily** (24h), **Weekly** (7d), **Monthly** (30d). Anchored to UTC epoch so every client shows the same countdown; no server needed for MVP.
- State stored in `saveData.arena` (new field): `{ entries, bets, replays, currency, teams, npcTeams }`.
- Each tournament: 8-team single-elimination bracket. Player may enter **one team per cadence**. Missing player slots filled from the 5 seeded NPC teams + procedurally-generated filler so bracket always fills.
- On countdown reaching 0: `resolveTournament(cadence, seed=cadenceEpoch)` runs all matches through the autobattle-style 6x6 engine (below), stores full logs as `ArenaReplay[]`, pays out bets, awards arena currency.
- Countdown surfaced on Arena building tooltip + Hub header.

## 3. Betting Pool

- Each match opens with **seeded NPC bets**: pools of **1,000 / 10,000 / 100,000 gp** distributed randomly (seeded) across the 6 teams.
- Player bets any amount of gp on either side until countdown hits 0.
- Payout: `bet * (totalPool / winningSidePool)` minus 5% house cut going to arena currency for participants.
- Bets recorded in ledger with match id for replay linking.

## 4. Arena Currency + Shop

- New resource `arenaTokens` (never dropped elsewhere).
- Earned by: entering a team (+5), winning a match (+10), your team winning bracket (+50), placing any bet (+1).
- Shop sells **Arena-exclusive equipment** (added to `equipment.ts` as a new `arena` set):
  - Gladiator's Edge (weapon, +crit chance)
  - Duelist's Cloak (armor, +dodge)
  - Phantom Sash (accessory, +evasion)
  - Venomtongue Ring / Emberheart Ring / Frostbite Ring (accessories, +DoT damage of matching element)
- Icons use existing equipment icon system; sprites reused.

## 5. New 6x6 Alternating Combat Engine (`src/game/arenaCombat/`)

Parallel to existing map/autobattle. Reused later for solo-piloted dungeons and duo/trio rules.

- **Grid**: 24x24 tile grid, teams start on opposite edges.
- **Team size**: 1–6 per side (`teamMode: 'solo'|'duo'|'trio'|'full'`).
- **Turn order**: Sort all alive fighters by Speed desc. Then walk that list but **alternate teams** — pick fastest of team A, then fastest still-waiting of team B, then next fastest of A, etc. If one team runs out, remaining team acts consecutively.
- **AI hook**: `TeamStrategy` interface — default = `autoStrategy` (reuses `chooseEnemyMove` scoring + naive move-toward-nearest-enemy pathing). Slot exists so players can later script their own.
- **Reuses** `combat.ts` `executeCombat` + status effects; adds only positioning + turn scheduling.
- Produces `ArenaMatchLog` — every action tagged with actor id/species/class/element, target, move id, damage, crit, dodged, DoT ticks, distance, turn index, tile before/after.

## 6. NPC Teams

- 5 hand-authored teams in `src/game/arena/npcTeams.ts` (Fire Bruisers, Void Mages, Balanced All-Rounders, Water Tanks, Assassin Swarm) — level scales to player's roster average.
- Additional procedural filler if bracket has open slots.

## 7. Replay Viewer

- `ArenaReplayPlayer.tsx` — steps through `ArenaMatchLog` on a rendered 6x6 board (SVG, sepia parchment style). Play/pause/step/speed. Rich sidebar: per-monster HP/stamina/status timeline + full action log with filter (element, class, species, crit only, etc.).

## 8. Spectator Crowd + Arena Renderer

- `ArenaBoard.tsx` renders the 24x24 combat grid inside an oval arena (SVG ellipse, sand-colored floor, stone rim).
- Outside the rim: ring of **non-combat monster sprites** pulled from existing species assets, positioned around the ellipse.
- Idle animation: gentle CSS `wiggle` keyframe (already have similar); on crit event → burst `cheer` animation (jump + scale) triggered by replay player.
- Admin **Arena Room Builder** tab (new `src/admin/ArenaRoomEditor.tsx`): edit floor shape (oval default), rim color, crowd density, crowd species mix; saves JSON to `game_data_overrides` under `arena_rooms`. MVP ships with just the plain oval preset; the editor is the framework.

## 9. Balance Analytics

- Every resolved match appends compact rows to `saveData.arena.analytics` (capped at ~5k rows, ring-buffer).
- Admin QA panel gains an **Arena Analytics** card:
  - Win rate by element, class, species
  - Damage dealt/received per element/class
  - Move usage frequency + avg damage + crit rate per move
  - Equipment win-rate correlation
- Simple ranker suggests: "Fire is over-performing (+12% win rate vs mean) — consider nerfing X move" using z-score thresholds. Pure heuristic, non-authoritative.

## 10. Files (create)

- `src/game/arena/{types,tournament,betting,npcTeams,currency,shop,analytics}.ts`
- `src/game/arena/ArenaHub.tsx`, `ArenaBoard.tsx`, `ArenaReplayPlayer.tsx`, `CrowdRing.tsx`
- `src/game/arenaCombat/{engine,turnOrder,pathing,strategy,types}.ts`
- `src/admin/ArenaRoomEditor.tsx`, `src/admin/ArenaAnalyticsPanel.tsx`
- `src/game/arena/arenaRooms.ts` (default oval preset)

## Files (edit)

- `src/game/types.ts` — add `arena` slice to `SaveData`, `ArenaReplay`, `ArenaMatch*`.
- `src/game/state.ts` — reducer actions: `ARENA_ENTER_TEAM`, `ARENA_PLACE_BET`, `ARENA_RESOLVE_TICK`, `ARENA_CLAIM_REWARDS`, `ARENA_BUY_ITEM`.
- `src/game/buildings.ts` + `OverworldBuildingTileGraphics.tsx` — arena building + sprite.
- `src/game/equipment.ts` — new arena set items.
- `src/admin/AdminPanel.tsx` — new **Arena** tab (Room Editor + Analytics).
- `src/pages/AdminQA.tsx` — quick "simulate next tournament now" button for testing.

## Out of scope (called out to user)

- Real cross-server sync of bets/tournaments. Everything is local per save; hooks stubbed so we can move to Cloud tables later without ripping up UI.
- Player-scripted AI DSL — just the `TeamStrategy` interface for now.
- Solo/duo/trio dungeon integration — engine supports it, dungeon wiring is a follow-up.

Sound good? I'll build straight through once you approve.