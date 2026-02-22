

# Overworld Expansion & Systems Plan

This is a large-scale feature set spanning overworld exploration, dungeon improvements, city building, and new progression systems. The plan is organized into **7 phases** that can be implemented sequentially, with each phase building on the previous one.

---

## Phase 1: Multiple Dungeons & Persistent Dungeon Seeds ✅ DONE

**Goal:** Spawn multiple dungeon entrances across the overworld, each with a unique seed and persistent state (floors cleared, player modifications).

**What changes:**
- The overworld chunk generator will place dungeon entrances procedurally based on distance from home (currently only one at coordinates 2,0)
- Each dungeon entrance stores a unique seed, a "deepest floor reached" counter, and saved floor states
- When entering a dungeon, the seed determines generation -- revisiting the same entrance produces the same layout
- Player changes (opened chests, killed enemies, triggered traps) are saved per-floor so re-entering shows prior progress
- The dungeon entrance tile on the overworld will display its deepest floor number

**What the player sees:**
- Dungeon towers scattered across the map, getting harder with distance
- Each tower shows "Depth: 12" (or whatever the deepest floor reached is)
- Re-entering a dungeon you've explored before shows your cleared floors

---

## Phase 2: Improved Terrain Clustering (Elemental Biomes) ✅ DONE

**Goal:** Similar elemental terrain tiles spawn in clusters rather than randomly scattered, and different element types spawn adjacent to each other less often.

**What changes:**
- Overworld chunk generation uses a noise-based biome system: regions of the map lean toward specific elements
- Within a biome region, terrain tiles (lava near fire biomes, water near water biomes, etc.) cluster together
- Transition zones between biomes create mixed areas with two element types
- Enemy spawns in biome regions match the biome's element more often
- Dungeon entrances in a biome region are themed to that element

**What the player sees:**
- The map has visible "zones" -- a volcanic area with lava tiles, a marshy area with water tiles, etc.
- Enemies in each zone match the theme
- More strategic exploration: players can seek out favorable or unfavorable terrain

---

## Phase 3: City Building & Tower Defense Structures ✅ DONE

**Goal:** Players can place buildings on the overworld map around their base -- walls, traps, elemental terrain, scout towers, and farms.

**What changes:**

### Building System
- New `PlayerBuilding` type with categories: Wall, Trap, Terrain Placer, Scout Tower, Farm
- Buildings cost wood, stone, and potentially crafting materials
- Players place buildings on grass tiles adjacent to existing buildings or within a radius of their base
- Buildings persist in the overworld state

### Walls & Traps
- **Walls**: Block enemy movement, cost wood/stone, have HP (can be destroyed by enemies)
- **Traps**: Placed on tiles, deal damage to enemies that walk over them (spike, poison, elemental variants)
- **Elemental Terrain**: Place terrain tiles (lava, water, etc.) that affect combat as per the existing terrain system

### Scout Towers
- Place a tower structure on the map
- Assign a monster from your collection to the tower
- The tower extends the player's visibility radius in that area
- The assigned monster auto-attacks nearby enemies within range (using its element/class)

### Farms
- Place a farm plot on the map
- Assign a monster to tend it
- Over time (based on steps taken / turns passed), the farm produces crafting materials
- Farm output depends on the monster's element (fire monster grows fire peppers, water grows ice mint, etc.)
- Harvest when ready by walking to the farm

**What the player sees:**
- A build menu accessible from the base building or via hotkey
- Visual representation of walls, towers, and farms on the overworld map (new SVG tile graphics)
- Monsters visually shown on their assigned towers/farms

---

## Phase 4: Monster Nests (Overworld & Dungeon)

**Goal:** Special tiles that spawn waves of enemies over time, providing farming spots and optional challenges.

**What changes:**
- New tile type `nest` for both overworld and dungeon
- Nests have an element/class theme and spawn enemies periodically
- Destroying a nest (attacking it like an enemy) stops spawning and drops bonus loot
- Nests in dungeons block the stairs until cleared
- Overworld nests respawn after a set number of steps if not permanently destroyed

**What the player sees:**
- Glowing nest tiles on the map that periodically spawn new enemies nearby
- A tougher challenge with better rewards than regular enemies
- Strategic choice: clear the nest or farm the spawns

---

## Phase 5: NPC Forts

**Goal:** Hostile NPC settlements on the overworld that serve as mini-dungeons and territorial challenges.

**What changes:**
- NPC forts are multi-tile structures (3x3 or 5x5) placed at medium-to-far distances
- Each fort has a theme (element/class), walls, stationed enemy monsters, and a boss
- Entering the fort area triggers a contained tactical combat encounter
- Clearing a fort yields significant loot, materials, and possibly a unique recruit
- Cleared forts can be claimed and converted to player outposts (extending build radius)

**What the player sees:**
- Visible fort structures on the map with enemy banners
- A self-contained combat challenge on the overworld
- A reward of claiming territory after victory

---

## Phase 6: Rune System

**Goal:** A new progression layer that lets players modify equipment stats and change dungeon elemental themes.

**What changes:**

### Rune Items
- New item type `rune` with elemental/class affinities
- Runes drop from nests, forts, dungeon bosses, and high-level enemies
- Runes have tiers (Minor, Standard, Greater, Omega) matching the move mastery system

### Equipment Runes
- Each equipment piece gets 1-3 rune slots based on rarity (common=0, uncommon=1, rare=2, epic=2, legendary=3)
- Slotting a rune adds bonus stats or elemental effects to the equipment
- Runes can be removed (destroying the rune) or overwritten

### Dungeon Runes
- Dungeon entrances accept a "dungeon rune" that modifies the dungeon's elemental theme
- Applying a Fire rune to a dungeon increases fire terrain, fire enemies, and fire-themed loot
- Multiple runes can stack for mixed-element dungeons

**What the player sees:**
- Rune inventory section in the crafting/equipment UI
- Socket slots visible on equipment tooltips
- Dungeon entrance UI shows applied runes and their effects

---

## Phase 7: Dungeon Interactive Objects

**Goal:** Add mechanical puzzle elements to dungeon floors -- levers, boxes, one-way doors, keyed doors.

**What changes:**

### New Tile Types
- **Lever**: Toggling opens/closes linked doors elsewhere on the floor
- **Box/Crate**: Pushable obstacle -- push into enemies for damage or onto switches
- **One-Way Door**: Can only be passed from one direction (arrow indicator)
- **Keyed Door**: Requires finding a matching key item on the same floor to open
- **Key**: New loot item that matches a specific door color/symbol

### Generation
- Dungeon generator places these in later floors (floor 3+) with increasing complexity
- Levers are placed in separate rooms from the doors they control
- Keys are always placed in rooms accessible without their matching door

**What the player sees:**
- Colored doors with matching keys to find
- Levers on walls that visibly open passages
- Pushable crates for puzzle-solving
- One-way passages that force route planning

---

## Technical Details

### New Types (types.ts / overworld.ts)
- `OverworldTileType` expanded: `'nest' | 'wall_building' | 'trap_building' | 'scout_tower' | 'farm' | 'npc_fort'`
- `DungeonTile` type expanded: `'lever' | 'box' | 'one_way_door' | 'keyed_door' | 'key' | 'nest'`
- New `PlayerBuilding` interface with type, position, assigned monster ID, HP, output inventory
- New `DungeonEntrance` interface with seed, deepest floor, saved floor states
- New `Rune` interface with id, name, tier, element/class, stat bonuses
- `EquipmentItem` extended with `runeSlots: Rune[]` and `maxRuneSlots: number`

### New Files
- `src/game/buildings.ts` -- Building definitions, costs, placement logic
- `src/game/nests.ts` -- Nest spawning, destruction, rewards
- `src/game/runes.ts` -- Rune types, slotting logic, dungeon modification
- `src/game/dungeonPuzzles.ts` -- Lever/door/box/key generation and interaction logic
- `src/game/npcForts.ts` -- Fort generation, layout, encounter logic
- `src/game/OverworldBuildingTileGraphics.tsx` -- SVG graphics for walls, towers, farms, nests, forts

### State Changes (state.ts)
- `SaveData` expanded with: `dungeonEntrances: Record<string, DungeonEntrance>`, `buildings: PlayerBuilding[]`, `runes: Rune[]`
- `OverworldState` expanded with: `buildings: PlayerBuilding[]`, `nests: NestState[]`
- New reducer actions: `PLACE_BUILDING`, `ASSIGN_MONSTER_TO_BUILDING`, `HARVEST_FARM`, `SLOT_RUNE`, `APPLY_DUNGEON_RUNE`, `CLEAR_NEST`, `CLAIM_FORT`

### Overworld Chunk Generation Changes
- Biome noise layer using simplex-like noise from seed
- Dungeon entrance placement: one per ~10-chunk radius, seeded deterministically
- NPC fort placement: at distance 20+ from origin, one per ~15-chunk radius
- Nest placement: scattered at distance 5+, denser further out

### Dungeon Generation Changes
- `generateDungeon` accepts a seed parameter for deterministic output (using `mulberry32` or similar PRNG)
- New placement pass for levers, keyed doors, keys, boxes, one-way doors
- Floor state serialization for persistence

---

## Implementation Order Recommendation

Phases 1 and 2 are foundational and should be done first. Phase 3 is the largest single phase and could be split into sub-phases (walls/traps first, then towers/farms). Phases 4-7 are independent of each other and can be done in any order after Phase 3.

