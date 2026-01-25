// Equipment Utilities - Sorting, Auto-Equip, and SVG Icons

import { EquipmentItem, EquipmentSlot, Rarity, EquipmentStats, MonsterEquipment, createEmptyEquipment, RARITY_MULTIPLIERS, canEquipItem, getAffinityBonusStats } from './equipment';
import { ClassType, Monster } from './types';

// ============= SORTING OPTIONS =============
export type SortOption = 'rarity' | 'stat' | 'slot' | 'level' | 'set';

export interface SortConfig {
  option: SortOption;
  direction: 'asc' | 'desc';
  statFilter?: keyof EquipmentStats; // For stat-based sorting
}

const RARITY_ORDER: Record<Rarity, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 4,
  legendary: 5,
};

const SLOT_ORDER: Record<EquipmentSlot, number> = {
  helmet: 1,
  armor: 2,
  gloves: 3,
  boots: 4,
  mainHand: 5,
  offHand: 6,
  accessory: 7,
  back: 8,
};

export function sortEquipment(items: EquipmentItem[], config: SortConfig): EquipmentItem[] {
  const sorted = [...items].sort((a, b) => {
    let comparison = 0;
    
    switch (config.option) {
      case 'rarity':
        comparison = RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity];
        break;
      case 'stat':
        const statKey = config.statFilter || 'attack';
        const aStat = a.stats[statKey] || 0;
        const bStat = b.stats[statKey] || 0;
        comparison = aStat - bStat;
        break;
      case 'slot':
        comparison = SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot];
        break;
      case 'level':
        comparison = a.level - b.level;
        break;
      case 'set':
        const aSet = a.setId || '';
        const bSet = b.setId || '';
        comparison = aSet.localeCompare(bSet);
        // Secondary sort by rarity within set
        if (comparison === 0) {
          comparison = RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity];
        }
        break;
    }
    
    return config.direction === 'desc' ? -comparison : comparison;
  });
  
  return sorted;
}

// ============= AUTO-EQUIP =============
// Class-optimized stat priorities
const CLASS_STAT_PRIORITY: Record<ClassType, (keyof EquipmentStats)[]> = {
  normal: ['attack', 'defense', 'maxHp', 'speed', 'dodge', 'special', 'stamina'],
  kinetic: ['attack', 'maxHp', 'defense', 'speed', 'stamina', 'dodge', 'special'],
  energy: ['special', 'stamina', 'speed', 'dodge', 'maxHp', 'attack', 'defense'],
  biological: ['maxHp', 'defense', 'stamina', 'special', 'attack', 'speed', 'dodge'],
  chemical: ['special', 'attack', 'speed', 'dodge', 'stamina', 'defense', 'maxHp'],
  political: ['special', 'defense', 'dodge', 'maxHp', 'stamina', 'speed', 'attack'],
};

function calculateItemScore(item: EquipmentItem, priorities: (keyof EquipmentStats)[], monster?: Monster): number {
  let score = 0;
  
  // Base stats scoring
  priorities.forEach((stat, index) => {
    const value = item.stats[stat] || 0;
    const weight = (priorities.length - index) / priorities.length; // Higher priority = higher weight
    score += value * weight * RARITY_MULTIPLIERS[item.rarity];
  });
  
  // Add affinity bonus stats if monster matches
  if (monster) {
    const bonusStats = getAffinityBonusStats(item, monster);
    if (bonusStats) {
      priorities.forEach((stat, index) => {
        const value = bonusStats[stat] || 0;
        const weight = (priorities.length - index) / priorities.length;
        score += value * weight * 1.5; // Bonus stats are weighted extra
      });
    }
  }
  
  return score;
}

export function autoEquip(
  inventory: EquipmentItem[],
  classType: ClassType,
  monsterLevel: number,
  monster?: Monster
): { equipment: MonsterEquipment; usedItemIds: string[] } {
  const equipment = createEmptyEquipment();
  const usedItemIds: string[] = [];
  const priorities = CLASS_STAT_PRIORITY[classType];
  
  // Filter equippable items (level + affinity requirements)
  const equippable = inventory.filter(item => {
    if (item.level > monsterLevel) return false;
    
    // Check affinity requirements if monster is provided
    if (monster && item.affinityRequired) {
      const result = canEquipItem(item, monster);
      if (!result.canEquip) return false;
    }
    
    return true;
  });
  
  // Group by slot
  const bySlot: Record<EquipmentSlot, EquipmentItem[]> = {
    helmet: [],
    armor: [],
    gloves: [],
    boots: [],
    mainHand: [],
    offHand: [],
    accessory: [],
    back: [],
  };
  
  equippable.forEach(item => bySlot[item.slot].push(item));
  
  // For each slot, pick the best item
  (Object.keys(bySlot) as EquipmentSlot[]).forEach(slot => {
    const items = bySlot[slot];
    if (items.length === 0) return;
    
    // Score each item (consider affinity bonuses if monster provided)
    const scored = items.map(item => ({
      item,
      score: calculateItemScore(item, priorities, monster),
    }));
    
    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);
    
    // Equip the best
    const best = scored[0].item;
    equipment[slot] = best;
    usedItemIds.push(best.id);
  });
  
  return { equipment, usedItemIds };
}

// ============= SVG EQUIPMENT ICONS =============
// Simple, clean SVG paths for each equipment template
export interface EquipmentIconDef {
  path: string;
  viewBox: string;
  strokeWidth?: number;
}

// Equipment icons based on item names/types - simple silhouette style
const EQUIPMENT_ICONS: Record<string, EquipmentIconDef> = {
  // Helmets
  'Leather Cap': { path: 'M50,15 Q20,15 15,40 L15,50 Q15,55 25,55 L25,50 Q30,40 50,35 Q70,40 75,50 L75,55 Q85,55 85,50 L85,40 Q80,15 50,15 Z', viewBox: '0 0 100 70' },
  'Iron Helm': { path: 'M50,10 L20,35 L20,55 L30,60 L30,50 L50,45 L70,50 L70,60 L80,55 L80,35 Z M35,25 L50,15 L65,25', viewBox: '0 0 100 70' },
  'Wizard Hat': { path: 'M50,5 L35,50 Q20,55 15,60 L85,60 Q80,55 65,50 Z M50,5 Q55,15 52,25', viewBox: '0 0 100 70' },
  'Crown': { path: 'M15,35 L25,15 L35,30 L50,10 L65,30 L75,15 L85,35 L80,50 L20,50 Z', viewBox: '0 0 100 60' },
  'Horned Helm': { path: 'M50,25 Q25,25 20,45 L20,55 L80,55 L80,45 Q75,25 50,25 M20,35 L10,10 L25,30 M80,35 L90,10 L75,30', viewBox: '0 0 100 65' },
  
  // Armor
  'Cloth Robe': { path: 'M50,10 L35,15 L30,30 L25,55 L25,90 L40,90 L42,50 L50,45 L58,50 L60,90 L75,90 L75,55 L70,30 L65,15 Z', viewBox: '0 0 100 100' },
  'Leather Armor': { path: 'M50,15 L30,20 L25,35 L28,55 L35,55 L38,40 L50,35 L62,40 L65,55 L72,55 L75,35 L70,20 Z', viewBox: '0 0 100 65' },
  'Chain Mail': { path: 'M50,12 L28,18 L22,35 L25,60 L38,60 L40,40 L50,35 L60,40 L62,60 L75,60 L78,35 L72,18 Z M35,30 L65,30 M32,42 L68,42 M30,52 L70,52', viewBox: '0 0 100 70' },
  'Plate Armor': { path: 'M50,10 L25,18 L18,40 L20,65 L35,65 L38,45 L50,38 L62,45 L65,65 L80,65 L82,40 L75,18 Z M30,28 L50,22 L70,28 M28,50 L50,42 L72,50', viewBox: '0 0 100 75' },
  'Shadow Cloak': { path: 'M50,10 L25,20 Q15,40 20,70 Q30,85 50,90 Q70,85 80,70 Q85,40 75,20 Z M40,25 Q50,35 60,25', viewBox: '0 0 100 100' },
  
  // Gloves
  'Cloth Gloves': { path: 'M30,50 L25,20 L35,18 L38,35 L42,10 L48,10 L46,38 L52,8 L58,10 L54,40 L60,15 L66,18 L58,45 L55,55 L30,55 Z', viewBox: '0 0 85 65' },
  'Leather Bracers': { path: 'M25,20 L75,20 L78,35 L75,50 L25,50 L22,35 Z M30,28 L30,42 M70,28 L70,42', viewBox: '0 0 100 60' },
  'Iron Gauntlets': { path: 'M25,45 L20,15 L30,12 L33,30 L40,5 L50,5 L48,32 L56,5 L66,8 L58,35 L68,15 L78,22 L65,50 L25,50 Z', viewBox: '0 0 95 60' },
  'Spell Weavers': { path: 'M28,50 L22,18 L32,15 L35,32 L42,8 L52,10 L48,38 L56,12 L66,18 L55,45 L28,50 M35,25 A3,3 0 1,1 35,25.01 M55,20 A3,3 0 1,1 55,20.01', viewBox: '0 0 85 60' },
  'Thief Gloves': { path: 'M28,48 L24,20 L34,16 L36,32 L42,8 L50,10 L48,35 L55,12 L65,18 L55,45 L28,48 Z', viewBox: '0 0 85 58' },
  
  // Boots
  'Sandals': { path: 'M20,35 L80,35 L82,45 L75,48 L70,55 L30,55 L25,48 L18,45 Z M35,35 L35,25 L50,20 L65,25 L65,35', viewBox: '0 0 100 60' },
  'Leather Boots': { path: 'M25,50 L20,20 L35,15 L38,35 L62,35 L65,15 L80,20 L75,50 L70,55 L30,55 Z', viewBox: '0 0 100 60' },
  'Iron Greaves': { path: 'M22,55 L18,18 L32,12 L38,30 L62,30 L68,12 L82,18 L78,55 L22,55 Z M28,25 L28,45 M72,25 L72,45', viewBox: '0 0 100 60' },
  'Swift Shoes': { path: 'M15,45 L12,25 L30,20 L45,25 L55,25 L70,20 L88,25 L85,45 L75,50 L25,50 Z M20,35 L8,30 M80,35 L92,30', viewBox: '0 0 100 55' },
  'Heavy Stompers': { path: 'M18,55 L15,15 L35,10 L40,35 L60,35 L65,10 L85,15 L82,55 L18,55 Z M25,20 L25,50 M75,20 L75,50', viewBox: '0 0 100 60' },
  
  // Weapons (Main Hand)
  'Wooden Club': { path: 'M45,85 L40,40 Q35,25 40,15 Q50,5 60,15 Q65,25 60,40 L55,85 Z', viewBox: '0 0 100 95' },
  'Iron Sword': { path: 'M50,10 L55,40 L60,42 L55,45 L52,80 L58,85 L50,90 L42,85 L48,80 L45,45 L40,42 L45,40 Z', viewBox: '0 0 100 100' },
  'Battle Axe': { path: 'M50,95 L50,35 M30,35 Q20,20 35,10 L50,25 L65,10 Q80,20 70,35 L50,35', viewBox: '0 0 100 100' },
  'Magic Staff': { path: 'M50,90 L50,30 M35,15 A15,15 0 1,1 65,15 A15,15 0 1,1 35,15 M50,15 L50,30', viewBox: '0 0 100 100' },
  'Dagger': { path: 'M50,15 L55,50 L60,52 L50,58 L40,52 L45,50 Z M45,58 L45,75 L55,75 L55,58', viewBox: '0 0 100 85' },
  'Spear': { path: 'M50,5 L58,25 L52,30 L52,95 L48,95 L48,30 L42,25 Z', viewBox: '0 0 100 100' },
  'Bow': { path: 'M30,10 Q10,50 30,90 M30,10 Q50,25 30,50 Q50,75 30,90 M30,50 L70,50 M65,45 L75,50 L65,55', viewBox: '0 0 85 100' },
  'Wand': { path: 'M48,85 L48,25 L52,25 L52,85 Z M40,15 A10,10 0 1,1 60,15 A10,10 0 1,1 40,15', viewBox: '0 0 100 95' },
  
  // Off-hand
  'Wooden Shield': { path: 'M50,10 Q85,20 85,50 Q85,85 50,95 Q15,85 15,50 Q15,20 50,10 Z M50,25 L50,80 M30,50 L70,50', viewBox: '0 0 100 100' },
  'Iron Shield': { path: 'M50,5 L85,20 L85,55 L50,95 L15,55 L15,20 Z M50,20 L50,75', viewBox: '0 0 100 100' },
  'Buckler': { path: 'M50,15 A35,35 0 1,1 50,85 A35,35 0 1,1 50,15 M50,25 A25,25 0 1,1 50,75 A25,25 0 1,1 50,25', viewBox: '0 0 100 100' },
  'Tome': { path: 'M20,10 L80,10 L85,15 L85,85 L80,90 L20,90 L15,85 L15,15 Z M25,10 L25,90 M35,20 L75,20 M35,35 L75,35 M35,50 L60,50', viewBox: '0 0 100 100' },
  'Orb': { path: 'M50,15 A35,35 0 1,1 50,85 A35,35 0 1,1 50,15 M35,40 Q45,30 60,45 M40,55 Q55,70 70,55', viewBox: '0 0 100 100' },
  'Parrying Dagger': { path: 'M50,10 L55,45 L65,48 L55,52 L52,70 L50,75 L48,70 L45,52 L35,48 L45,45 Z', viewBox: '0 0 100 85' },
  
  // Accessories
  'Power Ring': { path: 'M50,25 A25,25 0 1,1 50,75 A25,25 0 1,1 50,25 M50,35 A15,15 0 1,1 50,65 A15,15 0 1,1 50,35 M35,40 L30,30 L40,38', viewBox: '0 0 100 100' },
  'Defense Amulet': { path: 'M50,15 L65,40 L50,85 L35,40 Z M40,10 Q50,5 60,10 L60,20 L50,15 L40,20 Z', viewBox: '0 0 100 95' },
  'Speed Charm': { path: 'M50,20 L65,35 L60,40 L50,32 L40,40 L35,35 Z M50,40 L50,80 M35,60 L50,50 L65,60', viewBox: '0 0 100 90' },
  'Lucky Coin': { path: 'M50,15 A35,35 0 1,1 50,85 A35,35 0 1,1 50,15 M50,25 A25,25 0 1,1 50,75 A25,25 0 1,1 50,25 M45,45 L55,55 M45,55 L55,45', viewBox: '0 0 100 100' },
  'Mana Crystal': { path: 'M50,10 L70,30 L70,60 L50,90 L30,60 L30,30 Z M40,35 L50,25 L60,35 L60,55 L50,70 L40,55 Z', viewBox: '0 0 100 100' },
  'Health Pendant': { path: 'M50,30 Q65,30 70,45 Q75,65 50,85 Q25,65 30,45 Q35,30 50,30 Z M40,15 Q50,10 60,15 L55,25 L50,20 L45,25 Z', viewBox: '0 0 100 95' },
  'Stamina Band': { path: 'M20,40 L80,40 L85,50 L80,60 L20,60 L15,50 Z M30,40 L30,60 M50,40 L50,60 M70,40 L70,60', viewBox: '0 0 100 80' },
  
  // Back items
  'Travel Cloak': { path: 'M50,10 L25,20 Q15,45 22,80 Q35,92 50,95 Q65,92 78,80 Q85,45 75,20 Z', viewBox: '0 0 100 100' },
  'Shadow Cape': { path: 'M50,8 L20,18 Q8,50 18,85 Q30,95 50,98 Q70,95 82,85 Q92,50 80,18 Z M35,25 L50,15 L65,25', viewBox: '0 0 100 100' },
  'Battle Cape': { path: 'M50,10 L30,18 Q20,40 25,70 L35,80 L50,75 L65,80 L75,70 Q80,40 70,18 Z M40,30 L60,30', viewBox: '0 0 100 90' },
  'Wings of Speed': { path: 'M50,50 L25,20 Q5,25 10,50 Q5,75 25,80 L50,50 M50,50 L75,20 Q95,25 90,50 Q95,75 75,80 Z', viewBox: '0 0 100 100' },
  'Feathered Wings': { path: 'M50,50 L30,25 Q15,20 12,35 Q8,50 15,65 Q20,80 35,75 L50,55 M50,50 L70,25 Q85,20 88,35 Q92,50 85,65 Q80,80 65,75 L50,55', viewBox: '0 0 100 100' },
  'Adventurer Pack': { path: 'M30,20 L70,20 L75,30 L75,75 L25,75 L25,30 Z M35,10 L65,10 L70,20 L30,20 Z M40,40 L60,40 L60,55 L40,55 Z', viewBox: '0 0 100 85' },
  'Supply Satchel': { path: 'M25,25 L75,25 L80,35 L80,70 L20,70 L20,35 Z M30,15 L70,15 L75,25 L25,25 Z M35,40 L35,60 L55,60 L55,40 Z', viewBox: '0 0 100 80' },
  'Demon Tail': { path: 'M50,15 Q65,25 70,45 Q75,65 65,80 Q55,90 40,85 L38,78 Q50,82 58,72 Q65,60 60,42 Q55,28 45,20 Z M40,85 L35,95 L45,90 Z', viewBox: '0 0 100 100' },
  'Serpent Tail': { path: 'M50,10 Q70,20 75,40 Q80,60 70,75 Q55,90 35,85 Q25,78 30,65 Q38,55 50,60 Q62,65 60,50 Q58,35 50,25 Z', viewBox: '0 0 100 100' },
  'Fox Tail': { path: 'M45,10 Q65,15 75,35 Q85,55 75,75 Q60,92 40,88 Q25,80 28,65 Q32,50 45,55 Q58,60 55,45 Q52,30 45,20 Z M40,88 L30,92 L38,85', viewBox: '0 0 100 100' },
};

// Default icon for unknown equipment
const DEFAULT_ICON: EquipmentIconDef = {
  path: 'M50,15 L80,50 L50,85 L20,50 Z M35,50 L65,50 M50,30 L50,70',
  viewBox: '0 0 100 100',
};

export function getEquipmentIcon(itemName: string): EquipmentIconDef {
  // Strip prefixes and suffixes to find base name
  const baseName = Object.keys(EQUIPMENT_ICONS).find(name => 
    itemName.includes(name)
  );
  
  return baseName ? EQUIPMENT_ICONS[baseName] : DEFAULT_ICON;
}

// ============= STAT DISPLAY HELPERS =============
export const STAT_ICONS: Record<keyof EquipmentStats, string> = {
  maxHp: '❤️',
  attack: '⚔️',
  defense: '🛡️',
  speed: '💨',
  dodge: '🎯',
  special: '✨',
  stamina: '⚡',
};

export const STAT_COLORS: Record<keyof EquipmentStats, string> = {
  maxHp: 'text-red-400',
  attack: 'text-orange-400',
  defense: 'text-blue-400',
  speed: 'text-cyan-400',
  dodge: 'text-yellow-400',
  special: 'text-purple-400',
  stamina: 'text-green-400',
};

// Get primary stat for an item (highest positive value)
export function getPrimaryStat(item: EquipmentItem): { stat: keyof EquipmentStats; value: number } | null {
  let highest: { stat: keyof EquipmentStats; value: number } | null = null;
  
  for (const [stat, value] of Object.entries(item.stats) as [keyof EquipmentStats, number | undefined][]) {
    if (value && value > 0) {
      if (!highest || value > highest.value) {
        highest = { stat, value };
      }
    }
  }
  
  return highest;
}
