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

// ============= EQUIPMENT ITEM =============
export interface EquipmentItem {
  id: string;
  name: string;
  slot: EquipmentSlot;
  rarity: Rarity;
  level: number; // Required level to equip
  stats: EquipmentStats;
  element?: ElementType; // Elemental affinity (bonus damage/resistance)
  setId?: string; // For set bonuses
  description?: string;
  icon: string; // Emoji icon
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
export type MaterialType = 'ore' | 'hide' | 'essence' | 'gem' | 'bone' | 'fabric' | 'herb';

export interface CraftingMaterial {
  id: string;
  name: string;
  type: MaterialType;
  rarity: Rarity;
  icon: string;
  value: number; // Gold value
  description?: string; // For herbs/plants
}

export const CRAFTING_MATERIALS: CraftingMaterial[] = [
  // Ores
  { id: 'iron_ore', name: 'Iron Ore', type: 'ore', rarity: 'common', icon: '🪨', value: 5 },
  { id: 'silver_ore', name: 'Silver Ore', type: 'ore', rarity: 'uncommon', icon: '🪙', value: 15 },
  { id: 'gold_ore', name: 'Gold Ore', type: 'ore', rarity: 'rare', icon: '✨', value: 30 },
  { id: 'mythril_ore', name: 'Mythril Ore', type: 'ore', rarity: 'epic', icon: '💠', value: 75 },
  { id: 'adamant_ore', name: 'Adamant Ore', type: 'ore', rarity: 'legendary', icon: '⬛', value: 200 },
  
  // Hides
  { id: 'soft_hide', name: 'Soft Hide', type: 'hide', rarity: 'common', icon: '🟫', value: 3 },
  { id: 'tough_hide', name: 'Tough Hide', type: 'hide', rarity: 'uncommon', icon: '🦎', value: 10 },
  { id: 'dragon_scale', name: 'Dragon Scale', type: 'hide', rarity: 'rare', icon: '🐉', value: 40 },
  { id: 'void_leather', name: 'Void Leather', type: 'hide', rarity: 'epic', icon: '🌑', value: 80 },
  
  // Essences
  { id: 'fire_essence', name: 'Fire Essence', type: 'essence', rarity: 'uncommon', icon: '🔥', value: 20 },
  { id: 'water_essence', name: 'Water Essence', type: 'essence', rarity: 'uncommon', icon: '💧', value: 20 },
  { id: 'earth_essence', name: 'Earth Essence', type: 'essence', rarity: 'uncommon', icon: '🌍', value: 20 },
  { id: 'air_essence', name: 'Air Essence', type: 'essence', rarity: 'uncommon', icon: '💨', value: 20 },
  { id: 'void_essence', name: 'Void Essence', type: 'essence', rarity: 'rare', icon: '🌀', value: 50 },
  
  // Gems
  { id: 'ruby', name: 'Ruby', type: 'gem', rarity: 'rare', icon: '❤️', value: 35 },
  { id: 'sapphire', name: 'Sapphire', type: 'gem', rarity: 'rare', icon: '💙', value: 35 },
  { id: 'emerald', name: 'Emerald', type: 'gem', rarity: 'rare', icon: '💚', value: 35 },
  { id: 'diamond', name: 'Diamond', type: 'gem', rarity: 'epic', icon: '💎', value: 100 },
  
  // Bones
  { id: 'bone_fragment', name: 'Bone Fragment', type: 'bone', rarity: 'common', icon: '🦴', value: 4 },
  { id: 'monster_bone', name: 'Monster Bone', type: 'bone', rarity: 'uncommon', icon: '💀', value: 12 },
  { id: 'elder_bone', name: 'Elder Bone', type: 'bone', rarity: 'rare', icon: '☠️', value: 45 },
  
  // Fabrics
  { id: 'cloth_scrap', name: 'Cloth Scrap', type: 'fabric', rarity: 'common', icon: '🧵', value: 2 },
  { id: 'silk', name: 'Silk', type: 'fabric', rarity: 'uncommon', icon: '🕸️', value: 15 },
  { id: 'enchanted_cloth', name: 'Enchanted Cloth', type: 'fabric', rarity: 'rare', icon: '✨', value: 40 },
  
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
}

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  // Common recipes
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
    id: 'craft_leather_armor',
    name: 'Leather Armor',
    resultSlot: 'armor',
    resultRarity: 'common',
    materials: [{ materialId: 'soft_hide', quantity: 4 }],
    icon: '🦺',
    description: 'Light armor for beginners.',
  },
  {
    id: 'craft_cloth_robe',
    name: 'Cloth Robe',
    resultSlot: 'armor',
    resultRarity: 'common',
    materials: [{ materialId: 'cloth_scrap', quantity: 5 }],
    icon: '👘',
    description: 'A simple robe for spellcasters.',
  },
  
  // Uncommon recipes
  {
    id: 'craft_silver_shield',
    name: 'Silver Shield',
    resultSlot: 'offHand',
    resultRarity: 'uncommon',
    materials: [
      { materialId: 'silver_ore', quantity: 3 },
      { materialId: 'iron_ore', quantity: 2 },
    ],
    icon: '🛡️',
    description: 'A polished shield with good defense.',
  },
  {
    id: 'craft_swift_boots',
    name: 'Swift Boots',
    resultSlot: 'boots',
    resultRarity: 'uncommon',
    materials: [
      { materialId: 'tough_hide', quantity: 3 },
      { materialId: 'silk', quantity: 2 },
    ],
    icon: '👟',
    description: 'Light boots that enhance speed.',
  },
  
  // Rare elemental recipes
  {
    id: 'craft_flame_sword',
    name: 'Flame Sword',
    resultSlot: 'mainHand',
    resultRarity: 'rare',
    materials: [
      { materialId: 'gold_ore', quantity: 2 },
      { materialId: 'fire_essence', quantity: 3 },
      { materialId: 'ruby', quantity: 1 },
    ],
    element: 'fire',
    icon: '🔥',
    description: 'A blade wreathed in eternal flames.',
  },
  {
    id: 'craft_frost_armor',
    name: 'Frost Armor',
    resultSlot: 'armor',
    resultRarity: 'rare',
    materials: [
      { materialId: 'silver_ore', quantity: 4 },
      { materialId: 'water_essence', quantity: 3 },
      { materialId: 'sapphire', quantity: 1 },
    ],
    element: 'water',
    icon: '❄️',
    description: 'Armor that chills attackers.',
  },
  
  // Epic recipes
  {
    id: 'craft_void_cloak',
    name: 'Void Cloak',
    resultSlot: 'armor',
    resultRarity: 'epic',
    materials: [
      { materialId: 'void_leather', quantity: 3 },
      { materialId: 'void_essence', quantity: 2 },
      { materialId: 'enchanted_cloth', quantity: 2 },
    ],
    element: 'void',
    icon: '🌑',
    description: 'A cloak woven from shadow itself.',
  },
  {
    id: 'craft_mythril_helm',
    name: 'Mythril Helm',
    resultSlot: 'helmet',
    resultRarity: 'epic',
    materials: [
      { materialId: 'mythril_ore', quantity: 4 },
      { materialId: 'diamond', quantity: 1 },
    ],
    icon: '⛑️',
    description: 'A legendary helm of incredible protection.',
  },
  
  // Legendary recipe
  {
    id: 'craft_dragon_blade',
    name: 'Dragon Blade',
    resultSlot: 'mainHand',
    resultRarity: 'legendary',
    materials: [
      { materialId: 'adamant_ore', quantity: 3 },
      { materialId: 'dragon_scale', quantity: 5 },
      { materialId: 'fire_essence', quantity: 4 },
      { materialId: 'diamond', quantity: 2 },
    ],
    element: 'fire',
    icon: '🐲',
    description: 'A blade forged in dragon fire, of unmatched power.',
  },
];

// ============= CONSUMABLE/POTION RECIPES =============
export type ConsumableEffect = 'heal_hp' | 'heal_stamina' | 'heal_full' | 'cure_poison' | 'cure_burn' | 'cure_freeze' | 'cure_all' | 'boost_attack' | 'boost_defense' | 'boost_speed' | 'revive' | 'revive_full';

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
];

// Generate equipment from recipe
export function craftEquipment(recipe: CraftingRecipe, playerLevel: number): EquipmentItem {
  return generateEquipment(
    recipe.resultSlot,
    Math.max(1, playerLevel),
    recipe.resultRarity,
    recipe.element
  );
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
