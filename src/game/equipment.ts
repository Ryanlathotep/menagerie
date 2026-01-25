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
  setId?: string; // For set bonuses (future)
  description?: string;
  icon: string; // Emoji icon
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

export function generateEquipment(
  slot?: EquipmentSlot,
  level: number = 1,
  rarity?: Rarity,
  element?: ElementType
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
  
  // Build name
  const elementPrefix = actualElement ? 
    ELEMENT_PREFIXES[actualElement][Math.floor(Math.random() * ELEMENT_PREFIXES[actualElement].length)] + ' ' : 
    '';
  const raritySuffix = RARITY_SUFFIXES[actualRarity][
    Math.floor(Math.random() * RARITY_SUFFIXES[actualRarity].length)
  ];
  const name = `${elementPrefix}${template.name}${raritySuffix}`;
  
  return {
    id: `equip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name,
    slot: actualSlot,
    rarity: actualRarity,
    level,
    stats: scaledStats,
    element: actualElement,
    icon: template.icon,
    description: generateEquipmentDescription(scaledStats, actualElement),
  };
}

function generateEquipmentDescription(stats: EquipmentStats, element?: ElementType): string {
  const parts: string[] = [];
  
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
export type MaterialType = 'ore' | 'hide' | 'essence' | 'gem' | 'bone' | 'fabric';

export interface CraftingMaterial {
  id: string;
  name: string;
  type: MaterialType;
  rarity: Rarity;
  icon: string;
  value: number; // Gold value
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

// Generate equipment from recipe
export function craftEquipment(recipe: CraftingRecipe, playerLevel: number): EquipmentItem {
  return generateEquipment(
    recipe.resultSlot,
    Math.max(1, playerLevel),
    recipe.resultRarity,
    recipe.element
  );
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
