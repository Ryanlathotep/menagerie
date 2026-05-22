// Core game types for the monster battler roguelike

// ============= ELEMENT SYSTEM =============
// 'normal' has no weaknesses or resistances
export type ElementType = 'normal' | 'fire' | 'water' | 'earth' | 'air' | 'void';

// Star-shaped weakness pattern: each element beats 2 and loses to 2
// Normal has no advantages or disadvantages
export const ELEMENT_ADVANTAGES: Record<ElementType, ElementType[]> = {
  normal: [],               // Normal has no advantages
  fire: ['air', 'earth'],   // Fire scorches air and earth
  water: ['fire', 'void'],  // Water douses fire and fills void
  earth: ['water', 'air'],  // Earth absorbs water and grounds air
  air: ['void', 'water'],   // Air disperses void and evaporates water
  void: ['fire', 'earth'],  // Void consumes fire and swallows earth
};

export const ELEMENT_COLORS: Record<ElementType, { primary: string; secondary: string; accent: string }> = {
  normal: { primary: '0 0% 60%', secondary: '0 0% 70%', accent: '0 0% 20%' },
  fire: { primary: '15 90% 55%', secondary: '30 95% 60%', accent: '0 0% 15%' },
  water: { primary: '200 85% 50%', secondary: '190 80% 60%', accent: '0 0% 15%' },
  earth: { primary: '35 70% 45%', secondary: '25 60% 55%', accent: '0 0% 10%' },
  air: { primary: '180 50% 65%', secondary: '200 55% 75%', accent: '0 0% 15%' },
  void: { primary: '270 50% 45%', secondary: '280 45% 55%', accent: '0 0% 10%' },
};

// ============= CLASS SYSTEM =============
// 'normal' has no weaknesses or resistances
export type ClassType = 'normal' | 'kinetic' | 'energy' | 'biological' | 'chemical' | 'political';

// Star-shaped class advantage pattern
// Normal has no advantages or disadvantages
export const CLASS_ADVANTAGES_CORRECTED: Record<ClassType, ClassType[]> = {
  normal: [],                       // Normal has no advantages
  kinetic: ['energy', 'biological'],
  energy: ['biological', 'chemical'],
  biological: ['chemical', 'political'],
  chemical: ['political', 'kinetic'],
  political: ['kinetic', 'energy'],
};

export const CLASS_STATS: Record<ClassType, { hp: number; attack: number; defense: number; speed: number; special: number; dodge: number }> = {
  normal: { hp: 18, attack: 10, defense: 10, speed: 10, special: 10, dodge: 10 },
  kinetic: { hp: 20, attack: 15, defense: 10, speed: 10, special: 5, dodge: 8 },
  energy: { hp: 10, attack: 10, defense: 5, speed: 15, special: 20, dodge: 12 },
  biological: { hp: 25, attack: 8, defense: 12, speed: 8, special: 7, dodge: 6 },
  chemical: { hp: 15, attack: 12, defense: 8, speed: 12, special: 13, dodge: 10 },
  political: { hp: 18, attack: 5, defense: 15, speed: 5, special: 17, dodge: 14 },
};

// ============= SPECIES SYSTEM =============
export type SpeciesType = 
  // Fantasy
  | 'slime' | 'skeleton' | 'goblin' | 'mushroom' | 'ghost' 
  | 'imp' | 'golem' | 'wisp' | 'chimera' | 'dragon'
  // Real-ish
  | 'rat' | 'spider' | 'bat' | 'snake' | 'wolf'
  | 'beetle' | 'crow' | 'shark' | 'frog' | 'jellyfish';

export interface SpeciesData {
  name: string;
  category: 'fantasy' | 'real';
  baseStats: { hp: number; attack: number; defense: number; speed: number; special: number };
  passiveAbility: string;
  passiveDescription: string;
}

export const SPECIES_DATA: Record<SpeciesType, SpeciesData> = {
  // Fantasy creatures
  slime: {
    name: 'Slime',
    category: 'fantasy',
    baseStats: { hp: 30, attack: 5, defense: 15, speed: 3, special: 7 },
    passiveAbility: 'Amorphous',
    passiveDescription: 'Takes 20% less physical damage',
  },
  skeleton: {
    name: 'Skeleton',
    category: 'fantasy',
    baseStats: { hp: 20, attack: 12, defense: 8, speed: 10, special: 10 },
    passiveAbility: 'Undead',
    passiveDescription: '10% chance to survive fatal hit with 1 HP',
  },
  goblin: {
    name: 'Goblin',
    category: 'fantasy',
    baseStats: { hp: 18, attack: 10, defense: 6, speed: 14, special: 12 },
    passiveAbility: 'Cunning',
    passiveDescription: '+25% critical hit chance',
  },
  mushroom: {
    name: 'Mushroom',
    category: 'fantasy',
    baseStats: { hp: 25, attack: 6, defense: 12, speed: 4, special: 13 },
    passiveAbility: 'Spore Cloud',
    passiveDescription: 'Regenerates 5% HP each turn',
  },
  ghost: {
    name: 'Ghost',
    category: 'fantasy',
    baseStats: { hp: 15, attack: 8, defense: 5, speed: 12, special: 20 },
    passiveAbility: 'Ethereal',
    passiveDescription: '30% chance to phase through attacks',
  },
  imp: {
    name: 'Imp',
    category: 'fantasy',
    baseStats: { hp: 16, attack: 11, defense: 5, speed: 16, special: 12 },
    passiveAbility: 'Mischievous',
    passiveDescription: '15% chance to steal stat boost on hit',
  },
  golem: {
    name: 'Golem',
    category: 'fantasy',
    baseStats: { hp: 40, attack: 14, defense: 18, speed: 2, special: 6 },
    passiveAbility: 'Stone Body',
    passiveDescription: 'Cannot take more than 25% max HP per hit',
  },
  wisp: {
    name: 'Wisp',
    category: 'fantasy',
    baseStats: { hp: 12, attack: 4, defense: 4, speed: 18, special: 22 },
    passiveAbility: 'Luminous',
    passiveDescription: '+10% healing effectiveness',
  },
  chimera: {
    name: 'Chimera',
    category: 'fantasy',
    baseStats: { hp: 28, attack: 13, defense: 10, speed: 9, special: 10 },
    passiveAbility: 'Hybrid Nature',
    passiveDescription: 'Gains 50% resistance to elements that hit it',
  },
  dragon: {
    name: 'Dragon',
    category: 'fantasy',
    baseStats: { hp: 35, attack: 16, defense: 14, speed: 8, special: 17 },
    passiveAbility: 'Draconic Pride',
    passiveDescription: 'Damage increases as HP decreases',
  },
  // Real-ish creatures
  rat: {
    name: 'Rat',
    category: 'real',
    baseStats: { hp: 14, attack: 8, defense: 4, speed: 18, special: 6 },
    passiveAbility: 'Scavenger',
    passiveDescription: 'Finds extra items after battle',
  },
  spider: {
    name: 'Spider',
    category: 'real',
    baseStats: { hp: 16, attack: 10, defense: 6, speed: 14, special: 14 },
    passiveAbility: 'Web Spinner',
    passiveDescription: 'Attacks reduce enemy speed by 20%',
  },
  bat: {
    name: 'Bat',
    category: 'real',
    baseStats: { hp: 14, attack: 9, defense: 5, speed: 17, special: 15 },
    passiveAbility: 'Echolocation',
    passiveDescription: '+15% accuracy on all attacks',
  },
  snake: {
    name: 'Snake',
    category: 'real',
    baseStats: { hp: 18, attack: 12, defense: 7, speed: 13, special: 10 },
    passiveAbility: 'Venomous',
    passiveDescription: '+15% damage vs full HP enemies',
  },
  wolf: {
    name: 'Wolf',
    category: 'real',
    baseStats: { hp: 22, attack: 14, defense: 8, speed: 12, special: 4 },
    passiveAbility: 'Pack Hunter',
    passiveDescription: '+10% damage bonus',
  },
  beetle: {
    name: 'Beetle',
    category: 'real',
    baseStats: { hp: 24, attack: 10, defense: 16, speed: 6, special: 4 },
    passiveAbility: 'Carapace',
    passiveDescription: 'First hit each turn deals 30% reduced damage',
  },
  crow: {
    name: 'Crow',
    category: 'real',
    baseStats: { hp: 15, attack: 9, defense: 5, speed: 16, special: 15 },
    passiveAbility: 'Keen Eye',
    passiveDescription: '25% chance to steal enemy items on hit',
  },
  shark: {
    name: 'Shark',
    category: 'real',
    baseStats: { hp: 28, attack: 18, defense: 10, speed: 10, special: 4 },
    passiveAbility: 'Blood Frenzy',
    passiveDescription: '+30% damage against wounded enemies',
  },
  frog: {
    name: 'Frog',
    category: 'real',
    baseStats: { hp: 16, attack: 7, defense: 6, speed: 15, special: 16 },
    passiveAbility: 'Amphibious',
    passiveDescription: 'Immune to water hazards, +20% water damage',
  },
  jellyfish: {
    name: 'Jellyfish',
    category: 'real',
    baseStats: { hp: 12, attack: 6, defense: 3, speed: 8, special: 21 },
    passiveAbility: 'Stinging Tendrils',
    passiveDescription: 'Attackers take damage when hitting',
  },
};

// ============= MONSTER (COMBINED) =============
export interface MonsterStats {
  maxHp: number;
  currentHp: number;
  attack: number;
  defense: number;
  speed: number;      // Turn order only
  dodge: number;      // Evasion chance (reduces enemy hit chance)
  special: number;
  stamina: number;    // Max stamina
  currentStamina: number;
}

export interface Monster {
  id: string;
  species: SpeciesType;
  class: ClassType;
  element: ElementType;
  level: number;
  stats: MonsterStats;
  name: string;
  experience?: number; // Current XP for party members (passive leveling)
  // Move mastery tracking - keyed by base move ID
  moveMastery?: Record<string, {
    uses: number;
    currentTier: 'lesser' | 'minor' | 'base' | 'greater' | 'omega';
    hasAoE: boolean;
  }>;
  // Item the monster is carrying (can be stolen by Crow)
  carriedItem?: {
    id: string;
    name: string;
    type: 'potion' | 'equipment' | 'gold' | 'material';
    value: number;
    effect?: string;
  };
  // Chimera's temporary element resistances
  temporaryResistances?: Array<{
    element: ElementType;
    turnsRemaining: number;
  }>;
  // Enemy equipment (drops on defeat if not recruited)
  equipment?: import('./equipment').MonsterEquipment;
}

// ============= MOVES/ABILITIES =============
export type MoveCategory = 'physical' | 'special' | 'status';

export interface Move {
  id: string;
  name: string;
  description: string;
  category: MoveCategory;
  power: number;
  accuracy: number;
  cost: number; // Energy/MP cost
  source: 'species' | 'class' | 'element';
  sourceId: string;
}

// ============= DUNGEON =============
// 'wall' = bedrock (never mineable). 'mineable_wall' = breakable with a Pickaxe;
// see `wallTier` and `wallHits` on DungeonTile for hardness/progress.
export type TileType = 'floor' | 'wall' | 'mineable_wall' | 'door' | 'stairs' | 'stairs_up' | 'trap' | 'treasure' | 'enemy' | 'player' | 'shop' | 'terrain' | 'plant' | 'elevator' | 'nest';
export type TrapType = 'spike' | 'poison' | 'alarm';
export type PlantType = 'healing_herb' | 'stamina_root' | 'antidote_leaf' | 'mana_blossom' | 'fire_pepper' | 'ice_mint' | 'revive_moss' | 'golden_ginseng' | 'phoenix_flower' | 'panacea_petal' | 'miracle_lotus';

// Re-export terrain types
export type { TerrainType } from './terrain';

// Re-export equipment types for convenience
export type { EquipmentItem, EquipmentSlot, MonsterEquipment, Rarity, CraftingMaterial } from '../game/equipment';

export interface DungeonTile {
  type: TileType;
  explored: boolean;
  visible: boolean;
  enemyId?: string;
  lootId?: string;
  lootData?: import('./dungeon').LootItem; // Full loot data for equipment/materials
  trapType?: TrapType;
  triggered?: boolean; // For traps that have been triggered
  terrainType?: import('./terrain').TerrainType; // For terrain hazard tiles
  plantType?: PlantType; // For harvestable plant tiles
  harvested?: boolean; // Whether the plant has been harvested
  // Mineable wall metadata (only set when type === 'mineable_wall')
  wallTier?: import('./tools').MineableWallTier; // 1=Cavestone, 2=Deepstone, 3=Coreshard
  wallHits?: number; // Accumulated hits with a Pickaxe; breaks at hitsToBreak()
  // Set while the player stands on a staircase tile so we can restore the
  // staircase (instead of plain floor) when they step off.
  stairsBeneath?: 'down' | 'up';
  // Embedded nest state when type === 'nest' (dungeon-only). Mirrors NestState shape.
  nestState?: import('./nests').NestState;
}

export interface Position {
  x: number;
  y: number;
  // Optional Z (vertical elevation). Undefined = derive from tile (ground level).
  // Wall-tops sit at ground_z + 1; stacked walls/cliffs can reach ground_z + 2, etc.
  z?: number;
}

// A player-pinned waypoint in a dungeon. Behaves as a Position but can also
// carry an optional human-friendly name set via the Waypoint Manager.
export interface DungeonWaypoint extends Position {
  name?: string;
}



// ============= GAME STATE =============
export type GamePhase = 'main_menu' | 'character_select' | 'dungeon' | 'battle' | 'victory' | 'defeat' | 'run_summary' | 'overworld';

export interface BattleState {
  playerMonster: Monster;
  enemyMonster: Monster;
  turn: 'player' | 'enemy';
  turnNumber: number;
  log: string[];
  // Combat effects tracking
  playerEffects?: {
    statusEffects: Array<{ type: string; turnsRemaining: number; source: string }>;
    statModifiers: Array<{ stat: string; direction: 'buff' | 'debuff'; percentage: number; turnsRemaining: number; source: string; stacks?: number }>;
  };
  enemyEffects?: {
    statusEffects: Array<{ type: string; turnsRemaining: number; source: string }>;
    statModifiers: Array<{ stat: string; direction: 'buff' | 'debuff'; percentage: number; turnsRemaining: number; source: string; stacks?: number }>;
  };
  // Charge/buff tracking for next attack
  playerChargedNext?: boolean;
  enemyChargedNext?: boolean;
}

export interface DungeonState {
  floor: number;
  tiles: DungeonTile[][];
  playerPosition: Position;
  enemies: Monster[];
  width: number;
  height: number;
  theme?: DungeonTheme;       // Inherited from the DungeonEntrance that started this run
  startingFloor?: number;     // The floor the run started on (difficulty offset)
  // Tile coordinates of the staircase the player entered this floor through
  // (entry stairs = origin (0,0) for displayed coordinates). Shifted when the
  // dungeon expands at the west/north edges.
  entryPosition?: Position;
  // Dungeon Compass: one-shot waypoint pinned to the floor's stairs. Renderer
  // overlays an arrow on this tile so the player can find the exit.
  compassWaypoint?: Position;
  // Player-pinned waypoints (right-click any explored tile). Behave like the
  // overworld arrows: each renders a pulsing marker on its tile, plus an
  // edge-of-screen arrow when off-screen. Persist for the current floor only.
  // `name` is an optional player-supplied label.
  compassWaypoints?: DungeonWaypoint[];

  // Player-placed buildings & roads on this floor. Use the same PlayerBuilding
  // shape as the overworld so all sprites / behaviors / context menus work.
  // Note: `any[]` here avoids a circular import with buildings.ts; consumers
  // cast to `PlayerBuilding[]`.
  playerBuildings?: any[];
  roads?: Record<string, 'dirt_road' | 'stone_road'>;

  // Persistent per-floor snapshots so the player can walk back up the
  // staircase to revisit a previous floor (tile state, enemies, position).
  // Excludes `compassWaypoint` and the active floor itself.
  visitedFloors?: Record<number, {
    tiles: DungeonTile[][];
    enemies: Monster[];
    playerPosition: Position;
    width: number;
    height: number;
    entryPosition?: Position;
    playerBuildings?: any[];
    roads?: Record<string, 'dirt_road' | 'stone_road'>;
  }>;
}

export interface InventoryItem {
  id: string;
  name: string;
  type: 'potion' | 'equipment' | 'gold' | 'material';
  value: number;
  effect?: string;
  quantity: number;
  materialId?: string; // For crafting materials
}

export interface RunState {
  currentMonster: Monster;
  party: Monster[];                                            // Party of up to 6 monsters
  activePartyIndex: number;                                    // Index of active monster in party
  dungeon: DungeonState | null;
  battle: BattleState | null;
  gold: number;
  experience: number;       // Current XP toward next level
  itemsCollected: string[];
  inventory: InventoryItem[];
  equipmentInventory: import('./equipment').EquipmentItem[];  // Equipment items found
  partyEquipment: import('./equipment').MonsterEquipment[];   // Equipment per party member (indexed by party position)
  runMaterials: MaterialInventory;                            // Materials found this run (kept on flee)
  enemiesDefeated: number;
  moveOrder: string[];      // Order of move IDs
  hiddenMoves: string[];    // IDs of hidden moves
  // Combat effects for each party member (indexed by party position)
  partyEffects?: PartyEffects[];
  // Battle tracking for recruitment
  battleStats?: {
    turnsUsed: number;
    overkillDamage: number;
    statusEffectsApplied: number;
    criticalHits: number;
  };
}

// Combat effects for a party member
export interface PartyEffects {
  statusEffects: Array<{ type: string; turnsRemaining: number; source: string }>;
  statModifiers: Array<{ stat: string; direction: 'buff' | 'debuff'; percentage: number; turnsRemaining: number; source: string; stacks?: number }>;
}

// Material inventory - persisted across runs (kept when fleeing)
export interface MaterialInventory {
  [materialId: string]: number;
}

// Monster combo identifier (for unlock tracking)
export interface MonsterCombo {
  species: SpeciesType;
  element: ElementType;
  classType: ClassType;
}

export function getComboId(combo: MonsterCombo): string {
  return `${combo.species}_${combo.element}_${combo.classType}`;
}

export interface UnlockedMonster {
  comboId: string;
  species: SpeciesType;
  element: ElementType;
  classType: ClassType;
  level: number; // Level when defeated
  // XP banked toward the next level. Persisted across runs so partial
  // progress isn't lost when entering / leaving dungeons.
  experience?: number;
  // Move-mastery progress (use counts + current tier per move). Persisted
  // across runs so move evolution survives dungeon transitions.
  moveMastery?: Monster['moveMastery'];
  // Persistent equipment that stays equipped across runs. Players can edit it
  // in the pre-run equipment screen but it won't reset between runs.
  equipment?: import('./equipment').MonsterEquipment;
}

// ============= DUNGEON ENTRANCE (Persistent Dungeons) =============

// Themed tower content filtering. All towers have infinite floors.
export type DungeonThemeKind = 'all' | 'element' | 'class' | 'species';

export interface DungeonTheme {
  kind: DungeonThemeKind;
  // For 'element' -> ElementType, 'class' -> ClassType, 'species' -> SpeciesType
  value?: ElementType | ClassType | SpeciesType;
}

export interface DungeonEntrance {
  id: string;                     // e.g. "dungeon_5_-3", "home_tower", "tower_element_fire"
  worldX: number;
  worldY: number;
  seed: number;                   // Deterministic generation seed
  deepestFloor: number;           // Deepest floor reached
  difficulty: number;             // Starting floor level (also content scaling)
  element?: ElementType;          // Biome element (used by procedural overworld dungeons)
  name?: string;                  // Display name (e.g. "Tower of the Infinite")
  discovered?: boolean;           // True once the player has seen this entrance
  isHome?: boolean;               // True for the starter Tower of the Infinite
  theme?: DungeonTheme;           // Content theme (filters what monsters spawn)
  category?: 'home' | 'element' | 'class' | 'species' | 'procedural'; // For grouping in UI
  // Cross-run persistent per-floor snapshots. Mined walls, opened tiles,
  // collected chests, placed buildings/roads survive between runs.
  // Enemies are intentionally NOT stored — they respawn on re-entry.
  // Capped to the last 50 visited floors (deeper floors regenerate fresh).
  floorSnapshots?: Record<number, {
    tiles: DungeonTile[][];
    width: number;
    height: number;
    // Phase B (buildings in dungeons) — fields are forward-compatible:
    playerBuildings?: any[];     // PlayerBuilding[] (avoid circular import here)
    roads?: Record<string, 'dirt_road' | 'stone_road'>;
  }>;
}

export const HOME_TOWER_ID = 'home_tower';
export const HOME_TOWER_NAME = 'Tower of the Infinite';

// All themed towers have infinite floors. We expose a sentinel for UI.
export const INFINITE_FLOORS = Infinity;

export function createHomeTowerEntrance(): DungeonEntrance {
  // Sit a few tiles directly north of home so the player always finds it on day one.
  return {
    id: HOME_TOWER_ID,
    worldX: 0,
    worldY: -3,
    seed: 1337,
    deepestFloor: 0,
    difficulty: 1,
    name: HOME_TOWER_NAME,
    discovered: true,
    isHome: true,
    theme: { kind: 'all' },
    category: 'home',
  };
}

// ---- Themed tower naming ----
const ELEMENT_TOWER_NAMES: Record<ElementType, string> = {
  normal: 'Spire of the Mundane',
  fire: 'Pyre of Eternal Embers',
  water: 'Tide-Drowned Keep',
  earth: 'Stoneheart Bastion',
  air: 'Cyclone Minaret',
  void: 'Nullspire Abyss',
};

const CLASS_TOWER_NAMES: Record<ClassType, string> = {
  normal: 'Archive of the Unaligned',
  kinetic: 'Hammerfall Coliseum',
  energy: 'Arcanum of the Burning Mind',
  biological: 'Verdant Hive',
  chemical: 'Apothecary of Ruin',
  political: 'Court of Whispered Crowns',
};

// Per-species tower names. Themed to species flavor.
const SPECIES_TOWER_NAMES: Record<SpeciesType, string> = {
  // Fantasy
  slime: 'Gelatin Vault',
  skeleton: 'Ossuary of the Risen',
  goblin: 'Greenskin Warrens',
  mushroom: 'Sporecap Catacombs',
  ghost: 'Hollow Wail Manor',
  imp: 'Cinder Imp Cloister',
  golem: 'Forgewalker Citadel',
  wisp: 'Lantern of Faint Souls',
  chimera: 'Menagerie of Stitched Beasts',
  dragon: 'Wyrmthrone Keep',
  // Real-ish
  rat: 'Plaguewarren',
  spider: 'Silken Crypt',
  bat: 'Belfry of Endless Wings',
  snake: 'Coilstone Sanctum',
  wolf: 'Howlmoor Reach',
  beetle: 'Carapace Hollow',
  crow: 'Murder-Tower',
  shark: 'Sunken Tooth Reef',
  frog: 'Bog of Croaking Princes',
  jellyfish: 'Drifting Bell Spire',
};

// Themed towers are placed at deterministic positions on the overworld so the
// player can physically walk to them. We arrange them in concentric rings around
// the home base: element towers close in, then class towers, then the long
// species ring far out. Angles are evenly spaced and offset between tiers so
// arrows on the compass don't all point the same direction.
function ringCoord(radius: number, slot: number, totalSlots: number, angleOffset: number = 0): { x: number; y: number } {
  const angle = (slot / totalSlots) * Math.PI * 2 + angleOffset;
  return {
    x: Math.round(Math.cos(angle) * radius),
    y: Math.round(Math.sin(angle) * radius),
  };
}

// Public so the overworld chunk generator can know which world coords carry a themed tower.
export const ELEMENT_TOWER_RING_RADIUS = 28;
export const CLASS_TOWER_RING_RADIUS = 70;
export const SPECIES_TOWER_RING_RADIUS = 140;
// Tower of the Infinite sits a couple tiles north of home so it's always findable.
export const HOME_TOWER_WORLD_POS = { x: 0, y: -3 };

export function createElementTowerEntrance(element: ElementType, index: number): DungeonEntrance {
  const id = `tower_element_${element}`;
  const seed = 200000 + index * 7919;
  // Total = ELEMENT_TOWER_ORDER.length (6). Angle offset rotates the ring slightly.
  const { x, y } = ringCoord(ELEMENT_TOWER_RING_RADIUS, index, 6, Math.PI / 6);
  return {
    id,
    worldX: x,
    worldY: y,
    seed,
    deepestFloor: 0,
    // Starting difficulty rises with the index so each successive element tower is harder.
    difficulty: 5 + index * 5, // 5, 10, 15, 20, 25, 30
    element,
    name: ELEMENT_TOWER_NAMES[element],
    discovered: false,
    theme: { kind: 'element', value: element },
    category: 'element',
  };
}

export function createClassTowerEntrance(classType: ClassType, index: number): DungeonEntrance {
  const id = `tower_class_${classType}`;
  const seed = 300000 + index * 7919;
  const { x, y } = ringCoord(CLASS_TOWER_RING_RADIUS, index, 6, Math.PI / 12);
  return {
    id,
    worldX: x,
    worldY: y,
    seed,
    deepestFloor: 0,
    // Class towers start higher than element towers
    difficulty: 40 + index * 5, // 40, 45, 50, 55, 60, 65
    name: CLASS_TOWER_NAMES[classType],
    discovered: false,
    theme: { kind: 'class', value: classType },
    category: 'class',
  };
}

export function createSpeciesTowerEntrance(species: SpeciesType, index: number): DungeonEntrance {
  const id = `tower_species_${species}`;
  const seed = 400000 + index * 7919;
  // 20 species spread around the long outer ring.
  const { x, y } = ringCoord(SPECIES_TOWER_RING_RADIUS, index, 20);
  return {
    id,
    worldX: x,
    worldY: y,
    seed,
    deepestFloor: 0,
    // Species towers are the highest tier
    difficulty: 75 + index * 3, // 75 .. 132
    name: SPECIES_TOWER_NAMES[species],
    discovered: false,
    theme: { kind: 'species', value: species },
    category: 'species',
  };
}

// Build the canonical ordered list of element/class/species towers.
// Order matters: first 6 elements (closest to the center), then classes, then species.
export const ELEMENT_TOWER_ORDER: ElementType[] = ['normal', 'fire', 'water', 'earth', 'air', 'void'];
export const CLASS_TOWER_ORDER: ClassType[] = ['normal', 'kinetic', 'energy', 'biological', 'chemical', 'political'];
export const SPECIES_TOWER_ORDER: SpeciesType[] = [
  // Fantasy
  'slime', 'skeleton', 'goblin', 'mushroom', 'ghost',
  'imp', 'golem', 'wisp', 'chimera', 'dragon',
  // Real-ish
  'rat', 'spider', 'bat', 'snake', 'wolf',
  'beetle', 'crow', 'shark', 'frog', 'jellyfish',
];

export function createAllThemedTowers(): Record<string, DungeonEntrance> {
  const out: Record<string, DungeonEntrance> = {};
  out[HOME_TOWER_ID] = createHomeTowerEntrance();
  ELEMENT_TOWER_ORDER.forEach((el, i) => {
    const t = createElementTowerEntrance(el, i);
    out[t.id] = t;
  });
  CLASS_TOWER_ORDER.forEach((cl, i) => {
    const t = createClassTowerEntrance(cl, i);
    out[t.id] = t;
  });
  SPECIES_TOWER_ORDER.forEach((sp, i) => {
    const t = createSpeciesTowerEntrance(sp, i);
    out[t.id] = t;
  });
  return out;
}

export interface SaveData {
  unlockedSpecies: SpeciesType[]; // Keep for backwards compat - starts with slime
  unlockedCombos: string[];       // Legacy - specific combos unlocked (e.g. "slime_fire_kinetic")
  unlockedMonsters: UnlockedMonster[]; // NEW: full unlock data with levels
  highestFloor: number;
  totalRuns: number;
  totalEnemiesDefeated: number;
  gold: number;                   // Town gold (persisted across runs)
  materials: MaterialInventory;   // Crafting materials (persisted across runs)
  storedEquipment: import('./equipment').EquipmentItem[]; // Equipment storage (persisted)
  storedItems: InventoryItem[];   // Town item storage (persisted)
  unlockedRecipes: string[];      // Recipe IDs unlocked by bringing equipment back
  overworldState?: import('./overworld').OverworldState; // Persisted overworld
  dungeonEntrances: Record<string, DungeonEntrance>; // Persistent dungeon data
  tools?: import('./tools').PlayerTools; // Singleton upgradeable tools (pickaxe, etc.)
}

export interface GameState {
  phase: GamePhase;
  run: RunState | null;
  saveData: SaveData;
}

// ============= DUNGEON FLOOR PERSISTENCE =============

const MAX_SNAPSHOTS_PER_DUNGEON = 50;

/** Strip volatile per-tile state that should respawn on re-entry. */
function snapshotTile(t: DungeonTile): DungeonTile {
  // Deep-copy; tiles are leaf objects with no functions.
  return { ...t };
}

/**
 * Fold the active dungeon (current floor + visitedFloors) into the entrance's
 * cross-run `floorSnapshots`. Enemies are intentionally NOT persisted —
 * they regenerate fresh each entry so the world isn't permanently emptied.
 * Caps stored floors to the 50 most-recently-visited.
 */
export function snapshotDungeonToEntrance(
  entrance: DungeonEntrance,
  dungeon: DungeonState,
): DungeonEntrance {
  const existing = entrance.floorSnapshots || {};
  const next: Record<number, NonNullable<DungeonEntrance['floorSnapshots']>[number]> = { ...existing };

  // Snapshot all visited floors (these already exclude the active floor).
  if (dungeon.visitedFloors) {
    for (const [floorStr, snap] of Object.entries(dungeon.visitedFloors)) {
      const floor = Number(floorStr);
      next[floor] = {
        tiles: snap.tiles.map(row => row.map(snapshotTile)),
        width: snap.width,
        height: snap.height,
        playerBuildings: snap.playerBuildings ? snap.playerBuildings.map(b => ({ ...b })) : existing[floor]?.playerBuildings,
        roads: snap.roads ? { ...snap.roads } : existing[floor]?.roads,
      };
    }
  }

  // Snapshot the currently-active floor (live buildings/roads on dungeon).
  next[dungeon.floor] = {
    tiles: dungeon.tiles.map(row => row.map(snapshotTile)),
    width: dungeon.width,
    height: dungeon.height,
    playerBuildings: dungeon.playerBuildings ? dungeon.playerBuildings.map(b => ({ ...b })) : existing[dungeon.floor]?.playerBuildings,
    roads: dungeon.roads ? { ...dungeon.roads } : existing[dungeon.floor]?.roads,
  };

  // Cap size: keep the 50 deepest snapshots (deepest = most interesting).
  const floors = Object.keys(next).map(Number).sort((a, b) => b - a);
  const trimmed: typeof next = {};
  for (const f of floors.slice(0, MAX_SNAPSHOTS_PER_DUNGEON)) {
    trimmed[f] = next[f];
  }

  return { ...entrance, floorSnapshots: trimmed };
}

/**
 * Overlay a saved floor snapshot onto a freshly-generated dungeon floor.
 * Preserves mined walls and player edits while letting enemies/items respawn.
 * If the freshly-generated dungeon has been resized (infinite streaming), we
 * keep the freshly-generated tiles beyond the saved bounds.
 */
export function hydrateDungeonFromSnapshot(
  fresh: DungeonState,
  entrance: DungeonEntrance | undefined,
): DungeonState {
  const snap = entrance?.floorSnapshots?.[fresh.floor];
  if (!snap) return fresh;

  // Replace tiles in-bounds with the snapshot; keep fresh enemies/spawn.
  const w = Math.max(fresh.width, snap.width);
  const h = Math.max(fresh.height, snap.height);
  const tiles: DungeonTile[][] = [];
  for (let y = 0; y < h; y++) {
    const row: DungeonTile[] = [];
    for (let x = 0; x < w; x++) {
      const fromSnap = y < snap.height && x < snap.width ? snap.tiles[y]?.[x] : undefined;
      const fromFresh = y < fresh.height && x < fresh.width ? fresh.tiles[y]?.[x] : undefined;
      row.push(fromSnap ? { ...fromSnap } : (fromFresh ? { ...fromFresh } : { type: 'wall', x, y } as any));
    }
    tiles.push(row);
  }

  return {
    ...fresh,
    tiles,
    width: w,
    height: h,
    playerBuildings: snap.playerBuildings ? snap.playerBuildings.map((b: any) => ({ ...b })) : fresh.playerBuildings,
    roads: snap.roads ? { ...snap.roads } : fresh.roads,
  };
}

