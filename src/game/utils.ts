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

// Generate a unique ID
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// Calculate combined stats for a monster
export function calculateStats(species: SpeciesType, classType: ClassType, level: number): MonsterStats {
  const speciesStats = SPECIES_DATA[species].baseStats;
  const classStats = CLASS_STATS[classType];
  
  const levelMultiplier = 1 + (level - 1) * 0.1;
  
  const baseHp = Math.floor((speciesStats.hp + classStats.hp) * levelMultiplier);
  
  return {
    maxHp: baseHp,
    currentHp: baseHp,
    attack: Math.floor((speciesStats.attack + classStats.attack) * levelMultiplier),
    defense: Math.floor((speciesStats.defense + classStats.defense) * levelMultiplier),
    speed: Math.floor((speciesStats.speed + classStats.speed) * levelMultiplier),
    special: Math.floor((speciesStats.special + classStats.special) * levelMultiplier),
  };
}

// Create a new monster
export function createMonster(
  species: SpeciesType, 
  classType: ClassType, 
  element: ElementType, 
  level: number = 1
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
  };
}

// Check elemental advantage (returns damage multiplier)
export function getElementMultiplier(attacker: ElementType, defender: ElementType): number {
  if (ELEMENT_ADVANTAGES[attacker].includes(defender)) {
    return 1.5; // Super effective
  }
  if (ELEMENT_ADVANTAGES[defender].includes(attacker)) {
    return 0.67; // Not very effective
  }
  return 1.0; // Neutral
}

// Check class advantage
export function getClassMultiplier(attacker: ClassType, defender: ClassType): number {
  if (CLASS_ADVANTAGES_CORRECTED[attacker].includes(defender)) {
    return 1.3;
  }
  if (CLASS_ADVANTAGES_CORRECTED[defender].includes(attacker)) {
    return 0.77;
  }
  return 1.0;
}

// Calculate damage
export function calculateDamage(
  attacker: Monster,
  defender: Monster,
  basePower: number,
  isSpecial: boolean = false
): number {
  const attackStat = isSpecial ? attacker.stats.special : attacker.stats.attack;
  const defenseStat = isSpecial ? defender.stats.special : defender.stats.defense;
  
  const elementMult = getElementMultiplier(attacker.element, defender.element);
  const classMult = getClassMultiplier(attacker.class, defender.class);
  
  // Basic damage formula
  const baseDamage = Math.floor(
    ((2 * attacker.level / 5 + 2) * basePower * attackStat / defenseStat) / 50 + 2
  );
  
  // Apply multipliers
  const finalDamage = Math.floor(baseDamage * elementMult * classMult);
  
  // Minimum 1 damage
  return Math.max(1, finalDamage);
}

// Generate a random monster for dungeon
export function generateRandomMonster(
  allowedSpecies: SpeciesType[],
  level: number
): Monster {
  const species = allowedSpecies[Math.floor(Math.random() * allowedSpecies.length)];
  const classes: ClassType[] = ['kinetic', 'energy', 'biological', 'chemical', 'political'];
  const elements: ElementType[] = ['fire', 'water', 'earth', 'air', 'void'];
  
  const classType = classes[Math.floor(Math.random() * classes.length)];
  const element = elements[Math.floor(Math.random() * elements.length)];
  
  return createMonster(species, classType, element, level);
}

// Get monster display name with class
export function getMonsterFullName(monster: Monster): string {
  const speciesData = SPECIES_DATA[monster.species];
  const classNames: Record<ClassType, string> = {
    kinetic: 'Kinetic',
    energy: 'Energy',
    biological: 'Biological',
    chemical: 'Chemical',
    political: 'Political',
  };
  
  return `${monster.element.charAt(0).toUpperCase() + monster.element.slice(1)} ${classNames[monster.class]} ${speciesData.name}`;
}
