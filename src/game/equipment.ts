// Equipment System - Types, Data, and Generation

import { ElementType, ClassType, SpeciesType } from './types';

// ============= EQUIPMENT SLOTS =============
export type EquipmentSlot = 'helmet' | 'armor' | 'gloves' | 'boots' | 'mainHand' | 'offHand' | 'accessory' | 'back';

// ============= RARITY SYSTEM =============
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export const RARITY_COLORS: Record<Rarity, { text: string; bg: string; border: string; glow: string }> = {
  common: { text: 'text-muted-foreground', bg: 'bg-muted', border: 'border-muted-foreground/30', glow: '' },
  uncommon: { text: 'text-green-400', bg: 'bg-green-500/20', border: 'border-green-500/50', glow: 'shadow-green-500/20' },
  rare: { text: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/50', glow: 'shadow-blue-500/30' },
  epic: { text: 'text-purple-400', bg: 'bg-purple-500/20', border: 'border-purple-500/50', glow: 'shadow-purple-500/40' },
  legendary: { text: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500/50', glow: 'shadow-amber-500/50' },
};

export const RARITY_MULTIPLIERS: Record<Rarity, number> = {
  common: 1.0,
  uncommon: 1.25,
  rare: 1.5,
  epic: 1.85,
  legendary: 2.3,
};

export const RARITY_DROP_WEIGHTS: Record<Rarity, number> = {
  common: 50,
  uncommon: 30,
  rare: 14,
  epic: 5,
  legendary: 1,
};

// ============= EQUIPMENT STATS =============
export interface EquipmentStats {
  maxHp?: number;
  attack?: number;
  defense?: number;
  speed?: number;
  dodge?: number;
  special?: number;
  stamina?: number;
}

// ============= AFFINITY REQUIREMENTS =============
export interface AffinityRequirement {
  species?: import('./types').SpeciesType;   // Required species to equip
  classType?: import('./types').ClassType;   // Required class to equip
  element?: import('./types').ElementType;   // Required element to equip
}

export interface AffinityBonus {
  species?: import('./types').SpeciesType;   // Species that gets bonus
  classType?: import('./types').ClassType;   // Class that gets bonus
  element?: import('./types').ElementType;   // Element that gets bonus
  bonusStats: EquipmentStats;                 // Bonus stats when matching
  bonusDescription?: string;                  // Description of bonus effect
}

// ============= EQUIPMENT ITEM =============
export interface EquipmentItem {
  id: string;
  name: string;
  slot: EquipmentSlot;
  rarity: Rarity;
  level: number; // Required level to equip
  stats: EquipmentStats;
  element?: import('./types').ElementType; // Elemental affinity (bonus damage/resistance)
  setId?: string; // For set bonuses
  description?: string;
  icon: string; // Emoji icon
  // Affinity system
  affinityRequired?: AffinityRequirement;  // Must match to equip (exclusive items)
  affinityBonus?: AffinityBonus;           // Bonus when matching (any can equip)
  // Protection system
  bound?: boolean; // If true, item came from town and always returns on death/flee
  // ----- Layered stat provenance (grid-crafted items only) -----
  // `stats` above stays the pattern+filler stats. These extra buckets are
  // shown as separate sections in the tooltip so their source is clear.
  stationStats?: EquipmentStats;   // From the crafter's station modifiers + inventor's frozen modifiers
  runStats?: EquipmentStats;       // Stats earned by the item during dungeon runs (future hook)
  provenance?: CraftProvenance;
  // Portable crafting stations freeze a station snapshot on the item.
  portableStation?: {
    kind: import('./crafting/types').CraftingStationKindLite;
    tier: 1 | 2 | 3 | 4 | 5;
    modifiers: { materialId: string; quantity: number }[];
  };
}

/** Where + how an item was originally crafted, and by whom. */
export interface CraftProvenance {
  stationKind: import('./crafting/types').CraftingStationKindLite | null;
  stationTier: 1 | 2 | 3 | 4 | 5;
  stationModifiers: { materialId: string; quantity: number }[];
  craftedBy?: string;
  worldSeed?: string | null;
  /** The very first player to discover this recipe. Their station bonus persists forever. */
  inventor?: {
    username: string;
    stationKind: import('./crafting/types').CraftingStationKindLite | null;
    stationTier: 1 | 2 | 3 | 4 | 5;
    stationStats: EquipmentStats;
  };
}

// ============= EQUIPMENT SETS =============
export type SetId = 
  | 'warrior' | 'mage' | 'rogue' | 'guardian' | 'berserker'
  | 'fire_lord' | 'frost_mage' | 'earth_warden' | 'wind_dancer' | 'void_walker';

export interface SetBonus {
  pieces: number; // 2, 3, or 4
  stats?: EquipmentStats;
  special?: string; // Description of special effect
  effect?: string; // Effect ID for special bonuses
}

export interface EquipmentSet {
  id: SetId;
  name: string;
  description: string;
  color: string; // HSL color for set items
  bonuses: SetBonus[];
}

export const EQUIPMENT_SETS: Record<SetId, EquipmentSet> = {
  // Class-themed sets
  warrior: {
    id: 'warrior',
    name: "Warrior's Might",
    description: 'Forged for those who fight on the front lines.',
    color: '30 80% 50%', // Orange
    bonuses: [
      { pieces: 2, stats: { attack: 5, defense: 3 } },
      { pieces: 3, stats: { attack: 10, maxHp: 15 }, special: '+10% physical damage' },
      { pieces: 4, stats: { attack: 18, defense: 8, maxHp: 25 }, special: '15% chance to stun on hit', effect: 'warrior_stun' },
    ],
  },
  mage: {
    id: 'mage',
    name: 'Arcane Wisdom',
    description: 'Channeling the raw power of magic.',
    color: '270 70% 60%', // Purple
    bonuses: [
      { pieces: 2, stats: { special: 5, stamina: 5 } },
      { pieces: 3, stats: { special: 12, stamina: 10 }, special: '+15% special damage' },
      { pieces: 4, stats: { special: 20, stamina: 15, speed: 5 }, special: 'Spells cost 20% less stamina', effect: 'mage_efficiency' },
    ],
  },
  rogue: {
    id: 'rogue',
    name: 'Shadow Strike',
    description: 'Swift and deadly, striking from the shadows.',
    color: '180 50% 40%', // Teal
    bonuses: [
      { pieces: 2, stats: { speed: 4, dodge: 4 } },
      { pieces: 3, stats: { speed: 8, dodge: 8, attack: 5 }, special: '+20% critical hit chance' },
      { pieces: 4, stats: { speed: 12, dodge: 15, attack: 10 }, special: 'First attack each battle deals double damage', effect: 'rogue_ambush' },
    ],
  },
  guardian: {
    id: 'guardian',
    name: "Guardian's Resolve",
    description: 'Unbreakable defense for the protector.',
    color: '210 60% 50%', // Blue
    bonuses: [
      { pieces: 2, stats: { defense: 6, maxHp: 10 } },
      { pieces: 3, stats: { defense: 12, maxHp: 25 }, special: 'Reduces incoming damage by 10%' },
      { pieces: 4, stats: { defense: 20, maxHp: 40, dodge: 5 }, special: '25% chance to block all damage', effect: 'guardian_block' },
    ],
  },
  berserker: {
    id: 'berserker',
    name: "Berserker's Fury",
    description: 'Power that grows with rage and wounds.',
    color: '0 70% 50%', // Red
    bonuses: [
      { pieces: 2, stats: { attack: 8 } },
      { pieces: 3, stats: { attack: 15, speed: 4 }, special: '+5% damage per 10% HP missing' },
      { pieces: 4, stats: { attack: 25, speed: 8 }, special: 'Below 30% HP: +50% attack speed', effect: 'berserker_rage' },
    ],
  },
  // Elemental sets
  fire_lord: {
    id: 'fire_lord',
    name: 'Infernal Dominion',
    description: 'Command the flames of destruction.',
    color: '15 90% 55%', // Fire orange
    bonuses: [
      { pieces: 2, stats: { attack: 4, special: 4 } },
      { pieces: 3, stats: { attack: 8, special: 8 }, special: '+25% fire damage' },
      { pieces: 4, stats: { attack: 12, special: 15 }, special: 'Attacks have 20% chance to burn', effect: 'fire_burn' },
    ],
  },
  frost_mage: {
    id: 'frost_mage',
    name: 'Frozen Heart',
    description: 'The cold embrace of winter.',
    color: '200 85% 60%', // Ice blue
    bonuses: [
      { pieces: 2, stats: { special: 5, defense: 3 } },
      { pieces: 3, stats: { special: 10, defense: 6 }, special: '+25% water damage' },
      { pieces: 4, stats: { special: 18, defense: 10 }, special: '15% chance to freeze enemies', effect: 'frost_freeze' },
    ],
  },
  earth_warden: {
    id: 'earth_warden',
    name: "Earth's Embrace",
    description: 'Solid as stone, immovable as mountains.',
    color: '35 70% 45%', // Earth brown
    bonuses: [
      { pieces: 2, stats: { defense: 5, maxHp: 8 } },
      { pieces: 3, stats: { defense: 10, maxHp: 20 }, special: '+25% earth damage' },
      { pieces: 4, stats: { defense: 18, maxHp: 35 }, special: 'Regenerate 3% HP per turn', effect: 'earth_regen' },
    ],
  },
  wind_dancer: {
    id: 'wind_dancer',
    name: 'Zephyr Grace',
    description: 'Swift as the wind, untouchable.',
    color: '180 50% 65%', // Air cyan
    bonuses: [
      { pieces: 2, stats: { speed: 5, dodge: 4 } },
      { pieces: 3, stats: { speed: 10, dodge: 10 }, special: '+25% air damage' },
      { pieces: 4, stats: { speed: 15, dodge: 18 }, special: '30% chance to dodge any attack', effect: 'wind_evasion' },
    ],
  },
  void_walker: {
    id: 'void_walker',
    name: 'Abyssal Hunger',
    description: 'Draw power from the endless void.',
    color: '270 50% 35%', // Void purple
    bonuses: [
      { pieces: 2, stats: { special: 4, stamina: 4 } },
      { pieces: 3, stats: { special: 10, stamina: 8 }, special: '+25% void damage' },
      { pieces: 4, stats: { special: 18, stamina: 12, attack: 8 }, special: 'Heal 10% of damage dealt', effect: 'void_lifesteal' },
    ],
  },
};

// Helper to get set info
export function getSetInfo(setId: SetId): EquipmentSet {
  return EQUIPMENT_SETS[setId];
}

// Calculate active set bonuses from equipment
export interface ActiveSetBonus {
  set: EquipmentSet;
  equippedCount: number;
  activeBonuses: SetBonus[];
  totalStats: EquipmentStats;
}

export function calculateSetBonuses(equipment: MonsterEquipment): ActiveSetBonus[] {
  // Count pieces per set
  const setCounts: Record<string, number> = {};
  
  for (const item of Object.values(equipment)) {
    if (item?.setId) {
      setCounts[item.setId] = (setCounts[item.setId] || 0) + 1;
    }
  }
  
  // Calculate active bonuses
  const activeSetBonuses: ActiveSetBonus[] = [];
  
  for (const [setId, count] of Object.entries(setCounts)) {
    if (count >= 2) {
      const set = EQUIPMENT_SETS[setId as SetId];
      if (!set) continue;
      
      const activeBonuses = set.bonuses.filter(b => count >= b.pieces);
      const totalStats: EquipmentStats = {
        maxHp: 0, attack: 0, defense: 0, speed: 0, dodge: 0, special: 0, stamina: 0
      };
      
      for (const bonus of activeBonuses) {
        if (bonus.stats) {
          for (const [stat, value] of Object.entries(bonus.stats) as [keyof EquipmentStats, number][]) {
            if (value) totalStats[stat] = (totalStats[stat] || 0) + value;
          }
        }
      }
      
      activeSetBonuses.push({
        set,
        equippedCount: count,
        activeBonuses,
        totalStats,
      });
    }
  }
  
  return activeSetBonuses;
}

// Get total stats from set bonuses
export function calculateSetBonusStats(equipment: MonsterEquipment): EquipmentStats {
  const activeSetBonuses = calculateSetBonuses(equipment);
  const totals: EquipmentStats = {
    maxHp: 0, attack: 0, defense: 0, speed: 0, dodge: 0, special: 0, stamina: 0
  };
  
  for (const setBonus of activeSetBonuses) {
    for (const [stat, value] of Object.entries(setBonus.totalStats) as [keyof EquipmentStats, number][]) {
      if (value) totals[stat] = (totals[stat] || 0) + value;
    }
  }
  
  return totals;
}

// ============= EQUIPMENT TEMPLATES =============
interface EquipmentTemplate {
  name: string;
  slot: EquipmentSlot;
  baseStats: EquipmentStats;
  icon: string;
  element?: ElementType;
}

const HELMET_TEMPLATES: EquipmentTemplate[] = [
  { name: 'Leather Cap', slot: 'helmet', baseStats: { defense: 2, dodge: 1 }, icon: '🎩' },
  { name: 'Iron Helm', slot: 'helmet', baseStats: { defense: 4, maxHp: 5 }, icon: '⛑️' },
  { name: 'Wizard Hat', slot: 'helmet', baseStats: { special: 3, stamina: 3 }, icon: '🧙' },
  { name: 'Crown', slot: 'helmet', baseStats: { special: 4, speed: 2 }, icon: '👑' },
  { name: 'Horned Helm', slot: 'helmet', baseStats: { attack: 3, defense: 2 }, icon: '🪖' },
];

const ARMOR_TEMPLATES: EquipmentTemplate[] = [
  { name: 'Cloth Robe', slot: 'armor', baseStats: { special: 3, stamina: 4 }, icon: '👘' },
  { name: 'Leather Armor', slot: 'armor', baseStats: { defense: 4, dodge: 2 }, icon: '🦺' },
  { name: 'Chain Mail', slot: 'armor', baseStats: { defense: 6, maxHp: 8 }, icon: '🛡️' },
  { name: 'Plate Armor', slot: 'armor', baseStats: { defense: 10, maxHp: 15, speed: -2 }, icon: '🎽' },
  { name: 'Shadow Cloak', slot: 'armor', baseStats: { dodge: 6, speed: 3 }, icon: '🧥' },
];

const GLOVES_TEMPLATES: EquipmentTemplate[] = [
  { name: 'Cloth Gloves', slot: 'gloves', baseStats: { special: 2 }, icon: '🧤' },
  { name: 'Leather Bracers', slot: 'gloves', baseStats: { attack: 2, defense: 1 }, icon: '💪' },
  { name: 'Iron Gauntlets', slot: 'gloves', baseStats: { attack: 4, defense: 2 }, icon: '🤜' },
  { name: 'Spell Weavers', slot: 'gloves', baseStats: { special: 4, stamina: 2 }, icon: '✋' },
  { name: 'Thief Gloves', slot: 'gloves', baseStats: { speed: 2, dodge: 2 }, icon: '🖐️' },
];

const BOOTS_TEMPLATES: EquipmentTemplate[] = [
  { name: 'Sandals', slot: 'boots', baseStats: { speed: 2 }, icon: '🩴' },
  { name: 'Leather Boots', slot: 'boots', baseStats: { speed: 3, dodge: 1 }, icon: '👢' },
  { name: 'Iron Greaves', slot: 'boots', baseStats: { defense: 3, speed: 1 }, icon: '🥾' },
  { name: 'Swift Shoes', slot: 'boots', baseStats: { speed: 5, dodge: 3 }, icon: '👟' },
  { name: 'Heavy Stompers', slot: 'boots', baseStats: { attack: 2, defense: 3 }, icon: '🦶' },
];

const WEAPON_TEMPLATES: EquipmentTemplate[] = [
  { name: 'Wooden Club', slot: 'mainHand', baseStats: { attack: 3 }, icon: '🏏' },
  { name: 'Iron Sword', slot: 'mainHand', baseStats: { attack: 5, speed: 1 }, icon: '⚔️' },
  { name: 'Battle Axe', slot: 'mainHand', baseStats: { attack: 8, speed: -1 }, icon: '🪓' },
  { name: 'Magic Staff', slot: 'mainHand', baseStats: { special: 6, stamina: 3 }, icon: '🪄' },
  { name: 'Dagger', slot: 'mainHand', baseStats: { attack: 3, speed: 3 }, icon: '🗡️' },
  { name: 'Spear', slot: 'mainHand', baseStats: { attack: 5, defense: 2 }, icon: '🔱' },
  { name: 'Bow', slot: 'mainHand', baseStats: { attack: 4, dodge: 2 }, icon: '🏹' },
  { name: 'Wand', slot: 'mainHand', baseStats: { special: 4, stamina: 2 }, icon: '✨' },
];

const OFFHAND_TEMPLATES: EquipmentTemplate[] = [
  { name: 'Wooden Shield', slot: 'offHand', baseStats: { defense: 3 }, icon: '🛡️' },
  { name: 'Iron Shield', slot: 'offHand', baseStats: { defense: 5, maxHp: 5 }, icon: '🔰' },
  { name: 'Buckler', slot: 'offHand', baseStats: { defense: 2, dodge: 2 }, icon: '⭕' },
  { name: 'Tome', slot: 'offHand', baseStats: { special: 4, stamina: 2 }, icon: '📕' },
  { name: 'Orb', slot: 'offHand', baseStats: { special: 3, maxHp: 3 }, icon: '🔮' },
  { name: 'Parrying Dagger', slot: 'offHand', baseStats: { attack: 2, dodge: 3 }, icon: '🔪' },
];

const ACCESSORY_TEMPLATES: EquipmentTemplate[] = [
  { name: 'Power Ring', slot: 'accessory', baseStats: { attack: 3 }, icon: '💍' },
  { name: 'Defense Amulet', slot: 'accessory', baseStats: { defense: 3 }, icon: '📿' },
  { name: 'Speed Charm', slot: 'accessory', baseStats: { speed: 3 }, icon: '🎀' },
  { name: 'Lucky Coin', slot: 'accessory', baseStats: { dodge: 4 }, icon: '🪙' },
  { name: 'Mana Crystal', slot: 'accessory', baseStats: { special: 3, stamina: 3 }, icon: '💎' },
  { name: 'Health Pendant', slot: 'accessory', baseStats: { maxHp: 10 }, icon: '❤️' },
  { name: 'Stamina Band', slot: 'accessory', baseStats: { stamina: 5 }, icon: '⚡' },
];

// Back slot items: cloaks, capes, wings, backpacks, tails
const BACK_TEMPLATES: EquipmentTemplate[] = [
  { name: 'Travel Cloak', slot: 'back', baseStats: { defense: 2, dodge: 2 }, icon: '🧥' },
  { name: 'Shadow Cape', slot: 'back', baseStats: { dodge: 5, speed: 2 }, icon: '🦇' },
  { name: 'Battle Cape', slot: 'back', baseStats: { attack: 2, defense: 3 }, icon: '🎭' },
  { name: 'Wings of Speed', slot: 'back', baseStats: { speed: 6, dodge: 3 }, icon: '🪽' },
  { name: 'Feathered Wings', slot: 'back', baseStats: { speed: 4, dodge: 4 }, icon: '🕊️' },
  { name: 'Adventurer Pack', slot: 'back', baseStats: { maxHp: 8, stamina: 4 }, icon: '🎒' },
  { name: 'Supply Satchel', slot: 'back', baseStats: { stamina: 6, defense: 1 }, icon: '👝' },
  { name: 'Demon Tail', slot: 'back', baseStats: { attack: 4, special: 3 }, icon: '👹' },
  { name: 'Serpent Tail', slot: 'back', baseStats: { speed: 3, attack: 3 }, icon: '🐍' },
  { name: 'Fox Tail', slot: 'back', baseStats: { dodge: 5, special: 2 }, icon: '🦊' },
];

const ALL_TEMPLATES: Record<EquipmentSlot, EquipmentTemplate[]> = {
  helmet: HELMET_TEMPLATES,
  armor: ARMOR_TEMPLATES,
  gloves: GLOVES_TEMPLATES,
  boots: BOOTS_TEMPLATES,
  mainHand: WEAPON_TEMPLATES,
  offHand: OFFHAND_TEMPLATES,
  accessory: ACCESSORY_TEMPLATES,
  back: BACK_TEMPLATES,
};

// Slot display info
export const SLOT_INFO: Record<EquipmentSlot, { label: string; icon: string }> = {
  helmet: { label: 'Helmet', icon: '🎩' },
  armor: { label: 'Armor', icon: '🛡️' },
  gloves: { label: 'Gloves', icon: '🧤' },
  boots: { label: 'Boots', icon: '👢' },
  mainHand: { label: 'Main Hand', icon: '⚔️' },
  offHand: { label: 'Off Hand', icon: '🔰' },
  accessory: { label: 'Accessory', icon: '💍' },
  back: { label: 'Back', icon: '🧥' },
};

// ============= ELEMENTAL PREFIXES =============
const ELEMENT_PREFIXES: Record<ElementType, string[]> = {
  normal: ['Sturdy', 'Reliable', 'Plain'],
  fire: ['Blazing', 'Infernal', 'Scorching'],
  water: ['Tidal', 'Frozen', 'Aquatic'],
  earth: ['Stone', 'Terra', 'Granite'],
  air: ['Gale', 'Storm', 'Zephyr'],
  void: ['Shadow', 'Void', 'Eldritch'],
};

// ============= RARITY SUFFIXES =============
const RARITY_SUFFIXES: Record<Rarity, string[]> = {
  common: [''],
  uncommon: [' +1', ' of Quality'],
  rare: [' +2', ' of Power', ' of Excellence'],
  epic: [' +3', ' of Legends', ' of Mastery'],
  legendary: [' +5', ' of the Ancients', ' of Divinity', ' of Myth'],
};

// ============= EQUIPMENT GENERATION =============

export function generateRandomRarity(floorBonus: number = 0): Rarity {
  // Floor bonus increases chance of better loot
  const weights = { ...RARITY_DROP_WEIGHTS };
  
  // Each floor adds chance to rarer tiers
  weights.uncommon += floorBonus * 2;
  weights.rare += floorBonus * 1;
  weights.epic += floorBonus * 0.5;
  weights.legendary += floorBonus * 0.1;
  
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  
  for (const [rarity, weight] of Object.entries(weights)) {
    roll -= weight;
    if (roll <= 0) return rarity as Rarity;
  }
  
  return 'common';
}

// Mapping of elements to their corresponding sets
const ELEMENT_SET_MAPPING: Partial<Record<ElementType, SetId>> = {
  fire: 'fire_lord',
  water: 'frost_mage',
  earth: 'earth_warden',
  air: 'wind_dancer',
  void: 'void_walker',
};

// Class-themed sets assigned by stat focus
function determineSetFromStats(stats: EquipmentStats, rarity: Rarity, element?: ElementType): SetId | undefined {
  // Only rare+ items can be part of sets
  if (rarity === 'common' || rarity === 'uncommon') {
    return undefined;
  }
  
  // 70% chance for rare+ items to be part of a set
  if (Math.random() > 0.7) {
    return undefined;
  }
  
  // If elemental, prefer elemental set
  if (element && ELEMENT_SET_MAPPING[element] && Math.random() < 0.6) {
    return ELEMENT_SET_MAPPING[element];
  }
  
  // Otherwise, assign based on primary stat
  const statValues = Object.entries(stats).filter(([_, v]) => v && v > 0);
  if (statValues.length === 0) return undefined;
  
  const primaryStat = statValues.sort(([, a], [, b]) => (b || 0) - (a || 0))[0][0];
  
  const statSetMapping: Record<string, SetId[]> = {
    attack: ['warrior', 'berserker'],
    defense: ['guardian', 'earth_warden'],
    speed: ['rogue', 'wind_dancer'],
    dodge: ['rogue', 'wind_dancer'],
    special: ['mage', 'void_walker'],
    stamina: ['mage'],
    maxHp: ['guardian', 'warrior'],
  };
  
  const possibleSets = statSetMapping[primaryStat];
  if (possibleSets && possibleSets.length > 0) {
    return possibleSets[Math.floor(Math.random() * possibleSets.length)];
  }
  
  return undefined;
}

export function generateEquipment(
  slot?: EquipmentSlot,
  level: number = 1,
  rarity?: Rarity,
  element?: ElementType,
  forceSetId?: SetId
): EquipmentItem {
  // Pick random slot if not specified
  const slots: EquipmentSlot[] = ['helmet', 'armor', 'gloves', 'boots', 'mainHand', 'offHand', 'accessory'];
  const actualSlot = slot || slots[Math.floor(Math.random() * slots.length)];
  
  // Pick random template for slot
  const templates = ALL_TEMPLATES[actualSlot];
  const template = templates[Math.floor(Math.random() * templates.length)];
  
  // Generate rarity if not specified
  const actualRarity = rarity || generateRandomRarity(Math.floor(level / 2));
  
  // Optionally add element
  const actualElement = element || (Math.random() < 0.3 ? 
    (['fire', 'water', 'earth', 'air', 'void'] as ElementType[])[Math.floor(Math.random() * 5)] : 
    undefined);
  
  // Calculate stats with level and rarity scaling
  const levelMult = 1 + (level - 1) * 0.1;
  const rarityMult = RARITY_MULTIPLIERS[actualRarity];
  
  const scaledStats: EquipmentStats = {};
  for (const [stat, value] of Object.entries(template.baseStats) as [keyof EquipmentStats, number][]) {
    scaledStats[stat] = Math.round(value * levelMult * rarityMult);
  }
  
  // Determine set membership
  const setId = forceSetId || determineSetFromStats(scaledStats, actualRarity, actualElement);
  
  // Build name - include set name if part of a set
  const setInfo = setId ? EQUIPMENT_SETS[setId] : null;
  const setPrefix = setInfo ? `${setInfo.name.split(' ')[0]} ` : '';
  const elementPrefix = (!setInfo && actualElement) ? 
    ELEMENT_PREFIXES[actualElement][Math.floor(Math.random() * ELEMENT_PREFIXES[actualElement].length)] + ' ' : 
    '';
  const raritySuffix = RARITY_SUFFIXES[actualRarity][
    Math.floor(Math.random() * RARITY_SUFFIXES[actualRarity].length)
  ];
  const name = `${setPrefix}${elementPrefix}${template.name}${raritySuffix}`;
  
  return {
    id: `equip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name,
    slot: actualSlot,
    rarity: actualRarity,
    level,
    stats: scaledStats,
    element: actualElement,
    setId,
    icon: template.icon,
    description: generateEquipmentDescription(scaledStats, actualElement, setInfo?.name),
  };
}

function generateEquipmentDescription(stats: EquipmentStats, element?: ElementType, setName?: string): string {
  const parts: string[] = [];
  
  if (setName) {
    parts.push(`Part of the ${setName} set.`);
  }
  
  if (element) {
    parts.push(`Imbued with ${element} energy.`);
  }
  
  const statDescriptions: Record<keyof EquipmentStats, string> = {
    maxHp: 'Increases health',
    attack: 'Boosts attack power',
    defense: 'Improves defense',
    speed: 'Affects turn order',
    dodge: 'Increases evasion',
    special: 'Enhances special abilities',
    stamina: 'Expands stamina pool',
  };
  
  const mainStats = Object.entries(stats)
    .filter(([_, v]) => v && v > 0)
    .slice(0, 2)
    .map(([k]) => statDescriptions[k as keyof EquipmentStats])
    .join(' and ');
  
  if (mainStats) {
    parts.push(mainStats + '.');
  }
  
  return parts.join(' ') || 'A piece of equipment.';
}

// ============= EQUIPMENT ON MONSTER =============
export interface MonsterEquipment {
  helmet: EquipmentItem | null;
  armor: EquipmentItem | null;
  gloves: EquipmentItem | null;
  boots: EquipmentItem | null;
  mainHand: EquipmentItem | null;
  offHand: EquipmentItem | null;
  accessory: EquipmentItem | null;
  back: EquipmentItem | null;
}

export function createEmptyEquipment(): MonsterEquipment {
  return {
    helmet: null,
    armor: null,
    gloves: null,
    boots: null,
    mainHand: null,
    offHand: null,
    accessory: null,
    back: null,
  };
}

export function calculateEquipmentBonuses(equipment: MonsterEquipment): EquipmentStats {
  const totals: EquipmentStats = {
    maxHp: 0,
    attack: 0,
    defense: 0,
    speed: 0,
    dodge: 0,
    special: 0,
    stamina: 0,
  };
  
  for (const item of Object.values(equipment)) {
    if (item) {
      for (const [stat, value] of Object.entries(item.stats) as [keyof EquipmentStats, number][]) {
        if (value) {
          totals[stat] = (totals[stat] || 0) + value;
        }
      }
    }
  }
  
  return totals;
}

// ============= CRAFTING MATERIALS =============
export type MaterialType = 
  | 'ore' | 'hide' | 'essence' | 'gem' | 'bone' | 'fabric' | 'herb'
  | 'wood' | 'metal' | 'mote' | 'monster' | 'species' | 'class' | 'element'
  | 'rune' | 'soil' | 'seed';

export interface CraftingMaterial {
  id: string;
  name: string;
  type: MaterialType;
  rarity: Rarity;
  icon: string;
  value: number; // Gold value
  description?: string; // For herbs/plants
  // Affinity tags for species/class/element specific materials
  speciesAffinity?: import('./types').SpeciesType;
  classAffinity?: import('./types').ClassType;
  elementAffinity?: import('./types').ElementType;
}

export const CRAFTING_MATERIALS: CraftingMaterial[] = [
  // ============= DUNGEON STONES (mined from dungeon walls only) =============
  // Tiered hardness; feed into pickaxe upgrades and future dungeon-themed gear.
  { id: 'cavestone', name: 'Cavestone', type: 'ore', rarity: 'common', icon: '🪨', value: 4, description: 'Soft stone chipped from shallow dungeon walls.' },
  { id: 'deepstone', name: 'Deepstone', type: 'ore', rarity: 'uncommon', icon: '🗿', value: 14, description: 'Dense stone found in the deeper layers of dungeons.' },
  { id: 'coreshard', name: 'Coreshard', type: 'ore', rarity: 'rare', icon: '💎', value: 38, description: 'A glittering shard from the dungeon\'s core. Used for legendary tools.' },

  // ============= RUNE STONES (shoveled from rune tiles — placeable) =============
  // Each Rune Stone can be re-inscribed elsewhere as a matching rune tile.
  { id: 'rune_earth',      name: 'Earthen Rune Stone',  type: 'rune', rarity: 'common',    icon: '🪨', value: 8,  description: 'A sigil of grit. Place to inscribe an Earthen Rune.', elementAffinity: 'earth' },
  { id: 'rune_water',      name: 'Tidal Rune Stone',    type: 'rune', rarity: 'uncommon',  icon: '🌊', value: 18, description: 'A sigil of currents. Place to inscribe a Tidal Rune.',  elementAffinity: 'water' },
  { id: 'rune_fire',       name: 'Pyric Rune Stone',    type: 'rune', rarity: 'uncommon',  icon: '🔥', value: 18, description: 'A sigil of flame. Place to inscribe a Pyric Rune.',   elementAffinity: 'fire' },
  { id: 'rune_air',        name: 'Zephyr Rune Stone',   type: 'rune', rarity: 'uncommon',  icon: '💨', value: 18, description: 'A sigil of breath. Place to inscribe a Zephyr Rune.', elementAffinity: 'air' },
  { id: 'rune_kinetic',    name: 'Kinetic Rune Stone',  type: 'rune', rarity: 'rare',      icon: '⚔️', value: 32, description: 'A sigil of force. Place to inscribe a Kinetic Rune.', classAffinity: 'kinetic' },
  { id: 'rune_energy',     name: 'Energy Rune Stone',   type: 'rune', rarity: 'rare',      icon: '⚡', value: 32, description: 'A sigil of charge. Place to inscribe an Energy Rune.', classAffinity: 'energy' },
  { id: 'rune_chemical',   name: 'Chemical Rune Stone', type: 'rune', rarity: 'rare',      icon: '🧪', value: 32, description: 'A sigil of reagent. Place to inscribe a Chemical Rune.', classAffinity: 'chemical' },
  { id: 'rune_biological', name: 'Bio Rune Stone',      type: 'rune', rarity: 'epic',      icon: '🦑', value: 60, description: 'A sigil of life. Place to inscribe a Bio Rune.',     classAffinity: 'biological' },
  { id: 'rune_political',  name: 'Psychic Rune Stone',  type: 'rune', rarity: 'epic',      icon: '🔮', value: 60, description: 'A sigil of mind. Place to inscribe a Psychic Rune.',  classAffinity: 'political' },
  { id: 'rune_void',       name: 'Void Rune Stone',     type: 'rune', rarity: 'epic',      icon: '👁️', value: 60, description: 'A sigil of shadow. Place to inscribe a Void Rune.',  elementAffinity: 'void' },

  // ============= SOIL (shoveled from grass — feeds future farming) =============
  { id: 'soil', name: 'Soil', type: 'soil', rarity: 'common', icon: '🟫', value: 2, description: 'Loose earth from a grass tile. A reagent for future farming.' },



  // ============= BASIC ORES =============
  { id: 'iron_ore', name: 'Iron Ore', type: 'ore', rarity: 'common', icon: '🪨', value: 5 },
  { id: 'copper_ore', name: 'Copper Ore', type: 'ore', rarity: 'common', icon: '🟤', value: 4, description: 'A soft, malleable ore useful for basic crafting.' },
  { id: 'silver_ore', name: 'Silver Ore', type: 'ore', rarity: 'uncommon', icon: '🪙', value: 15 },
  { id: 'gold_ore', name: 'Gold Ore', type: 'ore', rarity: 'rare', icon: '✨', value: 30 },
  { id: 'mythril_ore', name: 'Mythril Ore', type: 'ore', rarity: 'epic', icon: '💠', value: 75 },
  { id: 'adamant_ore', name: 'Adamant Ore', type: 'ore', rarity: 'legendary', icon: '⬛', value: 200 },
  
  // ============= PROCESSED METALS =============
  { id: 'steel_ingot', name: 'Steel Ingot', type: 'metal', rarity: 'uncommon', icon: '🔩', value: 18, description: 'Refined iron, stronger and more durable.' },
  { id: 'mythril_ingot', name: 'Mythril Ingot', type: 'metal', rarity: 'epic', icon: '💎', value: 90, description: 'Refined mythril with magical conductivity.' },
  { id: 'adamantine_ingot', name: 'Adamantine Ingot', type: 'metal', rarity: 'legendary', icon: '⚫', value: 250, description: 'The hardest metal known to exist.' },
  
  // ============= WOOD =============
  { id: 'wood_log', name: 'Wood Log', type: 'wood', rarity: 'common', icon: '🪵', value: 3, description: 'Common lumber for basic crafting.' },
  { id: 'hardwood', name: 'Hardwood', type: 'wood', rarity: 'uncommon', icon: '🌳', value: 10, description: 'Dense wood from ancient trees.' },
  { id: 'ironwood', name: 'Ironwood', type: 'wood', rarity: 'rare', icon: '🪓', value: 28, description: 'Wood as hard as iron.' },
  { id: 'spiritwood', name: 'Spiritwood', type: 'wood', rarity: 'epic', icon: '🌲', value: 70, description: 'Wood infused with spiritual energy.' },
  { id: 'worldtree_branch', name: 'Worldtree Branch', type: 'wood', rarity: 'legendary', icon: '🌴', value: 180, description: 'A branch from the mythical Worldtree.' },
  { id: 'maple_sap', name: 'Maple Sap', type: 'wood', rarity: 'uncommon', icon: '🍁', value: 8, description: 'Sweet, sticky sap tapped from a maple tree.' },
  { id: 'elder_bark', name: 'Elder Bark', type: 'wood', rarity: 'rare', icon: '🌲', value: 22, description: 'Craggy bark from an ancient Elder Oak.' },

  // ============= SEEDS (dropped when trees are felled; replantable on tilled soil) =============
  { id: 'oak_acorn',    name: 'Oak Acorn',     type: 'seed', rarity: 'common',   icon: '🌰', value: 2, description: 'Plant on tilled soil to grow a new oak.' },
  { id: 'maple_samara', name: 'Maple Samara',  type: 'seed', rarity: 'uncommon', icon: '🍂', value: 6, description: 'A winged maple seed — flutters into freshly tilled ground.' },
  { id: 'elder_seed',   name: 'Elder Oak Seed', type: 'seed', rarity: 'rare',   icon: '🌲', value: 18, description: 'Rare seed from an Elder Oak. Slow to grow, worth the wait.' },
  
  // ============= HIDES & LEATHER =============
  { id: 'soft_hide', name: 'Soft Hide', type: 'hide', rarity: 'common', icon: '🟫', value: 3 },
  { id: 'leather', name: 'Leather', type: 'hide', rarity: 'common', icon: '👜', value: 5, description: 'Processed hide, ready for crafting.' },
  { id: 'tough_hide', name: 'Tough Hide', type: 'hide', rarity: 'uncommon', icon: '🦎', value: 10 },
  { id: 'hardened_leather', name: 'Hardened Leather', type: 'hide', rarity: 'uncommon', icon: '🧥', value: 15, description: 'Treated leather with improved durability.' },
  { id: 'dragon_scale', name: 'Dragon Scale', type: 'hide', rarity: 'rare', icon: '🐉', value: 40 },
  { id: 'void_leather', name: 'Void Leather', type: 'hide', rarity: 'epic', icon: '🌑', value: 80 },
  { id: 'primordial_hide', name: 'Primordial Hide', type: 'hide', rarity: 'legendary', icon: '🦖', value: 200, description: 'Hide from creatures of the old world.' },
  
  // ============= FABRICS =============
  { id: 'cloth_scrap', name: 'Cloth Scrap', type: 'fabric', rarity: 'common', icon: '🧵', value: 2 },
  { id: 'linen', name: 'Linen', type: 'fabric', rarity: 'common', icon: '🧶', value: 4, description: 'Simple woven fabric.' },
  { id: 'silk', name: 'Silk', type: 'fabric', rarity: 'uncommon', icon: '🕸️', value: 15 },
  { id: 'enchanted_cloth', name: 'Enchanted Cloth', type: 'fabric', rarity: 'rare', icon: '✨', value: 40 },
  { id: 'celestial_silk', name: 'Celestial Silk', type: 'fabric', rarity: 'epic', icon: '🌟', value: 85, description: 'Silk woven from starlight.' },
  { id: 'ethereal_weave', name: 'Ethereal Weave', type: 'fabric', rarity: 'legendary', icon: '👻', value: 190, description: 'Fabric that exists between realms.' },
  
  // ============= ELEMENTAL ESSENCES =============
  { id: 'fire_essence', name: 'Fire Essence', type: 'essence', rarity: 'uncommon', icon: '🔥', value: 20, elementAffinity: 'fire' },
  { id: 'water_essence', name: 'Water Essence', type: 'essence', rarity: 'uncommon', icon: '💧', value: 20, elementAffinity: 'water' },
  { id: 'earth_essence', name: 'Earth Essence', type: 'essence', rarity: 'uncommon', icon: '🌍', value: 20, elementAffinity: 'earth' },
  { id: 'air_essence', name: 'Air Essence', type: 'essence', rarity: 'uncommon', icon: '💨', value: 20, elementAffinity: 'air' },
  { id: 'void_essence', name: 'Void Essence', type: 'essence', rarity: 'rare', icon: '🌀', value: 50, elementAffinity: 'void' },
  { id: 'normal_essence', name: 'Neutral Essence', type: 'essence', rarity: 'uncommon', icon: '⚪', value: 18, elementAffinity: 'normal', description: 'A balanced, unaspected essence.' },
  
  // ============= ELEMENTAL MOTES (smaller essence fragments) =============
  { id: 'fire_mote', name: 'Fire Mote', type: 'mote', rarity: 'common', icon: '🌋', value: 6, elementAffinity: 'fire', description: 'A tiny ember of elemental fire.' },
  { id: 'water_mote', name: 'Water Mote', type: 'mote', rarity: 'common', icon: '🫧', value: 6, elementAffinity: 'water', description: 'A droplet of pure elemental water.' },
  { id: 'earth_mote', name: 'Earth Mote', type: 'mote', rarity: 'common', icon: '🪨', value: 6, elementAffinity: 'earth', description: 'A fragment of elemental earth.' },
  { id: 'wind_mote', name: 'Wind Mote', type: 'mote', rarity: 'common', icon: '🌬️', value: 6, elementAffinity: 'air', description: 'A whisper of elemental wind.' },
  { id: 'void_mote', name: 'Void Mote', type: 'mote', rarity: 'uncommon', icon: '🕳️', value: 12, elementAffinity: 'void', description: 'A speck of the endless void.' },
  
  // ============= ELEMENTAL CATALYSTS (rare crafting components) =============
  { id: 'fire_catalyst', name: 'Inferno Core', type: 'element', rarity: 'rare', icon: '☀️', value: 45, elementAffinity: 'fire', description: 'Concentrated fire for powerful crafting.' },
  { id: 'water_catalyst', name: 'Abyssal Pearl', type: 'element', rarity: 'rare', icon: '🐚', value: 45, elementAffinity: 'water', description: 'A pearl from the deepest waters.' },
  { id: 'earth_catalyst', name: 'Seismic Crystal', type: 'element', rarity: 'rare', icon: '💠', value: 45, elementAffinity: 'earth', description: 'A crystal vibrating with tectonic power.' },
  { id: 'air_catalyst', name: 'Tempest Feather', type: 'element', rarity: 'rare', icon: '🪶', value: 45, elementAffinity: 'air', description: 'A feather from a storm elemental.' },
  { id: 'void_catalyst', name: 'Null Shard', type: 'element', rarity: 'epic', icon: '🔮', value: 95, elementAffinity: 'void', description: 'A shard of crystallized nothingness.' },
  
  // ============= GEMS =============
  { id: 'ruby', name: 'Ruby', type: 'gem', rarity: 'rare', icon: '❤️', value: 35 },
  { id: 'sapphire', name: 'Sapphire', type: 'gem', rarity: 'rare', icon: '💙', value: 35 },
  { id: 'emerald', name: 'Emerald', type: 'gem', rarity: 'rare', icon: '💚', value: 35 },
  { id: 'topaz', name: 'Topaz', type: 'gem', rarity: 'rare', icon: '💛', value: 32, description: 'A golden gem of clarity.' },
  { id: 'amethyst', name: 'Amethyst', type: 'gem', rarity: 'rare', icon: '💜', value: 32, description: 'A purple gem of mystical power.' },
  { id: 'diamond', name: 'Diamond', type: 'gem', rarity: 'epic', icon: '💎', value: 100 },
  { id: 'prismatic_gem', name: 'Prismatic Gem', type: 'gem', rarity: 'legendary', icon: '🌈', value: 220, description: 'A gem containing all colors of light.' },
  
  // ============= BONES =============
  { id: 'bone_fragment', name: 'Bone Fragment', type: 'bone', rarity: 'common', icon: '🦴', value: 4 },
  { id: 'monster_bone', name: 'Monster Bone', type: 'bone', rarity: 'uncommon', icon: '💀', value: 12 },
  { id: 'elder_bone', name: 'Elder Bone', type: 'bone', rarity: 'rare', icon: '☠️', value: 45 },
  { id: 'ancient_fossil', name: 'Ancient Fossil', type: 'bone', rarity: 'epic', icon: '🦕', value: 88, description: 'Bones from creatures long extinct.' },
  
  // ============= DRAGON MATERIALS =============
  { id: 'dragon_blood', name: 'Dragon Blood', type: 'monster', rarity: 'epic', icon: '🩸', value: 95, speciesAffinity: 'dragon', description: 'The searing blood of a dragon.' },
  { id: 'dragon_claw', name: 'Dragon Claw', type: 'monster', rarity: 'rare', icon: '🦅', value: 55, speciesAffinity: 'dragon', description: 'A razor-sharp dragon talon.' },
  { id: 'dragon_fang', name: 'Dragon Fang', type: 'monster', rarity: 'rare', icon: '🦷', value: 52, speciesAffinity: 'dragon', description: 'A tooth that can pierce anything.' },
  { id: 'dragon_heart', name: 'Dragon Heart', type: 'monster', rarity: 'legendary', icon: '❤️‍🔥', value: 300, speciesAffinity: 'dragon', description: 'The still-beating heart of an ancient dragon.' },
  
  // ============= SPECIES-SPECIFIC MATERIALS =============
  // Fantasy species
  { id: 'slime_core', name: 'Slime Core', type: 'species', rarity: 'uncommon', icon: '🟢', value: 14, speciesAffinity: 'slime', description: 'The nucleus of a slime creature.' },
  { id: 'living_ichor', name: 'Living Ichor', type: 'species', rarity: 'rare', icon: '🧪', value: 38, speciesAffinity: 'slime', description: 'Sentient slime essence that pulses with life.' },
  { id: 'skeleton_dust', name: 'Skeleton Dust', type: 'species', rarity: 'common', icon: '💨', value: 5, speciesAffinity: 'skeleton', description: 'Powdered remains of undead bones.' },
  { id: 'soul_shard', name: 'Soul Shard', type: 'species', rarity: 'rare', icon: '👻', value: 42, speciesAffinity: 'skeleton', description: 'A fragment of bound spirit.' },
  { id: 'goblin_trinket', name: 'Goblin Trinket', type: 'species', rarity: 'common', icon: '🪤', value: 6, speciesAffinity: 'goblin', description: 'A shiny bauble hoarded by goblins.' },
  { id: 'goblin_ingenuity', name: 'Goblin Blueprint', type: 'species', rarity: 'rare', icon: '📜', value: 35, speciesAffinity: 'goblin', description: 'Clever goblin engineering plans.' },
  { id: 'spore_cluster', name: 'Spore Cluster', type: 'species', rarity: 'common', icon: '🍄', value: 5, speciesAffinity: 'mushroom', description: 'A cluster of magical fungal spores.' },
  { id: 'mycelia_heart', name: 'Mycelia Heart', type: 'species', rarity: 'rare', icon: '💗', value: 40, speciesAffinity: 'mushroom', description: 'The core network of a fungal being.' },
  { id: 'ectoplasm', name: 'Ectoplasm', type: 'species', rarity: 'uncommon', icon: '🫠', value: 16, speciesAffinity: 'ghost', description: 'Spectral residue left by ghosts.' },
  { id: 'phantom_essence', name: 'Phantom Essence', type: 'species', rarity: 'epic', icon: '💠', value: 75, speciesAffinity: 'ghost', description: 'Pure incorporeal energy.' },
  { id: 'imp_horn', name: 'Imp Horn', type: 'species', rarity: 'uncommon', icon: '📛', value: 14, speciesAffinity: 'imp', description: 'A small but potent demon horn.' },
  { id: 'demon_contract', name: 'Demon Contract', type: 'species', rarity: 'rare', icon: '📃', value: 48, speciesAffinity: 'imp', description: 'A binding contract with infernal power.' },
  { id: 'golem_core', name: 'Golem Core', type: 'species', rarity: 'rare', icon: '⚙️', value: 45, speciesAffinity: 'golem', description: 'The animating core of a golem.' },
  { id: 'primordial_clay', name: 'Primordial Clay', type: 'species', rarity: 'epic', icon: '🏺', value: 82, speciesAffinity: 'golem', description: 'The clay from which life was first shaped.' },
  { id: 'wisp_light', name: 'Wisp Light', type: 'species', rarity: 'uncommon', icon: '✨', value: 18, speciesAffinity: 'wisp', description: 'Captured light from a will-o-wisp.' },
  { id: 'radiant_core', name: 'Radiant Core', type: 'species', rarity: 'epic', icon: '☀️', value: 78, speciesAffinity: 'wisp', description: 'Pure concentrated light energy.' },
  { id: 'chimera_gland', name: 'Chimera Gland', type: 'species', rarity: 'rare', icon: '🧬', value: 50, speciesAffinity: 'chimera', description: 'An adaptive organ from a chimera.' },
  { id: 'hybrid_essence', name: 'Hybrid Essence', type: 'species', rarity: 'epic', icon: '🔀', value: 88, speciesAffinity: 'chimera', description: 'Essence containing multiple forms.' },
  
  // Real species
  { id: 'rat_tail', name: 'Rat Tail', type: 'species', rarity: 'common', icon: '🐀', value: 3, speciesAffinity: 'rat', description: 'A scavenged rat appendage.' },
  { id: 'plague_vial', name: 'Plague Vial', type: 'species', rarity: 'rare', icon: '🧫', value: 38, speciesAffinity: 'rat', description: 'Concentrated disease essence.' },
  { id: 'spider_silk_gland', name: 'Spider Silk Gland', type: 'species', rarity: 'uncommon', icon: '🕷️', value: 15, speciesAffinity: 'spider', description: 'The silk-producing organ of a spider.' },
  { id: 'venom_sac', name: 'Venom Sac', type: 'species', rarity: 'rare', icon: '☠️', value: 42, speciesAffinity: 'spider', description: 'Potent spider venom.' },
  { id: 'bat_wing', name: 'Bat Wing', type: 'species', rarity: 'common', icon: '🦇', value: 5, speciesAffinity: 'bat', description: 'Leathery wing membrane.' },
  { id: 'echo_crystal', name: 'Echo Crystal', type: 'species', rarity: 'rare', icon: '🔊', value: 40, speciesAffinity: 'bat', description: 'A crystal that resonates with sound.' },
  { id: 'snake_fang', name: 'Snake Fang', type: 'species', rarity: 'common', icon: '🐍', value: 5, speciesAffinity: 'snake', description: 'A venomous serpent tooth.' },
  { id: 'serpent_scale', name: 'Serpent Scale', type: 'species', rarity: 'uncommon', icon: '🪭', value: 16, speciesAffinity: 'snake', description: 'Iridescent snake scales.' },
  { id: 'wolf_pelt', name: 'Wolf Pelt', type: 'species', rarity: 'uncommon', icon: '🐺', value: 14, speciesAffinity: 'wolf', description: 'Thick fur from a wolf.' },
  { id: 'alpha_fang', name: 'Alpha Fang', type: 'species', rarity: 'rare', icon: '🦴', value: 45, speciesAffinity: 'wolf', description: 'A fang from a pack leader.' },
  { id: 'beetle_shell', name: 'Beetle Shell', type: 'species', rarity: 'common', icon: '🪲', value: 6, speciesAffinity: 'beetle', description: 'A hard chitinous shell.' },
  { id: 'armored_carapace', name: 'Armored Carapace', type: 'species', rarity: 'rare', icon: '🛡️', value: 48, speciesAffinity: 'beetle', description: 'An impenetrable beetle shell.' },
  { id: 'crow_feather', name: 'Crow Feather', type: 'species', rarity: 'common', icon: '🪶', value: 4, speciesAffinity: 'crow', description: 'A sleek black feather.' },
  { id: 'omen_eye', name: 'Omen Eye', type: 'species', rarity: 'rare', icon: '👁️', value: 44, speciesAffinity: 'crow', description: 'An eye that sees beyond.' },
  { id: 'shark_tooth', name: 'Shark Tooth', type: 'species', rarity: 'uncommon', icon: '🦈', value: 16, speciesAffinity: 'shark', description: 'A serrated predator tooth.' },
  { id: 'blood_frenzy_gland', name: 'Frenzy Gland', type: 'species', rarity: 'epic', icon: '🩸', value: 80, speciesAffinity: 'shark', description: 'The source of shark blood rage.' },
  { id: 'frog_mucus', name: 'Frog Mucus', type: 'species', rarity: 'common', icon: '🐸', value: 4, speciesAffinity: 'frog', description: 'Slippery amphibian secretion.' },
  { id: 'toxic_gland', name: 'Toxic Gland', type: 'species', rarity: 'rare', icon: '☣️', value: 38, speciesAffinity: 'frog', description: 'A gland filled with potent toxins.' },
  { id: 'jellyfish_bell', name: 'Jellyfish Bell', type: 'species', rarity: 'uncommon', icon: '🪼', value: 12, speciesAffinity: 'jellyfish', description: 'The translucent body of a jellyfish.' },
  { id: 'stinging_tendril', name: 'Stinging Tendril', type: 'species', rarity: 'rare', icon: '⚡', value: 42, speciesAffinity: 'jellyfish', description: 'A tendril crackling with energy.' },
  
  // ============= CLASS-SPECIFIC MATERIALS =============
  { id: 'kinetic_core', name: 'Kinetic Core', type: 'class', rarity: 'rare', icon: '💪', value: 42, classAffinity: 'kinetic', description: 'A core of pure physical energy.' },
  { id: 'momentum_crystal', name: 'Momentum Crystal', type: 'class', rarity: 'epic', icon: '🏃', value: 85, classAffinity: 'kinetic', description: 'A crystal storing motion energy.' },
  { id: 'energy_cell', name: 'Energy Cell', type: 'class', rarity: 'rare', icon: '🔋', value: 42, classAffinity: 'energy', description: 'A cell of condensed energy.' },
  { id: 'plasma_core', name: 'Plasma Core', type: 'class', rarity: 'epic', icon: '⚡', value: 85, classAffinity: 'energy', description: 'Superheated plasma in solid form.' },
  { id: 'bio_sample', name: 'Bio Sample', type: 'class', rarity: 'rare', icon: '🧬', value: 42, classAffinity: 'biological', description: 'A sample of living tissue.' },
  { id: 'vital_essence', name: 'Vital Essence', type: 'class', rarity: 'epic', icon: '❤️', value: 85, classAffinity: 'biological', description: 'Pure life force in liquid form.' },
  { id: 'reagent_vial', name: 'Reagent Vial', type: 'class', rarity: 'rare', icon: '⚗️', value: 42, classAffinity: 'chemical', description: 'A vial of reactive chemicals.' },
  { id: 'catalyst_compound', name: 'Catalyst Compound', type: 'class', rarity: 'epic', icon: '💊', value: 85, classAffinity: 'chemical', description: 'A compound that accelerates reactions.' },
  { id: 'influence_sigil', name: 'Influence Sigil', type: 'class', rarity: 'rare', icon: '📜', value: 42, classAffinity: 'political', description: 'A symbol of social power.' },
  { id: 'authority_seal', name: 'Authority Seal', type: 'class', rarity: 'epic', icon: '👑', value: 85, classAffinity: 'political', description: 'A seal granting absolute authority.' },
  { id: 'balanced_core', name: 'Balanced Core', type: 'class', rarity: 'uncommon', icon: '☯️', value: 18, classAffinity: 'normal', description: 'A perfectly balanced energy core.' },
  
  // ============= HERBS (for potion crafting) =============
  // Common herbs - found on floors 1+
  { id: 'healing_herb', name: 'Healing Herb', type: 'herb', rarity: 'common', icon: '🌿', value: 3, description: 'A common herb with restorative properties.' },
  { id: 'stamina_root', name: 'Stamina Root', type: 'herb', rarity: 'common', icon: '🥕', value: 3, description: 'An energizing root that restores vitality.' },
  { id: 'antidote_leaf', name: 'Antidote Leaf', type: 'herb', rarity: 'common', icon: '🍃', value: 4, description: 'A bitter leaf that neutralizes poison.' },
  
  // Uncommon herbs - found on floors 2+
  { id: 'mana_blossom', name: 'Mana Blossom', type: 'herb', rarity: 'uncommon', icon: '🌸', value: 8, description: 'A mystical flower that enhances magical energy.' },
  { id: 'fire_pepper', name: 'Fire Pepper', type: 'herb', rarity: 'uncommon', icon: '🌶️', value: 10, description: 'A spicy pepper that ignites inner power.' },
  { id: 'ice_mint', name: 'Ice Mint', type: 'herb', rarity: 'uncommon', icon: '❄️', value: 10, description: 'A cooling mint that soothes burns.' },
  { id: 'revive_moss', name: 'Revive Moss', type: 'herb', rarity: 'uncommon', icon: '🪴', value: 12, description: 'A rare moss with life-restoring properties.' },
  
  // Rare herbs - found on floors 4+
  { id: 'golden_ginseng', name: 'Golden Ginseng', type: 'herb', rarity: 'rare', icon: '✨', value: 25, description: 'A prized root with powerful healing properties.' },
  { id: 'phoenix_flower', name: 'Phoenix Flower', type: 'herb', rarity: 'rare', icon: '🔥', value: 30, description: 'A blazing flower said to revive the fallen.' },
  { id: 'panacea_petal', name: 'Panacea Petal', type: 'herb', rarity: 'rare', icon: '🌺', value: 35, description: 'A miraculous petal that cures all ailments.' },
  
  // Epic herbs - found on floors 6+
  { id: 'miracle_lotus', name: 'Miracle Lotus', type: 'herb', rarity: 'epic', icon: '🪷', value: 60, description: 'A legendary lotus with unmatched restorative power.' },
];

// ============= CRAFTING RECIPES =============
export interface CraftingRecipe {
  id: string;
  name: string;
  resultSlot: EquipmentSlot;
  resultRarity: Rarity;
  materials: { materialId: string; quantity: number }[];
  element?: ElementType;
  icon: string;
  description: string;
  // Affinity system for recipes
  affinityRequired?: AffinityRequirement;  // Resulting item requires this to equip
  affinityBonus?: AffinityBonus;           // Resulting item gives bonus to this
}

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  // ============= COMMON RECIPES (all slots) =============
  {
    id: 'craft_iron_sword',
    name: 'Iron Sword',
    resultSlot: 'mainHand',
    resultRarity: 'common',
    materials: [{ materialId: 'iron_ore', quantity: 3 }],
    icon: '⚔️',
    description: 'A basic but reliable sword.',
  },
  {
    id: 'craft_wooden_shield',
    name: 'Wooden Shield',
    resultSlot: 'offHand',
    resultRarity: 'common',
    materials: [{ materialId: 'iron_ore', quantity: 2 }, { materialId: 'soft_hide', quantity: 1 }],
    icon: '🛡️',
    description: 'A simple wooden shield.',
  },
  {
    id: 'craft_leather_cap',
    name: 'Leather Cap',
    resultSlot: 'helmet',
    resultRarity: 'common',
    materials: [{ materialId: 'soft_hide', quantity: 3 }],
    icon: '🧢',
    description: 'A simple leather cap.',
  },
  {
    id: 'craft_leather_armor',
    name: 'Leather Armor',
    resultSlot: 'armor',
    resultRarity: 'common',
    materials: [{ materialId: 'soft_hide', quantity: 4 }],
    icon: '🦺',
    description: 'Light armor for beginners.',
  },
  {
    id: 'craft_leather_gloves',
    name: 'Leather Gloves',
    resultSlot: 'gloves',
    resultRarity: 'common',
    materials: [{ materialId: 'soft_hide', quantity: 2 }],
    icon: '🧤',
    description: 'Basic leather gloves.',
  },
  {
    id: 'craft_leather_boots',
    name: 'Leather Boots',
    resultSlot: 'boots',
    resultRarity: 'common',
    materials: [{ materialId: 'soft_hide', quantity: 2 }, { materialId: 'cloth_scrap', quantity: 1 }],
    icon: '👢',
    description: 'Simple leather boots.',
  },
  {
    id: 'craft_copper_ring',
    name: 'Copper Ring',
    resultSlot: 'accessory',
    resultRarity: 'common',
    materials: [{ materialId: 'iron_ore', quantity: 2 }],
    icon: '💍',
    description: 'A simple copper ring.',
  },
  {
    id: 'craft_cloth_cape',
    name: 'Cloth Cape',
    resultSlot: 'back',
    resultRarity: 'common',
    materials: [{ materialId: 'cloth_scrap', quantity: 4 }],
    icon: '🧣',
    description: 'A simple cloth cape.',
  },
  
  // ============= UNCOMMON RECIPES (all slots) =============
  {
    id: 'craft_steel_blade',
    name: 'Steel Blade',
    resultSlot: 'mainHand',
    resultRarity: 'uncommon',
    materials: [{ materialId: 'iron_ore', quantity: 4 }, { materialId: 'silver_ore', quantity: 1 }],
    icon: '⚔️',
    description: 'A finely crafted steel sword.',
  },
  {
    id: 'craft_silver_shield',
    name: 'Silver Shield',
    resultSlot: 'offHand',
    resultRarity: 'uncommon',
    materials: [{ materialId: 'silver_ore', quantity: 3 }, { materialId: 'iron_ore', quantity: 2 }],
    icon: '🛡️',
    description: 'A polished shield with good defense.',
  },
  {
    id: 'craft_iron_helm',
    name: 'Iron Helm',
    resultSlot: 'helmet',
    resultRarity: 'uncommon',
    materials: [{ materialId: 'iron_ore', quantity: 3 }, { materialId: 'tough_hide', quantity: 1 }],
    icon: '⛑️',
    description: 'A sturdy iron helmet.',
  },
  {
    id: 'craft_chainmail',
    name: 'Chainmail',
    resultSlot: 'armor',
    resultRarity: 'uncommon',
    materials: [{ materialId: 'iron_ore', quantity: 5 }, { materialId: 'tough_hide', quantity: 2 }],
    icon: '🛡️',
    description: 'Flexible chainmail armor.',
  },
  {
    id: 'craft_iron_gauntlets',
    name: 'Iron Gauntlets',
    resultSlot: 'gloves',
    resultRarity: 'uncommon',
    materials: [{ materialId: 'iron_ore', quantity: 3 }, { materialId: 'tough_hide', quantity: 1 }],
    icon: '🧤',
    description: 'Sturdy iron gauntlets.',
  },
  {
    id: 'craft_swift_boots',
    name: 'Swift Boots',
    resultSlot: 'boots',
    resultRarity: 'uncommon',
    materials: [{ materialId: 'tough_hide', quantity: 3 }, { materialId: 'silk', quantity: 2 }],
    icon: '👟',
    description: 'Light boots that enhance speed.',
  },
  {
    id: 'craft_silver_amulet',
    name: 'Silver Amulet',
    resultSlot: 'accessory',
    resultRarity: 'uncommon',
    materials: [{ materialId: 'silver_ore', quantity: 3 }, { materialId: 'silk', quantity: 1 }],
    icon: '📿',
    description: 'A protective silver amulet.',
  },
  {
    id: 'craft_silk_cloak',
    name: 'Silk Cloak',
    resultSlot: 'back',
    resultRarity: 'uncommon',
    materials: [{ materialId: 'silk', quantity: 4 }, { materialId: 'tough_hide', quantity: 1 }],
    icon: '🧥',
    description: 'An elegant silk cloak.',
  },
  
  // ============= RARE RECIPES (all slots, elemental) =============
  {
    id: 'craft_flame_sword',
    name: 'Flame Sword',
    resultSlot: 'mainHand',
    resultRarity: 'rare',
    materials: [{ materialId: 'gold_ore', quantity: 2 }, { materialId: 'fire_essence', quantity: 3 }, { materialId: 'ruby', quantity: 1 }],
    element: 'fire',
    icon: '🔥',
    description: 'A blade wreathed in eternal flames.',
  },
  {
    id: 'craft_frost_shield',
    name: 'Frost Shield',
    resultSlot: 'offHand',
    resultRarity: 'rare',
    materials: [{ materialId: 'silver_ore', quantity: 3 }, { materialId: 'water_essence', quantity: 3 }, { materialId: 'sapphire', quantity: 1 }],
    element: 'water',
    icon: '❄️',
    description: 'A shield that freezes attackers.',
  },
  {
    id: 'craft_earth_crown',
    name: 'Earth Crown',
    resultSlot: 'helmet',
    resultRarity: 'rare',
    materials: [{ materialId: 'gold_ore', quantity: 2 }, { materialId: 'earth_essence', quantity: 3 }, { materialId: 'emerald', quantity: 1 }],
    element: 'earth',
    icon: '👑',
    description: 'A crown infused with earth energy.',
  },
  {
    id: 'craft_frost_armor',
    name: 'Frost Armor',
    resultSlot: 'armor',
    resultRarity: 'rare',
    materials: [{ materialId: 'silver_ore', quantity: 4 }, { materialId: 'water_essence', quantity: 3 }, { materialId: 'sapphire', quantity: 1 }],
    element: 'water',
    icon: '❄️',
    description: 'Armor that chills attackers.',
  },
  {
    id: 'craft_flame_gauntlets',
    name: 'Flame Gauntlets',
    resultSlot: 'gloves',
    resultRarity: 'rare',
    materials: [{ materialId: 'gold_ore', quantity: 2 }, { materialId: 'fire_essence', quantity: 2 }, { materialId: 'ruby', quantity: 1 }],
    element: 'fire',
    icon: '🔥',
    description: 'Gauntlets that burn with inner fire.',
  },
  {
    id: 'craft_wind_boots',
    name: 'Wind Boots',
    resultSlot: 'boots',
    resultRarity: 'rare',
    materials: [{ materialId: 'silk', quantity: 3 }, { materialId: 'air_essence', quantity: 3 }, { materialId: 'emerald', quantity: 1 }],
    element: 'air',
    icon: '💨',
    description: 'Boots that grant the speed of wind.',
  },
  {
    id: 'craft_elemental_ring',
    name: 'Elemental Ring',
    resultSlot: 'accessory',
    resultRarity: 'rare',
    materials: [{ materialId: 'gold_ore', quantity: 2 }, { materialId: 'fire_essence', quantity: 1 }, { materialId: 'water_essence', quantity: 1 }, { materialId: 'ruby', quantity: 1 }],
    icon: '💍',
    description: 'A ring pulsing with elemental power.',
  },
  {
    id: 'craft_wind_wings',
    name: 'Wind Wings',
    resultSlot: 'back',
    resultRarity: 'rare',
    materials: [{ materialId: 'silk', quantity: 4 }, { materialId: 'air_essence', quantity: 4 }],
    element: 'air',
    icon: '🪽',
    description: 'Ethereal wings of pure wind.',
  },
  
  // ============= EPIC RECIPES (all slots) =============
  {
    id: 'craft_void_blade',
    name: 'Void Blade',
    resultSlot: 'mainHand',
    resultRarity: 'epic',
    materials: [{ materialId: 'mythril_ore', quantity: 3 }, { materialId: 'void_essence', quantity: 4 }, { materialId: 'diamond', quantity: 1 }],
    element: 'void',
    icon: '🌑',
    description: 'A blade that cuts through reality.',
  },
  {
    id: 'craft_mythril_shield',
    name: 'Mythril Shield',
    resultSlot: 'offHand',
    resultRarity: 'epic',
    materials: [{ materialId: 'mythril_ore', quantity: 4 }, { materialId: 'diamond', quantity: 1 }],
    icon: '🛡️',
    description: 'An indestructible mythril shield.',
  },
  {
    id: 'craft_mythril_helm',
    name: 'Mythril Helm',
    resultSlot: 'helmet',
    resultRarity: 'epic',
    materials: [{ materialId: 'mythril_ore', quantity: 4 }, { materialId: 'diamond', quantity: 1 }],
    icon: '⛑️',
    description: 'A legendary helm of incredible protection.',
  },
  {
    id: 'craft_void_cloak',
    name: 'Void Cloak',
    resultSlot: 'armor',
    resultRarity: 'epic',
    materials: [{ materialId: 'void_leather', quantity: 3 }, { materialId: 'void_essence', quantity: 2 }, { materialId: 'enchanted_cloth', quantity: 2 }],
    element: 'void',
    icon: '🌑',
    description: 'A cloak woven from shadow itself.',
  },
  {
    id: 'craft_mythril_gauntlets',
    name: 'Mythril Gauntlets',
    resultSlot: 'gloves',
    resultRarity: 'epic',
    materials: [{ materialId: 'mythril_ore', quantity: 3 }, { materialId: 'void_leather', quantity: 2 }],
    icon: '🧤',
    description: 'Gauntlets of legendary strength.',
  },
  {
    id: 'craft_void_treads',
    name: 'Void Treads',
    resultSlot: 'boots',
    resultRarity: 'epic',
    materials: [{ materialId: 'void_leather', quantity: 3 }, { materialId: 'void_essence', quantity: 2 }, { materialId: 'mythril_ore', quantity: 1 }],
    element: 'void',
    icon: '👢',
    description: 'Boots that walk between dimensions.',
  },
  {
    id: 'craft_diamond_pendant',
    name: 'Diamond Pendant',
    resultSlot: 'accessory',
    resultRarity: 'epic',
    materials: [{ materialId: 'mythril_ore', quantity: 2 }, { materialId: 'diamond', quantity: 2 }],
    icon: '💎',
    description: 'A pendant of unmatched brilliance.',
  },
  {
    id: 'craft_shadow_wings',
    name: 'Shadow Wings',
    resultSlot: 'back',
    resultRarity: 'epic',
    materials: [{ materialId: 'void_leather', quantity: 4 }, { materialId: 'void_essence', quantity: 3 }, { materialId: 'enchanted_cloth', quantity: 2 }],
    element: 'void',
    icon: '🦇',
    description: 'Wings of pure shadow.',
  },
  
  // ============= LEGENDARY RECIPES (all slots) =============
  {
    id: 'craft_dragon_blade',
    name: 'Dragon Blade',
    resultSlot: 'mainHand',
    resultRarity: 'legendary',
    materials: [{ materialId: 'adamant_ore', quantity: 3 }, { materialId: 'dragon_scale', quantity: 5 }, { materialId: 'fire_essence', quantity: 4 }, { materialId: 'diamond', quantity: 2 }],
    element: 'fire',
    icon: '🐲',
    description: 'A blade forged in dragon fire, of unmatched power.',
  },
  {
    id: 'craft_aegis',
    name: 'Aegis',
    resultSlot: 'offHand',
    resultRarity: 'legendary',
    materials: [{ materialId: 'adamant_ore', quantity: 4 }, { materialId: 'dragon_scale', quantity: 3 }, { materialId: 'diamond', quantity: 2 }],
    icon: '🛡️',
    description: 'The legendary shield of heroes.',
  },
  {
    id: 'craft_dragon_crown',
    name: 'Dragon Crown',
    resultSlot: 'helmet',
    resultRarity: 'legendary',
    materials: [{ materialId: 'adamant_ore', quantity: 3 }, { materialId: 'dragon_scale', quantity: 4 }, { materialId: 'diamond', quantity: 2 }],
    element: 'fire',
    icon: '👑',
    description: 'A crown worn by dragon lords.',
  },
  {
    id: 'craft_dragon_armor',
    name: 'Dragon Armor',
    resultSlot: 'armor',
    resultRarity: 'legendary',
    materials: [{ materialId: 'adamant_ore', quantity: 5 }, { materialId: 'dragon_scale', quantity: 6 }, { materialId: 'diamond', quantity: 2 }],
    element: 'fire',
    icon: '🐉',
    description: 'Armor forged from dragon scales.',
  },
  {
    id: 'craft_dragon_claws',
    name: 'Dragon Claws',
    resultSlot: 'gloves',
    resultRarity: 'legendary',
    materials: [{ materialId: 'adamant_ore', quantity: 2 }, { materialId: 'dragon_scale', quantity: 4 }, { materialId: 'fire_essence', quantity: 3 }],
    element: 'fire',
    icon: '🐲',
    description: 'Gauntlets shaped like dragon claws.',
  },
  {
    id: 'craft_dragon_greaves',
    name: 'Dragon Greaves',
    resultSlot: 'boots',
    resultRarity: 'legendary',
    materials: [{ materialId: 'adamant_ore', quantity: 3 }, { materialId: 'dragon_scale', quantity: 4 }, { materialId: 'diamond', quantity: 1 }],
    element: 'fire',
    icon: '👢',
    description: 'Boots of unstoppable might.',
  },
  {
    id: 'craft_dragon_heart',
    name: 'Dragon Heart',
    resultSlot: 'accessory',
    resultRarity: 'legendary',
    materials: [{ materialId: 'dragon_scale', quantity: 5 }, { materialId: 'fire_essence', quantity: 4 }, { materialId: 'diamond', quantity: 3 }],
    element: 'fire',
    icon: '❤️‍🔥',
    description: 'A gem containing a dragon\'s heart.',
  },
  {
    id: 'craft_dragon_wings',
    name: 'Dragon Wings',
    resultSlot: 'back',
    resultRarity: 'legendary',
    materials: [{ materialId: 'dragon_scale', quantity: 6 }, { materialId: 'adamant_ore', quantity: 2 }, { materialId: 'fire_essence', quantity: 4 }, { materialId: 'diamond', quantity: 2 }],
    element: 'fire',
    icon: '🐉',
    description: 'Wings that grant the power of flight.',
  },
  
  // ============= CLASS-SPECIFIC RECIPES =============
  // Kinetic class items
  {
    id: 'craft_kinetic_fists',
    name: 'Force Knuckles',
    resultSlot: 'gloves',
    resultRarity: 'rare',
    materials: [{ materialId: 'iron_ore', quantity: 4 }, { materialId: 'earth_essence', quantity: 3 }],
    icon: '👊',
    description: 'Gloves that amplify physical force.',
    affinityBonus: { classType: 'kinetic', bonusStats: { attack: 8, speed: 4 }, bonusDescription: '+8 ATK, +4 SPD for Kinetic users' },
  },
  {
    id: 'craft_kinetic_armor',
    name: 'Impact Plate',
    resultSlot: 'armor',
    resultRarity: 'rare',
    materials: [{ materialId: 'iron_ore', quantity: 5 }, { materialId: 'tough_hide', quantity: 3 }],
    icon: '🛡️',
    description: 'Armor designed to redirect kinetic energy.',
    affinityRequired: { classType: 'kinetic' },
  },
  // Energy class items
  {
    id: 'craft_energy_staff',
    name: 'Conductor Staff',
    resultSlot: 'mainHand',
    resultRarity: 'rare',
    materials: [{ materialId: 'silver_ore', quantity: 3 }, { materialId: 'fire_essence', quantity: 2 }, { materialId: 'water_essence', quantity: 2 }],
    icon: '⚡',
    description: 'A staff that channels pure energy.',
    affinityBonus: { classType: 'energy', bonusStats: { special: 10, stamina: 5 }, bonusDescription: '+10 SPC, +5 STA for Energy users' },
  },
  {
    id: 'craft_energy_circlet',
    name: 'Spark Crown',
    resultSlot: 'helmet',
    resultRarity: 'rare',
    materials: [{ materialId: 'gold_ore', quantity: 2 }, { materialId: 'air_essence', quantity: 3 }],
    icon: '👑',
    description: 'A circlet crackling with energy.',
    affinityRequired: { classType: 'energy' },
  },
  // Biological class items
  {
    id: 'craft_bio_mask',
    name: 'Symbiote Mask',
    resultSlot: 'helmet',
    resultRarity: 'rare',
    materials: [{ materialId: 'soft_hide', quantity: 4 }, { materialId: 'water_essence', quantity: 2 }],
    icon: '🎭',
    description: 'A living mask that bonds with the wearer.',
    affinityBonus: { classType: 'biological', bonusStats: { maxHp: 15, defense: 3 }, bonusDescription: '+15 HP, +3 DEF for Biological users' },
  },
  {
    id: 'craft_bio_claws',
    name: 'Venom Claws',
    resultSlot: 'gloves',
    resultRarity: 'rare',
    materials: [{ materialId: 'tough_hide', quantity: 3 }, { materialId: 'void_essence', quantity: 2 }],
    icon: '🦎',
    description: 'Claws dripping with natural toxins.',
    affinityRequired: { classType: 'biological' },
  },
  // Chemical class items
  {
    id: 'craft_chem_vials',
    name: 'Alchemist Belt',
    resultSlot: 'accessory',
    resultRarity: 'rare',
    materials: [{ materialId: 'silk', quantity: 3 }, { materialId: 'fire_essence', quantity: 1 }, { materialId: 'water_essence', quantity: 1 }],
    icon: '🧪',
    description: 'A belt with vials of reactive substances.',
    affinityBonus: { classType: 'chemical', bonusStats: { special: 6, attack: 6 }, bonusDescription: '+6 SPC, +6 ATK for Chemical users' },
  },
  {
    id: 'craft_chem_coat',
    name: 'Reactive Coat',
    resultSlot: 'back',
    resultRarity: 'rare',
    materials: [{ materialId: 'enchanted_cloth', quantity: 3 }, { materialId: 'void_essence', quantity: 2 }],
    icon: '🧥',
    description: 'A coat that reacts to damage with chemical bursts.',
    affinityRequired: { classType: 'chemical' },
  },
  // Political class items
  {
    id: 'craft_diplomat_ring',
    name: 'Ring of Authority',
    resultSlot: 'accessory',
    resultRarity: 'rare',
    materials: [{ materialId: 'gold_ore', quantity: 4 }, { materialId: 'diamond', quantity: 1 }],
    icon: '💍',
    description: 'A ring that commands respect.',
    affinityBonus: { classType: 'political', bonusStats: { speed: 5, dodge: 5 }, bonusDescription: '+5 SPD, +5 DDG for Political users' },
  },
  {
    id: 'craft_diplomat_cape',
    name: 'Envoy\'s Mantle',
    resultSlot: 'back',
    resultRarity: 'rare',
    materials: [{ materialId: 'silk', quantity: 5 }, { materialId: 'gold_ore', quantity: 2 }],
    icon: '👔',
    description: 'A mantle worn by master negotiators.',
    affinityRequired: { classType: 'political' },
  },
  
  // ============= SPECIES-SPECIFIC RECIPES =============
  // Popular species items
  {
    id: 'craft_slime_core',
    name: 'Slime Core',
    resultSlot: 'accessory',
    resultRarity: 'epic',
    materials: [{ materialId: 'water_essence', quantity: 4 }, { materialId: 'void_essence', quantity: 2 }],
    icon: '💧',
    description: 'A crystallized slime essence.',
    affinityBonus: { species: 'slime', bonusStats: { maxHp: 25, defense: 8 }, bonusDescription: '+25 HP, +8 DEF for Slimes' },
  },
  {
    id: 'craft_dragon_scale_armor',
    name: 'Dragonkin Plate',
    resultSlot: 'armor',
    resultRarity: 'legendary',
    materials: [{ materialId: 'dragon_scale', quantity: 8 }, { materialId: 'adamant_ore', quantity: 4 }],
    icon: '🐲',
    description: 'Armor only a true dragon can wear.',
    affinityRequired: { species: 'dragon' },
  },
  {
    id: 'craft_ghost_shroud',
    name: 'Ethereal Shroud',
    resultSlot: 'back',
    resultRarity: 'epic',
    materials: [{ materialId: 'void_essence', quantity: 5 }, { materialId: 'enchanted_cloth', quantity: 3 }],
    icon: '👻',
    description: 'A shroud that phases between realities.',
    affinityBonus: { species: 'ghost', bonusStats: { dodge: 12, speed: 6 }, bonusDescription: '+12 DDG, +6 SPD for Ghosts' },
  },
  {
    id: 'craft_wolf_fangs',
    name: 'Alpha Fangs',
    resultSlot: 'accessory',
    resultRarity: 'rare',
    materials: [{ materialId: 'tough_hide', quantity: 4 }, { materialId: 'iron_ore', quantity: 3 }],
    icon: '🐺',
    description: 'Fangs that enhance pack instincts.',
    affinityBonus: { species: 'wolf', bonusStats: { attack: 10, speed: 5 }, bonusDescription: '+10 ATK, +5 SPD for Wolves' },
  },
  {
    id: 'craft_crow_mask',
    name: 'Thief\'s Mask',
    resultSlot: 'helmet',
    resultRarity: 'rare',
    materials: [{ materialId: 'soft_hide', quantity: 3 }, { materialId: 'silk', quantity: 2 }],
    icon: '🐦‍⬛',
    description: 'A mask that sharpens thieving instincts.',
    affinityBonus: { species: 'crow', bonusStats: { speed: 8, dodge: 6 }, bonusDescription: '+8 SPD, +6 DDG for Crows' },
  },
  {
    id: 'craft_golem_core',
    name: 'Stone Heart',
    resultSlot: 'accessory',
    resultRarity: 'epic',
    materials: [{ materialId: 'earth_essence', quantity: 5 }, { materialId: 'mythril_ore', quantity: 2 }],
    icon: '🗿',
    description: 'A core of living stone.',
    affinityRequired: { species: 'golem' },
  },
  
  // ============= COMBINATION RECIPES (Species + Element or Class + Element) =============
  {
    id: 'craft_fire_dragon_crown',
    name: 'Inferno Crown',
    resultSlot: 'helmet',
    resultRarity: 'legendary',
    materials: [{ materialId: 'dragon_scale', quantity: 6 }, { materialId: 'fire_essence', quantity: 6 }, { materialId: 'ruby', quantity: 2 }],
    element: 'fire',
    icon: '🔥',
    description: 'A crown blazing with dragon fire.',
    affinityBonus: { species: 'dragon', element: 'fire', bonusStats: { attack: 15, special: 15 }, bonusDescription: '+15 ATK, +15 SPC for Fire Dragons' },
  },
  {
    id: 'craft_void_ghost_chains',
    name: 'Phantom Chains',
    resultSlot: 'accessory',
    resultRarity: 'epic',
    materials: [{ materialId: 'void_essence', quantity: 4 }, { materialId: 'mythril_ore', quantity: 2 }],
    element: 'void',
    icon: '⛓️',
    description: 'Chains that bind souls to the void.',
    affinityBonus: { species: 'ghost', element: 'void', bonusStats: { special: 12, dodge: 10 }, bonusDescription: '+12 SPC, +10 DDG for Void Ghosts' },
  },
  {
    id: 'craft_kinetic_earth_gauntlets',
    name: 'Seismic Gauntlets',
    resultSlot: 'gloves',
    resultRarity: 'epic',
    materials: [{ materialId: 'earth_essence', quantity: 5 }, { materialId: 'iron_ore', quantity: 4 }, { materialId: 'mythril_ore', quantity: 1 }],
    element: 'earth',
    icon: '🌍',
    description: 'Gauntlets that cause earthquakes on impact.',
    affinityBonus: { classType: 'kinetic', element: 'earth', bonusStats: { attack: 15, defense: 8 }, bonusDescription: '+15 ATK, +8 DEF for Earth Kinetics' },
  },
  {
    id: 'craft_energy_fire_core',
    name: 'Plasma Core',
    resultSlot: 'accessory',
    resultRarity: 'epic',
    materials: [{ materialId: 'fire_essence', quantity: 4 }, { materialId: 'air_essence', quantity: 4 }, { materialId: 'ruby', quantity: 1 }],
    element: 'fire',
    icon: '☀️',
    description: 'A core of superheated plasma.',
    affinityBonus: { classType: 'energy', element: 'fire', bonusStats: { special: 18, stamina: 8 }, bonusDescription: '+18 SPC, +8 STA for Fire Energy types' },
  },
  {
    id: 'craft_water_shark_fins',
    name: 'Predator Fins',
    resultSlot: 'back',
    resultRarity: 'rare',
    materials: [{ materialId: 'water_essence', quantity: 4 }, { materialId: 'tough_hide', quantity: 3 }],
    element: 'water',
    icon: '🦈',
    description: 'Fins that cut through any current.',
    affinityBonus: { species: 'shark', element: 'water', bonusStats: { speed: 12, attack: 8 }, bonusDescription: '+12 SPD, +8 ATK for Water Sharks' },
  },
];

// ============= CONSUMABLE/POTION RECIPES =============
export type ConsumableEffect = 'heal_hp' | 'heal_stamina' | 'heal_full' | 'cure_poison' | 'cure_burn' | 'cure_freeze' | 'cure_all' | 'boost_attack' | 'boost_defense' | 'boost_speed' | 'revive' | 'revive_full' | 'reveal_stairs' | 'town_portal' | 'dowse';

export interface ConsumableRecipe {
  id: string;
  name: string;
  resultId: string; // ID matching the InventoryItem id used in-game
  rarity: Rarity;
  materials: { materialId: string; quantity: number }[];
  icon: string;
  description: string;
  effect: ConsumableEffect;
  effectValue?: number;
}

export const CONSUMABLE_RECIPES: ConsumableRecipe[] = [
  // ============= HEALING POTIONS =============
  {
    id: 'craft_small_potion',
    name: 'Small Potion',
    resultId: 'small_potion',
    rarity: 'common',
    materials: [{ materialId: 'healing_herb', quantity: 2 }],
    icon: '🧪',
    description: 'A basic healing potion. Restores 30 HP.',
    effect: 'heal_hp',
    effectValue: 30,
  },
  {
    id: 'craft_medium_potion',
    name: 'Medium Potion',
    resultId: 'medium_potion',
    rarity: 'uncommon',
    materials: [
      { materialId: 'healing_herb', quantity: 3 },
      { materialId: 'mana_blossom', quantity: 1 },
    ],
    icon: '🧪',
    description: 'A stronger healing potion. Restores 75 HP.',
    effect: 'heal_hp',
    effectValue: 75,
  },
  {
    id: 'craft_large_potion',
    name: 'Large Potion',
    resultId: 'large_potion',
    rarity: 'rare',
    materials: [
      { materialId: 'healing_herb', quantity: 4 },
      { materialId: 'golden_ginseng', quantity: 2 },
    ],
    icon: '🧪',
    description: 'A potent healing potion. Restores 150 HP.',
    effect: 'heal_hp',
    effectValue: 150,
  },
  
  // ============= STAMINA POTIONS =============
  {
    id: 'craft_stamina_tonic',
    name: 'Stamina Tonic',
    resultId: 'stamina_tonic',
    rarity: 'common',
    materials: [{ materialId: 'stamina_root', quantity: 2 }],
    icon: '⚗️',
    description: 'Restores 20 Stamina.',
    effect: 'heal_stamina',
    effectValue: 20,
  },
  {
    id: 'craft_energy_elixir',
    name: 'Energy Elixir',
    resultId: 'energy_elixir',
    rarity: 'uncommon',
    materials: [
      { materialId: 'stamina_root', quantity: 3 },
      { materialId: 'mana_blossom', quantity: 2 },
    ],
    icon: '⚗️',
    description: 'Restores 50 Stamina.',
    effect: 'heal_stamina',
    effectValue: 50,
  },
  
  // ============= STATUS CURES =============
  {
    id: 'craft_antidote',
    name: 'Antidote',
    resultId: 'antidote',
    rarity: 'common',
    materials: [{ materialId: 'antidote_leaf', quantity: 2 }],
    icon: '💊',
    description: 'Cures poison.',
    effect: 'cure_poison',
  },
  {
    id: 'craft_burn_salve',
    name: 'Burn Salve',
    resultId: 'burn_salve',
    rarity: 'common',
    materials: [
      { materialId: 'ice_mint', quantity: 2 },
      { materialId: 'healing_herb', quantity: 1 },
    ],
    icon: '🩹',
    description: 'Cures burn.',
    effect: 'cure_burn',
  },
  {
    id: 'craft_thaw_crystal',
    name: 'Thaw Crystal',
    resultId: 'thaw_crystal',
    rarity: 'common',
    materials: [
      { materialId: 'fire_pepper', quantity: 2 },
      { materialId: 'healing_herb', quantity: 1 },
    ],
    icon: '💎',
    description: 'Cures freeze.',
    effect: 'cure_freeze',
  },
  {
    id: 'craft_panacea',
    name: 'Panacea',
    resultId: 'panacea',
    rarity: 'rare',
    materials: [
      { materialId: 'panacea_petal', quantity: 2 },
      { materialId: 'golden_ginseng', quantity: 1 },
      { materialId: 'mana_blossom', quantity: 2 },
    ],
    icon: '✨',
    description: 'Cures all status effects.',
    effect: 'cure_all',
  },
  
  // ============= BUFF ITEMS =============
  {
    id: 'craft_battle_powder',
    name: 'Battle Powder',
    resultId: 'attack_boost',
    rarity: 'uncommon',
    materials: [
      { materialId: 'fire_pepper', quantity: 3 },
      { materialId: 'stamina_root', quantity: 1 },
    ],
    icon: '🔥',
    description: '+25% Attack for 5 turns.',
    effect: 'boost_attack',
    effectValue: 25,
  },
  {
    id: 'craft_iron_shell',
    name: 'Iron Shell',
    resultId: 'defense_boost',
    rarity: 'uncommon',
    materials: [
      { materialId: 'iron_ore', quantity: 2 },
      { materialId: 'earth_essence', quantity: 1 },
    ],
    icon: '🛡️',
    description: '+25% Defense for 5 turns.',
    effect: 'boost_defense',
    effectValue: 25,
  },
  {
    id: 'craft_swift_feather',
    name: 'Swift Feather',
    resultId: 'speed_boost',
    rarity: 'uncommon',
    materials: [
      { materialId: 'air_essence', quantity: 2 },
      { materialId: 'silk', quantity: 1 },
    ],
    icon: '🪶',
    description: '+25% Speed for 5 turns.',
    effect: 'boost_speed',
    effectValue: 25,
  },
  
  // ============= REVIVE ITEMS =============
  {
    id: 'craft_revive_herb',
    name: 'Revive Herb',
    resultId: 'revive_herb',
    rarity: 'uncommon',
    materials: [
      { materialId: 'revive_moss', quantity: 3 },
      { materialId: 'healing_herb', quantity: 2 },
    ],
    icon: '🌿',
    description: 'Revives a fainted party member with 25% HP.',
    effect: 'revive',
    effectValue: 25,
  },
  {
    id: 'craft_phoenix_feather',
    name: 'Phoenix Feather',
    resultId: 'phoenix_feather',
    rarity: 'rare',
    materials: [
      { materialId: 'phoenix_flower', quantity: 2 },
      { materialId: 'fire_essence', quantity: 2 },
      { materialId: 'revive_moss', quantity: 2 },
    ],
    icon: '🔥',
    description: 'Revives a fainted party member with 50% HP.',
    effect: 'revive',
    effectValue: 50,
  },
  {
    id: 'craft_miracle_elixir',
    name: 'Miracle Elixir',
    resultId: 'miracle_elixir',
    rarity: 'epic',
    materials: [
      { materialId: 'miracle_lotus', quantity: 2 },
      { materialId: 'phoenix_flower', quantity: 1 },
      { materialId: 'golden_ginseng', quantity: 2 },
      { materialId: 'diamond', quantity: 1 },
    ],
    icon: '⭐',
    description: 'Revives a fainted party member with full HP.',
    effect: 'revive_full',
  },

  // ============= UTILITY ITEMS =============
  {
    id: 'craft_dungeon_compass',
    name: 'Dungeon Compass',
    resultId: 'dungeon_compass',
    rarity: 'uncommon',
    materials: [
      { materialId: 'iron_ore', quantity: 2 },
      { materialId: 'mana_blossom', quantity: 1 },
    ],
    icon: '🧭',
    description: 'Single use. Pins a waypoint to this floor\'s exit stairs.',
    effect: 'reveal_stairs',
  },
  {
    id: 'craft_town_portal_scroll',
    name: 'Town Portal Scroll',
    resultId: 'town_portal_scroll',
    rarity: 'uncommon',
    materials: [
      { materialId: 'mana_blossom', quantity: 2 },
      { materialId: 'healing_herb', quantity: 1 },
    ],
    icon: '📜',
    description: 'Tears open a portal back to town. Required to flee any tower other than the Tower of the Infinite.',
    effect: 'town_portal',
  },
  {
    id: 'craft_dowsing_rod',
    name: 'Dowsing Rod',
    resultId: 'dowsing_rod',
    rarity: 'uncommon',
    materials: [
      { materialId: 'iron_ore', quantity: 1 },
      { materialId: 'mana_blossom', quantity: 2 },
      { materialId: 'earth_essence', quantity: 1 },
    ],
    icon: '🔮',
    description: 'Highlights the nearest 5 enemies for 5 minutes — persists across dungeon floors and the overworld.',
    effect: 'dowse',
    effectValue: 5 * 60, // seconds (display hint)
  },
  // NOTE: Portable Workstation is now a singleton TOOL (see tools.ts WORKSTATION),
  // crafted under the Tools tab and triggered via a sidebar button. It is no
  // longer a consumable inventory item.
];

// Generate equipment from recipe
export function craftEquipment(recipe: CraftingRecipe, playerLevel: number): EquipmentItem {
  const item = generateEquipment(
    recipe.resultSlot,
    Math.max(1, playerLevel),
    recipe.resultRarity,
    recipe.element
  );
  
  // Add affinity info from recipe
  if (recipe.affinityRequired) {
    item.affinityRequired = recipe.affinityRequired;
  }
  if (recipe.affinityBonus) {
    item.affinityBonus = recipe.affinityBonus;
  }
  
  return item;
}

// Get matching recipe for an equipment item (for recipe unlocking)
export function getRecipeFromEquipment(item: EquipmentItem): CraftingRecipe | null {
  // Find a recipe that matches the item's slot and rarity
  // Also check element if the recipe has one, otherwise match any
  return CRAFTING_RECIPES.find(recipe => {
    // Must match slot and rarity
    if (recipe.resultSlot !== item.slot || recipe.resultRarity !== item.rarity) {
      return false;
    }
    // If recipe has element, it must match item element
    if (recipe.element && recipe.element !== item.element) {
      return false;
    }
    // If recipe has no element, it's a generic recipe for that slot/rarity
    return true;
  }) || null;
}

// Get matching consumable recipe for an inventory item (for recipe unlocking)
export function getConsumableRecipeFromItem(item: { id?: string; name?: string; effect?: string }): ConsumableRecipe | null {
  // Match by resultId or by name/effect
  return CONSUMABLE_RECIPES.find(recipe => {
    // First try to match by resultId
    if (item.id && recipe.resultId === item.id) return true;
    // Fallback: match by name (case insensitive)
    if (item.name && recipe.name.toLowerCase() === item.name.toLowerCase()) return true;
    // Fallback: match by effect
    if (item.effect && recipe.effect === item.effect) return true;
    return false;
  }) || null;
}

// Reverse lookup: list everything craftable from a given material.
// Returns a merged list of equipment recipes and consumable recipes that consume it.
export interface MaterialUsage {
  id: string;
  name: string;
  icon: string;
  rarity: Rarity;
  quantity: number; // amount of this material the recipe consumes
  kind: 'equipment' | 'consumable';
}

export function getRecipesUsingMaterial(materialId: string): MaterialUsage[] {
  const out: MaterialUsage[] = [];
  for (const r of CRAFTING_RECIPES) {
    const req = r.materials.find(m => m.materialId === materialId);
    if (req) {
      out.push({ id: r.id, name: r.name, icon: r.icon, rarity: r.resultRarity, quantity: req.quantity, kind: 'equipment' });
    }
  }
  for (const r of CONSUMABLE_RECIPES) {
    const req = r.materials.find(m => m.materialId === materialId);
    if (req) {
      out.push({ id: r.id, name: r.name, icon: r.icon, rarity: r.rarity, quantity: req.quantity, kind: 'consumable' });
    }
  }
  // Sort by rarity then name for readability
  const rarityOrder: Record<Rarity, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
  out.sort((a, b) => rarityOrder[a.rarity] - rarityOrder[b.rarity] || a.name.localeCompare(b.name));
  return out;
}

// Dismantle equipment into materials
export interface DismantleResult {
  materials: { materialId: string; quantity: number }[];
  totalValue: number;
}

export function dismantleEquipment(item: EquipmentItem): DismantleResult {
  const rarityMaterialMap: Record<Rarity, { materials: string[]; baseQty: number }> = {
    common: { materials: ['iron_ore', 'soft_hide', 'cloth_scrap'], baseQty: 1 },
    uncommon: { materials: ['silver_ore', 'tough_hide', 'silk'], baseQty: 2 },
    rare: { materials: ['gold_ore', 'fire_essence', 'water_essence', 'earth_essence', 'air_essence'], baseQty: 2 },
    epic: { materials: ['mythril_ore', 'void_essence', 'void_leather'], baseQty: 2 },
    legendary: { materials: ['adamant_ore', 'dragon_scale', 'diamond'], baseQty: 3 },
  };
  
  const config = rarityMaterialMap[item.rarity];
  const result: DismantleResult = {
    materials: [],
    totalValue: 0,
  };
  
  // Add 1-3 random materials based on rarity
  const numMaterials = Math.min(config.materials.length, 1 + Math.floor(Math.random() * 2));
  const shuffled = [...config.materials].sort(() => Math.random() - 0.5);
  
  for (let i = 0; i < numMaterials; i++) {
    const materialId = shuffled[i];
    const quantity = config.baseQty + Math.floor(Math.random() * 2);
    result.materials.push({ materialId, quantity });
    
    // Calculate value from material
    const material = CRAFTING_MATERIALS.find(m => m.id === materialId);
    result.totalValue += (material?.value || 1) * quantity;
  }
  
  return result;
}

// Generate random material drop based on floor
export function generateMaterialDrop(floor: number): CraftingMaterial | null {
  // 40% chance to drop material
  if (Math.random() > 0.4) return null;
  
  const rarity = generateRandomRarity(Math.floor(floor / 3));
  const validMaterials = CRAFTING_MATERIALS.filter(m => m.rarity === rarity);
  
  if (validMaterials.length === 0) return null;
  
  return validMaterials[Math.floor(Math.random() * validMaterials.length)];
}

// ============= AFFINITY SYSTEM HELPERS =============
import type { Monster } from './types';

// Check if a monster can equip an item (considering affinity requirements)
export function canEquipItem(item: EquipmentItem, monster: Monster): { canEquip: boolean; reason?: string } {
  // Check level requirement
  if (monster.level < item.level) {
    return { canEquip: false, reason: `Requires level ${item.level}` };
  }
  
  // Check affinity requirements (exclusive items)
  if (item.affinityRequired) {
    const req = item.affinityRequired;
    
    if (req.species && monster.species !== req.species) {
      return { canEquip: false, reason: `Only ${req.species} can equip` };
    }
    if (req.classType && monster.class !== req.classType) {
      return { canEquip: false, reason: `Only ${req.classType} class can equip` };
    }
    if (req.element && monster.element !== req.element) {
      return { canEquip: false, reason: `Only ${req.element} element can equip` };
    }
  }
  
  return { canEquip: true };
}

// Calculate bonus stats from affinity (for items with affinityBonus)
export function getAffinityBonusStats(item: EquipmentItem, monster: Monster): EquipmentStats | null {
  if (!item.affinityBonus) return null;
  
  const bonus = item.affinityBonus;
  let matches = true;
  
  // Check if monster matches all required affinities
  if (bonus.species && monster.species !== bonus.species) matches = false;
  if (bonus.classType && monster.class !== bonus.classType) matches = false;
  if (bonus.element && monster.element !== bonus.element) matches = false;
  
  return matches ? bonus.bonusStats : null;
}

// Get affinity description for display
export function getAffinityDescription(item: EquipmentItem): string | null {
  if (item.affinityRequired) {
    const parts: string[] = [];
    if (item.affinityRequired.species) parts.push(item.affinityRequired.species);
    if (item.affinityRequired.classType) parts.push(item.affinityRequired.classType);
    if (item.affinityRequired.element) parts.push(item.affinityRequired.element);
    return `🔒 ${parts.join(' + ')} only`;
  }
  
  if (item.affinityBonus?.bonusDescription) {
    return `✨ ${item.affinityBonus.bonusDescription}`;
  }
  
  return null;
}
