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
export type TileType = 'floor' | 'wall' | 'door' | 'stairs' | 'trap' | 'treasure' | 'enemy' | 'player' | 'shop' | 'water';
export type TrapType = 'spike' | 'poison' | 'alarm';

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
  isShallowWater?: boolean; // For water tiles - shallow can be walked through with damage
}

export interface Position {
  x: number;
  y: number;
}

// ============= GAME STATE =============
export type GamePhase = 'main_menu' | 'character_select' | 'dungeon' | 'battle' | 'victory' | 'defeat' | 'run_summary';

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
  dungeon: DungeonState | null;
  battle: BattleState | null;
  gold: number;
  experience: number;       // Current XP toward next level
  itemsCollected: string[];
  inventory: InventoryItem[];
  equipmentInventory: import('./equipment').EquipmentItem[];  // Equipment items found
  equipment: import('./equipment').MonsterEquipment;          // Currently equipped items
  runMaterials: MaterialInventory;                            // Materials found this run (kept on flee)
  enemiesDefeated: number;
  moveOrder: string[];      // Order of move IDs
  hiddenMoves: string[];    // IDs of hidden moves
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
}

export interface SaveData {
  unlockedSpecies: SpeciesType[]; // Keep for backwards compat - starts with slime
  unlockedCombos: string[];       // Legacy - specific combos unlocked (e.g. "slime_fire_kinetic")
  unlockedMonsters: UnlockedMonster[]; // NEW: full unlock data with levels
  highestFloor: number;
  totalRuns: number;
  totalEnemiesDefeated: number;
  materials: MaterialInventory;   // Crafting materials (persisted across runs)
  storedEquipment: import('./equipment').EquipmentItem[]; // Equipment storage (persisted)
}

export interface GameState {
  phase: GamePhase;
  run: RunState | null;
  saveData: SaveData;
}
