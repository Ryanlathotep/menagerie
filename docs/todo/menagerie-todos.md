# Menagerie — Master To-Do List

> Imported from `Menagerie_to_dos.docx` on 2026-05-24. Source of truth for roadmap planning. Update in place as items ship.

---

## Critical Bugs & Blockers

- ~~**Movement Softlock:** Fix navigation grid state; ensure player movement inputs are not disabled or trapped in an infinite loop when an enemy entity enters the proximity/aggro radius.~~ ✅ Fixed (Index.tsx — rebase dungeon to expanded grid before enemy turns).
- ~~**Location Transition Persistence:** Fix serialization breakages; ensure the active party state is fully saved and restored when changing scenes or maps.~~ ✅ Fixed (state.ts — FLEE_DUNGEON now uses `persistRunPartyProgress` like END_RUN).
- ~~**Dungeon Recruitment Loop:** Fix `RecruitmentTimer` logic. Calculate remaining time based on player step-counter increments rather than real-time delta.~~ ✅ Fixed (real bug was queued-recruit modal reusing state — added `key={defeatedEnemy.id}` to remount per recruit).
- ~~**Missing Asset Textures:** Fix the Asset Tab UI; resolve broken file paths preventing default equipment artwork from rendering.~~ ✅ Fixed (AssetLibrary.tsx — equipment rows now render built-in SVG silhouette as the default preview).

---

## UI & UX Overhauls

### Dungeon Entry Flow
- ~~Bypass party assignment screens on re-entry. Persist previous run's party composition across sessions.~~ ✅ Done — quick-start "▶️ Start" is now the primary action on each dungeon row when a saved party exists; "Customize" link still opens character-select.
- ~~Expose "Start at Previous Level" option directly on the primary Dungeon Entry panel.~~ ✅ Done — collapsible "Start at floor N" slider on each dungeon row, max = entrance.difficulty + ½ highest-monster-level.

### Party Analyzer Component
Data-driven widget at top of Prepare Party menu that evaluates current party composition:
- Identify missing Class and Element tags.
- Query player inventory and return qualifying creatures (including multi-copy requirements).
- Sort recommendations by descending Level.

### Unified Context Menu & Input
Top-anchored context menu for targeted interactions:
- **Dynamic Targeting Filters:**
  - *Attack Walls:* Filter action list to only show skills with environmental damage tags.
  - *Disarm Trap:* Expose action based on skill type prerequisites.
- **Long-Press Interaction:** Long-click on player avatar opens quick-cast menu for self-buffs and utility/movement skills.
- **Search Engine:** String/tag search filter explicitly for AoE skills.

---

## ⚔️ Combat & Core Systems

- **Damage Type Refactor:** Separate and clarify combat tags in code and tooltips: Physical vs. Melee Single-Target, and Ranged Single-Target vs. AoE.
- **Progression Lifecycle:** Architect backend data models for creature Evolution paths and a Reincarnation prestige loop.
- **Shiny Variant Generator:** Rare spawning modifier that applies:
  - Color-shift shader and particle emitter component.
  - Randomized hidden IV stat multipliers and hidden passive traits.
  - Rarity tiers: Common, Uncommon, Rare, Mythic, Legendary, Unique (global flag: limit 1 instance worldwide).

---

## World & Dungeon Generation

### Procedural Overworld
- **Infinite Tiling:** Infinite (X, Y) coordinate system where enemy Level and stat scaling are a function of vector distance from (0,0).
- **World Elements:** Fog of War rendering, multi-biome distribution, elevation layers, dynamic water bodies (rivers, lakes), Town Portals, NPC villages, World Boss spawning hooks.
- **Interactions:** Modular subsystems for Logging, Farming, Building, and Tower Defense city-siege mechanic.

### Procedural Dungeon V2
- **Layout Adjustments:** Increase hallway tile width bounds. Deterministic generation via seeds.
- **Interactables:** Scripted rooms, keys paired with guaranteed locked door spawns, levers, arrow traps, pitfall traps that drop player a floor.
- **Forge Dungeon System:** Generate customized procedural layout and item drop-table based on properties of a weapon sacrificed at the entrance.

### Arena System (Buildable World Structure)
- **NPC Hook:** Spawning the structure auto-instantiates a persistent *Man-at-Arms* NPC handler.
- **Automated Wagering:** Daily simulated NPC battles with a player betting/gambling system.
- **Leaderboards:** Asynchronous 1v1 ladder ranking based on actual combat simulations.
- **Leagues:** AI-driven async matchmaking leagues with unique arena maps, custom rule modifiers, match replay logging, and exclusive Arena gear loot tables.

---

## Internal Developer Tools

### Custom Move Editor
Modular "Move Tab" in the editor to inject traits into custom skills:
- Apply restrictions based on Species, Element, or Class.
- UI Color Coding: Unmet conditions render **Red**; granted traits render **Green** using AND/OR logic gates.

### Additional Tooling
- **VFX Tool:** Rotation controls and live previews for particle components.
- **Map/Object Editors:** UI for Scripted Rooms, Chest loot tables, Tower stats, and balance sliders.
- **Asset Pipeline:** Improve backend ingestion for tile assets; create submission pipeline for player-authored cosmetic skins.

---

## Future Architecture (Endgame Loops)

### Networking, Seed Architecture & Overworld Rules
- **Multiplayer Architecture:** Multiplayer session hosting. Co-op within the same shared procedural overworld; concurrently enter instanced dungeons within it.
- **Seed-Generated Cross-World Portals:** Craftable *Seed Portals*. Input a generation seed to open a bi-directional gateway to that overworld instance.
- **Global Seed Registry:** API endpoint tracking/indexing "Most Played Seeds" globally; render a searchable list in the portal UI.
- **Host Permissions & Instance Rules:** Originating owner of an overworld gets admin UI:
  - **Network Toggles:** Allow external joins / incoming seed portal connections.
  - **Access Control Lists:** Username Whitelisting/Blacklisting.
  - **Permission Levels:** View Only, Build/Break, Admin Control.

### Advanced Generation & Creature/Item Seed Data
- **Combinatorial Biome Matrix:** Unique biome tiles for every valid Species × Class × Element combo, plus future-proofed Shiny Rarity variation.
- **Creature Seed Dual-Hashing:**
  - *InitialSeed:* Immutable string at spawn; drives how creature interacts with global events.
  - *MutationSeed:* Mutable; overwrites whenever a permanent change happens to base/initial stats.
- **Item Seed Dual-Hashing:**
  - *InitialSeed:* Shared across all instances of the same base item archetype.
  - *ModificationSeed:* Mutable; updates on permanent post-creation modifications.
  - *Note:* Both creature and item seeds must be ingestible by procedural generators for later dungeon/overworld mapping.

### Battlegrounds Mode
- **Turn-Based Miniatures Ruleset:** Dedicated tactical skirmish layer with distinct miniature wargame ruleset for full-party deployment.
- **Overworld Ingestion:** New structural tile archetype *Battleground Buildings*, injected into the procedural overworld tile-generation algorithm.

### Ley Lines & Tower Territory Dominance
- **Dynamic Spawn Modifiers:** Controlling a Tower (occupying its top rank with one of your creatures) modifies the local overworld spawn tables in the surrounding chunk radius.
- **Synergy Buffing:** Controlling any of the four nearest neighboring towers stacks a multiplier on top of the primary spawn modifier.
- **Polygon Claim & Destruct Validation:**
  - Controlling ≥3 towers forming a closed polygon flags all player-built structures within as "Indestructible/Undisassembleable" by other players.
  - **Leaderboard Hierarchy Priority:** tied to Tower Leaderboard array index:
    - Rank 1 can modify/remove structures or unassign creatures of *all* lower-ranked players.
    - Rank 2 can modify Rank 3 and below, but not Rank 1. Apply this priority matrix to all future player-owned objects.
- **State Phasing & Save Persistence:** Losing leaderboard position does NOT wipe structures from save. Flag as "Inactive/Phased Out." Regaining priority phases them back into the active world.
- **UI Layer Toggle:** Client-side map toggle between "Global World Structures" and "Personal/Individual Structures Only."

---

## The Three Progression Towers (Loop Overhaul)

`[Insert Base Asset] ➔ [Run Floor 10 OR Highest Cleared + 10] ➔ [Spawn Extraction Altar] ➔ [End Run & Claim Recipe/Reward]`

### 1. Prototyping Tower (Items)
- **Dynamic Layout Ingestion:** Base layout and difficulty curve scale procedurally from the stats/properties of the item sacrificed at start of run.
- **Modifier Altars & Previews:** Floors host modification altars where players temporarily slot creatures or items. Altar UI must preview exactly how the slot-in modifies the final base item's stat matrix on success.
- **Completion Criteria:** Clear Floor 10 (fresh start) OR Highest Cleared + 10 to spawn the *Recipe-Extraction Altar* next to the exit staircase.
- **End-Run State:** Activating the altar logs a success and serializes a permanent *Crafting Recipe* for the newly forged unique item. Player may ignore the altar and push deeper to further amplify final stats at greater risk.

### 2. Training Tower (Creatures)
- **Stat Scaling Loop:** Mirrors Prototyping framework. Completing Floor 10 (fresh) OR Highest Cleared + 10 beyond that creature's personal high-score applies a permanent, irreversible increase to that creature's base statistics.

### 3. Skill Creation Tower
- **Skill Forging Pipeline:** Same layout and altar-preview mechanics as Prototyping Tower, but the final reward is a custom-drafted skill bound directly to a teachable *Scroll* item asset.
