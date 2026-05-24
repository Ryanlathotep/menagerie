// Game utility functions

import { 
  Monster, 
  MonsterStats, 
  SpeciesType, 
  ClassType, 
  ElementType,
  SPECIES_DATA,
  CLASS_STATS,
  ELEMENT_ADVANTAGES,
  CLASS_ADVANTAGES_CORRECTED
} from './types';
import { MonsterEquipment } from './equipment';
import { generateEnemyEquipment } from './monsterDrops';

// Generate a unique ID
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// Calculate combined stats for a monster at a given level
export function calculateStats(species: SpeciesType, classType: ClassType, level: number): MonsterStats {
  const speciesStats = SPECIES_DATA[species].baseStats;
  const classStats = CLASS_STATS[classType];
  
  // Each level adds a percentage of base stats (10% per level after 1)
  const levelMultiplier = 1 + (level - 1) * 0.1;
  
  const baseHp = Math.floor((speciesStats.hp + classStats.hp) * levelMultiplier);
  const baseStamina = Math.floor((speciesStats.special + 20) * levelMultiplier);
  
  return {
    maxHp: baseHp,
    currentHp: baseHp,
    attack: Math.floor((speciesStats.attack + classStats.attack) * levelMultiplier),
    defense: Math.floor((speciesStats.defense + classStats.defense) * levelMultiplier),
    speed: Math.floor((speciesStats.speed + classStats.speed) * levelMultiplier),
    dodge: Math.floor((speciesStats.speed * 0.5 + classStats.dodge) * levelMultiplier),
    special: Math.floor((speciesStats.special + classStats.special) * levelMultiplier),
    stamina: baseStamina,
    currentStamina: baseStamina,
  };
}



// Create a new monster.
//
// `experience` and `moveMastery` let callers re-hydrate persisted progression
// from `UnlockedMonster` records when starting a new run, so XP banked
// toward the next level and move-mastery use counts survive run transitions.
export function createMonster(
  species: SpeciesType, 
  classType: ClassType, 
  element: ElementType, 
  level: number = 1,
  equipment?: MonsterEquipment,
  experience?: number,
  moveMastery?: Monster['moveMastery'],
): Monster {
  const speciesData = SPECIES_DATA[species];
  
  return {
    id: generateId(),
    species,
    class: classType,
    element,
    level,
    stats: calculateStats(species, classType, level),
    name: `${element.charAt(0).toUpperCase() + element.slice(1)} ${speciesData.name}`,
    equipment,
    experience: experience ?? 0,
    moveMastery,
  };
}

// Check elemental advantage (returns damage multiplier).
// Used internally by generateRandomMonster's siblings; the canonical combat
// damage path lives in src/game/combat.ts.
function getElementMultiplier(attacker: ElementType, defender: ElementType): number {
  if (ELEMENT_ADVANTAGES[attacker].includes(defender)) return 1.5;
  if (ELEMENT_ADVANTAGES[defender].includes(attacker)) return 0.67;
  return 1.0;
}

function getClassMultiplier(attacker: ClassType, defender: ClassType): number {
  if (CLASS_ADVANTAGES_CORRECTED[attacker].includes(defender)) return 1.3;
  if (CLASS_ADVANTAGES_CORRECTED[defender].includes(attacker)) return 0.77;
  return 1.0;
}
// Mark as intentionally retained for potential future callers / debugging.
void getElementMultiplier;
void getClassMultiplier;


// Items that enemies can carry - IDs match ITEMS database for recipe unlocking
const ENEMY_ITEM_TABLE = [
  { id: 'small_potion', name: 'Small Potion', type: 'potion' as const, value: 30, effect: 'heal_hp' },
  { id: 'stamina_tonic', name: 'Stamina Tonic', type: 'potion' as const, value: 20, effect: 'heal_stamina' },
  { id: 'attack_boost', name: 'Battle Powder', type: 'potion' as const, value: 25, effect: 'boost_attack' },
  { id: 'antidote', name: 'Antidote', type: 'potion' as const, value: 10, effect: 'cure_poison' },
  { id: 'gold_coin', name: 'Gold Coins', type: 'gold' as const, value: 15 },
  { id: 'gold_pile', name: 'Gold Pile', type: 'gold' as const, value: 30 },
];

// Generate a random monster for dungeon (with equipment based on floor).
// Optional `theme` constrains element/class/species so themed towers feel themed.
export function generateRandomMonster(
  allowedSpecies: SpeciesType[],
  level: number,
  theme?: { kind: 'all' | 'element' | 'class' | 'species'; value?: ElementType | ClassType | SpeciesType }
): Monster {
  // Apply species theme override
  let speciesPool = allowedSpecies;
  if (theme?.kind === 'species' && theme.value) {
    speciesPool = [theme.value as SpeciesType];
  }
  if (speciesPool.length === 0) speciesPool = allowedSpecies;
  const species = speciesPool[Math.floor(Math.random() * speciesPool.length)];

  // Class selection: themed towers force the class; otherwise weighted random with rare normal.
  const classes: ClassType[] = ['normal', 'kinetic', 'energy', 'biological', 'chemical', 'political'];
  const elements: ElementType[] = ['normal', 'fire', 'water', 'earth', 'air', 'void'];

  let classType: ClassType;
  if (theme?.kind === 'class' && theme.value) {
    classType = theme.value as ClassType;
  } else {
    classType = (Math.random() < 0.1 ? 'normal' : classes[1 + Math.floor(Math.random() * 5)]) as ClassType;
  }

  let element: ElementType;
  if (theme?.kind === 'element' && theme.value) {
    element = theme.value as ElementType;
  } else {
    element = (Math.random() < 0.1 ? 'normal' : elements[1 + Math.floor(Math.random() * 5)]) as ElementType;
  }

  // Generate equipment for enemy (based on level/floor)
  const equipment = generateEnemyEquipment(level);

  const monster = createMonster(species, classType, element, level, equipment);

  // 30% chance enemy carries an item (can be stolen by Crow)
  if (Math.random() < 0.3) {
    const item = ENEMY_ITEM_TABLE[Math.floor(Math.random() * ENEMY_ITEM_TABLE.length)];
    monster.carriedItem = { ...item };
  }

  return monster;
}

