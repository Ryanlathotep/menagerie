// Monster Drop Tables - Species-specific loot when defeating enemies

import { SpeciesType } from './types';
import { CraftingMaterial, CRAFTING_MATERIALS, EquipmentItem, generateEquipment, MonsterEquipment, EquipmentSlot, createEmptyEquipment } from './equipment';

// Drop table entry
export interface DropTableEntry {
  materialId: string;
  baseChance: number; // Base drop chance (0-100)
  minFloor?: number;  // Minimum floor to drop
}

// Species drop tables - each species drops specific materials
export const SPECIES_DROP_TABLES: Record<SpeciesType, DropTableEntry[]> = {
  // Fantasy species
  slime: [
    { materialId: 'slime_core', baseChance: 35 },
    { materialId: 'living_ichor', baseChance: 10, minFloor: 3 },
  ],
  skeleton: [
    { materialId: 'skeleton_dust', baseChance: 40 },
    { materialId: 'bone_fragment', baseChance: 30 },
    { materialId: 'soul_shard', baseChance: 8, minFloor: 4 },
  ],
  goblin: [
    { materialId: 'goblin_trinket', baseChance: 40 },
    { materialId: 'goblin_ingenuity', baseChance: 12, minFloor: 3 },
  ],
  mushroom: [
    { materialId: 'spore_cluster', baseChance: 45 },
    { materialId: 'mycelia_heart', baseChance: 10, minFloor: 4 },
  ],
  ghost: [
    { materialId: 'ectoplasm', baseChance: 35 },
    { materialId: 'phantom_essence', baseChance: 8, minFloor: 5 },
  ],
  imp: [
    { materialId: 'imp_horn', baseChance: 35 },
    { materialId: 'demon_contract', baseChance: 10, minFloor: 4 },
  ],
  golem: [
    { materialId: 'iron_ore', baseChance: 30 },
    { materialId: 'golem_core', baseChance: 15, minFloor: 3 },
    { materialId: 'primordial_clay', baseChance: 6, minFloor: 6 },
  ],
  wisp: [
    { materialId: 'wisp_light', baseChance: 40 },
    { materialId: 'radiant_core', baseChance: 8, minFloor: 5 },
  ],
  chimera: [
    { materialId: 'chimera_gland', baseChance: 25 },
    { materialId: 'hybrid_essence', baseChance: 10, minFloor: 5 },
  ],
  dragon: [
    { materialId: 'dragon_scale', baseChance: 30 },
    { materialId: 'dragon_claw', baseChance: 20 },
    { materialId: 'dragon_fang', baseChance: 15 },
    { materialId: 'dragon_blood', baseChance: 10, minFloor: 5 },
    { materialId: 'dragon_heart', baseChance: 3, minFloor: 7 },
  ],
  
  // Real species
  rat: [
    { materialId: 'rat_tail', baseChance: 45 },
    { materialId: 'soft_hide', baseChance: 25 },
    { materialId: 'plague_vial', baseChance: 8, minFloor: 4 },
  ],
  spider: [
    { materialId: 'spider_silk_gland', baseChance: 35 },
    { materialId: 'silk', baseChance: 25 },
    { materialId: 'venom_sac', baseChance: 12, minFloor: 3 },
  ],
  bat: [
    { materialId: 'bat_wing', baseChance: 45 },
    { materialId: 'echo_crystal', baseChance: 10, minFloor: 4 },
  ],
  snake: [
    { materialId: 'snake_fang', baseChance: 40 },
    { materialId: 'serpent_scale', baseChance: 30 },
  ],
  wolf: [
    { materialId: 'wolf_pelt', baseChance: 40 },
    { materialId: 'tough_hide', baseChance: 25 },
    { materialId: 'alpha_fang', baseChance: 12, minFloor: 4 },
  ],
  beetle: [
    { materialId: 'beetle_shell', baseChance: 45 },
    { materialId: 'armored_carapace', baseChance: 10, minFloor: 4 },
  ],
  crow: [
    { materialId: 'crow_feather', baseChance: 50 },
    { materialId: 'omen_eye', baseChance: 10, minFloor: 4 },
  ],
  shark: [
    { materialId: 'shark_tooth', baseChance: 40 },
    { materialId: 'tough_hide', baseChance: 20 },
    { materialId: 'blood_frenzy_gland', baseChance: 8, minFloor: 5 },
  ],
  frog: [
    { materialId: 'frog_mucus', baseChance: 45 },
    { materialId: 'toxic_gland', baseChance: 12, minFloor: 3 },
  ],
  jellyfish: [
    { materialId: 'jellyfish_bell', baseChance: 40 },
    { materialId: 'stinging_tendril', baseChance: 12, minFloor: 4 },
  ],
};

// Calculate drops from defeating a monster
export function calculateMonsterDrops(
  species: SpeciesType,
  floor: number,
  isRatScavenger: boolean = false // Rat's passive gives 50% extra loot chance
): CraftingMaterial[] {
  const dropTable = SPECIES_DROP_TABLES[species];
  if (!dropTable) return [];
  
  const drops: CraftingMaterial[] = [];
  const luckMultiplier = isRatScavenger ? 1.5 : 1.0;
  
  for (const entry of dropTable) {
    // Skip if floor requirement not met
    if (entry.minFloor && floor < entry.minFloor) continue;
    
    // Roll for drop
    const effectiveChance = entry.baseChance * luckMultiplier;
    if (Math.random() * 100 < effectiveChance) {
      const material = CRAFTING_MATERIALS.find(m => m.id === entry.materialId);
      if (material) {
        drops.push({ ...material });
      }
    }
  }
  
  // Floor bonus: higher floors have small chance for extra generic materials
  if (floor >= 3 && Math.random() < 0.15) {
    const genericMaterials = CRAFTING_MATERIALS.filter(m => 
      m.type === 'ore' || m.type === 'hide' || m.type === 'fabric'
    );
    const randomMat = genericMaterials[Math.floor(Math.random() * genericMaterials.length)];
    if (randomMat) drops.push({ ...randomMat });
  }
  
  return drops;
}

// Generate equipment for an enemy based on floor level
export function generateEnemyEquipment(floor: number): MonsterEquipment {
  const equipment = createEmptyEquipment();
  
  // Base chance for enemy to have equipment increases with floor
  // Floor 1: 10% chance per slot, Floor 5: 30%, Floor 10: 50%
  const baseEquipChance = 0.05 + (floor * 0.05);
  
  // Equipment slots in priority order (weapons more common than full armor)
  const slotPriorities: { slot: EquipmentSlot; weight: number }[] = [
    { slot: 'mainHand', weight: 1.5 },  // 50% more likely
    { slot: 'armor', weight: 1.2 },
    { slot: 'helmet', weight: 1.0 },
    { slot: 'accessory', weight: 1.0 },
    { slot: 'boots', weight: 0.8 },
    { slot: 'gloves', weight: 0.7 },
    { slot: 'offHand', weight: 0.6 },
    { slot: 'back', weight: 0.5 },
  ];
  
  // Limit total pieces based on floor (enemies don't have full gear early)
  const maxPieces = Math.min(8, 1 + Math.floor(floor / 2));
  let piecesEquipped = 0;
  
  for (const { slot, weight } of slotPriorities) {
    if (piecesEquipped >= maxPieces) break;
    
    const chance = baseEquipChance * weight;
    if (Math.random() < chance) {
      const item = generateEquipment(slot, floor);
      equipment[slot] = item;
      piecesEquipped++;
    }
  }
  
  return equipment;
}

// Get equipment drops from a defeated enemy (only unbound items)
export function getEnemyEquipmentDrops(equipment: MonsterEquipment): EquipmentItem[] {
  const drops: EquipmentItem[] = [];
  
  for (const item of Object.values(equipment)) {
    if (item && !item.bound) {
      drops.push({ ...item });
    }
  }
  
  return drops;
}
