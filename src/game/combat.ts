// Combat system - damage calculations, hit chances, effectiveness

import { Monster, ElementType, ClassType, ELEMENT_ADVANTAGES, CLASS_ADVANTAGES_CORRECTED, SpeciesType } from './types';
import { Move } from './moves';

export interface CombatResult {
  damage: number;
  hit: boolean;
  critical: boolean;
  effectiveness: 'super-effective' | 'effective' | 'normal' | 'weak';
  elementMultiplier: number;
  classMultiplier: number;
  message: string;
  passiveTriggered?: string; // Message about passive ability triggering
  reflectDamage?: number; // Damage reflected back to attacker (Jellyfish)
  speedDebuff?: number; // Speed debuff to apply to target (Spider)
  survivedFatal?: boolean; // Skeleton survived a fatal hit
  elementHit?: ElementType; // Element of the move that hit (for Chimera resistance)
  stolenItem?: { id: string; name: string }; // Item stolen by Crow
}

// Track temporary resistances (for Chimera)
export interface TemporaryResistance {
  element: ElementType;
  turnsRemaining: number;
}

// Check if a species has a specific passive
export function hasPassive(species: SpeciesType, passive: string): boolean {
  const passiveMap: Record<string, SpeciesType[]> = {
    // Already implemented
    'amorphous': ['slime'],        // 20% less physical damage
    'cunning': ['goblin'],          // +25% crit chance
    'ethereal': ['ghost'],          // 30% phase through attacks
    'draconic_pride': ['dragon'],   // Damage scales with missing HP
    'blood_frenzy': ['shark'],      // +30% damage vs wounded
    'carapace': ['beetle'],         // First hit each turn reduced
    'stinging': ['jellyfish'],      // Reflect damage when hit
    'amphibious': ['frog'],         // +20% water damage
    // Newly implemented
    'undead': ['skeleton'],         // 10% chance to survive fatal hit
    'venomous': ['snake'],          // +15% damage vs full HP enemies
    'web_spinner': ['spider'],      // -20% enemy speed after hit
    'spore_cloud': ['mushroom'],    // Regenerate 5% HP per turn
    'echolocation': ['bat'],        // +15% accuracy
    'pack_hunter': ['wolf'],        // +10% damage (flat, since no party)
    'luminous': ['wisp'],           // +10% ally healing effectiveness
    'mischievous': ['imp'],         // 15% chance to steal stat boost on hit
    'stone_body': ['golem'],        // Cannot take more than 25% max HP damage per hit
    'scavenger': ['rat'],           // Extra loot (handled in Index.tsx)
    'keen_eye': ['crow'],           // Can steal enemy items
    'hybrid_nature': ['chimera'],   // Gains resistance after being hit by element
  };
  return passiveMap[passive]?.includes(species) || false;
}

// Get element effectiveness multiplier
export function getElementMultiplier(attackerElement: ElementType, defenderElement: ElementType): number {
  if (ELEMENT_ADVANTAGES[attackerElement]?.includes(defenderElement)) {
    return 1.5; // Super effective
  }
  if (ELEMENT_ADVANTAGES[defenderElement]?.includes(attackerElement)) {
    return 0.67; // Not very effective
  }
  return 1.0;
}

// Get class effectiveness multiplier
export function getClassMultiplier(attackerClass: ClassType, defenderClass: ClassType): number {
  if (CLASS_ADVANTAGES_CORRECTED[attackerClass]?.includes(defenderClass)) {
    return 1.3;
  }
  if (CLASS_ADVANTAGES_CORRECTED[defenderClass]?.includes(attackerClass)) {
    return 0.77;
  }
  return 1.0;
}

// Calculate actual hit chance after dodge (uses DODGE stat, not speed)
// Ghost's Ethereal passive adds 30% extra dodge chance
// Bat's Echolocation adds +15% accuracy
export function calculateHitChance(move: Move, attacker: Monster, defender: Monster): number {
  let baseAccuracy = move.accuracy;
  const defenderDodge = defender.stats.dodge; // Use dodge stat directly
  
  // Bat's Echolocation: +15% accuracy
  if (hasPassive(attacker.species, 'echolocation')) {
    baseAccuracy = Math.min(100, baseAccuracy + 15);
  }
  
  // Each point of dodge reduces hit chance by 0.5%, max 40% reduction
  let dodgeReduction = Math.min(40, Math.floor(defenderDodge * 0.5));
  
  // Ghost's Ethereal: 30% chance to phase through attacks (adds to dodge)
  if (hasPassive(defender.species, 'ethereal')) {
    dodgeReduction += 30;
  }
  
  const actualHitChance = Math.max(5, baseAccuracy - dodgeReduction); // Min 5% hit chance
  
  return actualHitChance;
}

// Calculate expected damage after defense
// Includes passive ability modifiers
export function calculateExpectedDamage(
  move: Move, 
  attacker: Monster, 
  defender: Monster,
  isFirstHitThisTurn: boolean = true,
  temporaryResistances: TemporaryResistance[] = []
): number {
  if (move.power === 0) return 0;
  
  const attackStat = move.type === 'melee' ? attacker.stats.attack : attacker.stats.special;
  const defenseStat = defender.stats.defense;
  
  // Base damage calculation
  let baseDamage = Math.floor(move.power * (attackStat / 20));
  
  // === ATTACKER PASSIVES ===
  
  // Dragon's Draconic Pride: Damage increases as HP decreases (up to +50% at 1 HP)
  if (hasPassive(attacker.species, 'draconic_pride')) {
    const hpPercent = attacker.stats.currentHp / attacker.stats.maxHp;
    const prideBonus = 1 + (0.5 * (1 - hpPercent)); // 1.0 at full HP, 1.5 at 0 HP
    baseDamage = Math.floor(baseDamage * prideBonus);
  }
  
  // Shark's Blood Frenzy: +30% damage against wounded enemies (below 50% HP)
  if (hasPassive(attacker.species, 'blood_frenzy')) {
    const targetHpPercent = defender.stats.currentHp / defender.stats.maxHp;
    if (targetHpPercent < 0.5) {
      baseDamage = Math.floor(baseDamage * 1.3);
    }
  }
  
  // Frog's Amphibious: +20% water damage
  if (hasPassive(attacker.species, 'amphibious') && move.element === 'water') {
    baseDamage = Math.floor(baseDamage * 1.2);
  }
  
  // Snake's Venomous: +15% damage vs full HP enemies
  if (hasPassive(attacker.species, 'venomous')) {
    if (defender.stats.currentHp >= defender.stats.maxHp) {
      baseDamage = Math.floor(baseDamage * 1.15);
    }
  }
  
  // Wolf's Pack Hunter: +10% damage (flat bonus since no party system)
  if (hasPassive(attacker.species, 'pack_hunter')) {
    baseDamage = Math.floor(baseDamage * 1.1);
  }
  
  // Defense reduces damage (never to 0)
  const defenseReduction = Math.floor(defenseStat / 2);
  let damageAfterDefense = Math.max(1, baseDamage - defenseReduction);
  
  // === DEFENDER PASSIVES ===
  
  // Slime's Amorphous: Takes 20% less physical (melee) damage
  if (hasPassive(defender.species, 'amorphous') && move.type === 'melee') {
    damageAfterDefense = Math.floor(damageAfterDefense * 0.8);
  }
  
  // Beetle's Carapace: First hit each turn deals 30% reduced damage
  if (hasPassive(defender.species, 'carapace') && isFirstHitThisTurn) {
    damageAfterDefense = Math.floor(damageAfterDefense * 0.7);
  }
  
  // Golem's Stone Body: Cannot take more than 25% max HP per hit
  if (hasPassive(defender.species, 'stone_body')) {
    const maxDamage = Math.floor(defender.stats.maxHp * 0.25);
    damageAfterDefense = Math.min(damageAfterDefense, maxDamage);
  }
  
  // Chimera's Hybrid Nature: Check for temporary element resistance
  if (hasPassive(defender.species, 'hybrid_nature') && move.element) {
    const hasResistance = temporaryResistances.some(r => r.element === move.element && r.turnsRemaining > 0);
    if (hasResistance) {
      damageAfterDefense = Math.floor(damageAfterDefense * 0.5); // 50% resistance
    }
  }
  
  // Apply element and class multipliers
  const elementMult = move.element ? getElementMultiplier(move.element, defender.element) : 1.0;
  const classMult = move.classBonus ? getClassMultiplier(move.classBonus, defender.class) : 1.0;
  
  return Math.floor(damageAfterDefense * elementMult * classMult);
}

// Get effectiveness rating for display
// Effective = ONE bonus (element OR class), no weakness from the other
// Super Effective = BOTH bonuses (element AND class)
// Normal = no bonuses OR one bonus + one weakness (they cancel out)
// Weak = at least one weakness, no bonuses to compensate
export function getEffectiveness(move: Move, attacker: Monster, defender: Monster): {
  element: 'super' | 'normal' | 'weak';
  class: 'super' | 'normal' | 'weak';
  overall: 'super-effective' | 'effective' | 'normal' | 'weak';
} {
  const elementMult = move.element ? getElementMultiplier(move.element, defender.element) : 1.0;
  const classMult = move.classBonus ? getClassMultiplier(move.classBonus, defender.class) : 1.0;

  const getLevel = (mult: number): 'super' | 'normal' | 'weak' => {
    if (mult > 1.1) return 'super';
    if (mult < 0.9) return 'weak';
    return 'normal';
  };

  const elementLevel = getLevel(elementMult);
  const classLevel = getLevel(classMult);

  // Determine overall effectiveness based on combination
  let overall: 'super-effective' | 'effective' | 'normal' | 'weak';
  
  const hasElementBonus = elementLevel === 'super';
  const hasClassBonus = classLevel === 'super';
  const hasElementWeakness = elementLevel === 'weak';
  const hasClassWeakness = classLevel === 'weak';

  if (hasElementBonus && hasClassBonus) {
    // Both bonuses = Super Effective
    overall = 'super-effective';
  } else if ((hasElementBonus && hasClassWeakness) || (hasClassBonus && hasElementWeakness)) {
    // One bonus + one weakness = Normal (they cancel out)
    overall = 'normal';
  } else if (hasElementBonus || hasClassBonus) {
    // One bonus, no weakness = Effective
    overall = 'effective';
  } else if (hasElementWeakness || hasClassWeakness) {
    // At least one weakness, no bonus = Weak
    overall = 'weak';
  } else {
    // No bonuses, no weaknesses = Normal
    overall = 'normal';
  }

  return {
    element: elementLevel,
    class: classLevel,
    overall,
  };
}

// Full combat calculation
// isFirstHitThisTurn is used for Beetle's Carapace passive
export function executeCombat(
  move: Move, 
  attacker: Monster, 
  defender: Monster,
  isFirstHitThisTurn: boolean = true
): CombatResult {
  const hitChance = calculateHitChance(move, attacker, defender);
  const hitRoll = Math.random() * 100;
  const hit = hitRoll <= hitChance;
  
  // Track passive messages
  let passiveTriggered: string | undefined;
  
  // Ghost's Ethereal: Check if phased through
  if (!hit && hasPassive(defender.species, 'ethereal') && hitRoll > hitChance - 30) {
    passiveTriggered = `${defender.name} phased through the attack! 👻`;
  }
  
  if (!hit) {
    return {
      damage: 0,
      hit: false,
      critical: false,
      effectiveness: 'normal',
      elementMultiplier: 1,
      classMultiplier: 1,
      message: `${move.name} missed!`,
      passiveTriggered,
    };
  }
  
  // Calculate damage with passive modifiers
  const damage = calculateExpectedDamage(move, attacker, defender, isFirstHitThisTurn);
  const effectiveness = getEffectiveness(move, attacker, defender);
  const elementMult = move.element ? getElementMultiplier(move.element, defender.element) : 1.0;
  const classMult = move.classBonus ? getClassMultiplier(move.classBonus, defender.class) : 1.0;
  
  // Critical hit chance (10% base, +25% for Goblin's Cunning)
  let critChance = 10;
  if (hasPassive(attacker.species, 'cunning')) {
    critChance += 25;
  }
  
  const critRoll = Math.random() * 100;
  const critical = critRoll < critChance;
  let finalDamage = critical ? Math.floor(damage * 1.5) : damage;
  
  // Build message with passive info
  let message = `${move.name} dealt ${finalDamage} damage!`;
  if (critical) {
    message += ' Critical hit!';
    if (hasPassive(attacker.species, 'cunning')) {
      passiveTriggered = `Cunning strike! 🗡️`;
    }
  }
  if (effectiveness.overall === 'super-effective') message += ' Super effective!';
  if (effectiveness.overall === 'effective') message += ' Effective!';
  if (effectiveness.overall === 'weak') message += ' Not very effective...';
  
  // Add passive messages for damage modifiers
  if (hasPassive(attacker.species, 'draconic_pride') && attacker.stats.currentHp < attacker.stats.maxHp * 0.5) {
    passiveTriggered = `Draconic Pride surges! 🐉`;
  }
  if (hasPassive(attacker.species, 'blood_frenzy') && defender.stats.currentHp < defender.stats.maxHp * 0.5) {
    passiveTriggered = `Blood Frenzy activated! 🦈`;
  }
  if (hasPassive(attacker.species, 'venomous') && defender.stats.currentHp >= defender.stats.maxHp) {
    passiveTriggered = `Venomous strike! 🐍`;
  }
  if (hasPassive(attacker.species, 'pack_hunter')) {
    passiveTriggered = `Pack Hunter bonus! 🐺`;
  }
  if (hasPassive(attacker.species, 'echolocation')) {
    passiveTriggered = `Echolocation precision! 🦇`;
  }
  if (hasPassive(defender.species, 'amorphous') && move.type === 'melee') {
    passiveTriggered = `Amorphous body absorbs impact! 🟢`;
  }
  if (hasPassive(defender.species, 'carapace') && isFirstHitThisTurn) {
    passiveTriggered = `Carapace deflects the blow! 🪲`;
  }
  if (hasPassive(defender.species, 'stone_body')) {
    passiveTriggered = `Stone Body limits damage! 🗿`;
  }
  
  // Jellyfish's Stinging Tendrils: Reflect 20% damage back to attacker
  let reflectDamage: number | undefined;
  if (hasPassive(defender.species, 'stinging') && finalDamage > 0) {
    reflectDamage = Math.max(1, Math.floor(finalDamage * 0.2));
    passiveTriggered = `Stinging tendrils lash back for ${reflectDamage} damage! 🎐`;
  }
  
  // Spider's Web Spinner: Reduce enemy speed by 20% after successful hit
  let speedDebuff: number | undefined;
  if (hasPassive(attacker.species, 'web_spinner') && finalDamage > 0) {
    speedDebuff = 20; // 20% speed reduction
    passiveTriggered = `Web slows the target! 🕷️`;
  }
  
  // Track element for Chimera's adaptive resistance
  const elementHit = move.element;
  
  return {
    damage: finalDamage,
    hit: true,
    critical,
    effectiveness: effectiveness.overall,
    elementMultiplier: elementMult,
    classMultiplier: classMult,
    message,
    passiveTriggered,
    reflectDamage,
    speedDebuff,
    elementHit,
  };
}

// Check if Skeleton survives a fatal hit (10% chance)
export function checkSkeletonSurvival(defender: Monster, damage: number): boolean {
  if (!hasPassive(defender.species, 'undead')) return false;
  if (defender.stats.currentHp - damage > 0) return false; // Not fatal
  return Math.random() < 0.1; // 10% survival chance
}

// Apply Mushroom's regeneration at start of turn (5% max HP)
export function applyMushroomRegen(monster: Monster): number {
  if (!hasPassive(monster.species, 'spore_cloud')) return 0;
  const regenAmount = Math.max(1, Math.floor(monster.stats.maxHp * 0.05));
  return regenAmount;
}

// Wisp's healing boost (10% more effective)
export function applyWispHealingBonus(healer: Monster, healAmount: number): number {
  if (!hasPassive(healer.species, 'luminous')) return healAmount;
  return Math.floor(healAmount * 1.1);
}

// Imp's chance to steal stat boost (15% on successful hit)
export function checkImpSteal(attacker: Monster): { stolen: boolean; stat: string } | null {
  if (!hasPassive(attacker.species, 'mischievous')) return null;
  if (Math.random() >= 0.15) return null;
  const stats = ['attack', 'defense', 'speed', 'special'];
  return { stolen: true, stat: stats[Math.floor(Math.random() * stats.length)] };
}

// Calculate XP awarded for defeating an enemy
export function calculateXpReward(enemyLevel: number, playerLevel: number): number {
  const baseXp = 20 + enemyLevel * 10;
  const levelDiff = enemyLevel - playerLevel;
  const multiplier = Math.max(0.5, Math.min(2, 1 + levelDiff * 0.1));
  return Math.floor(baseXp * multiplier);
}

// Calculate XP needed for next level
export function xpToNextLevel(level: number): number {
  return 50 + level * 50; // 100, 150, 200, etc.
}

// Check if monster levels up and return new stats if so
export function checkLevelUp(monster: Monster, currentXp: number): { leveled: boolean; newLevel: number; xpRemaining: number } {
  const xpNeeded = xpToNextLevel(monster.level);
  
  if (currentXp >= xpNeeded) {
    return {
      leveled: true,
      newLevel: monster.level + 1,
      xpRemaining: currentXp - xpNeeded,
    };
  }
  
  return {
    leveled: false,
    newLevel: monster.level,
    xpRemaining: currentXp,
  };
}

// Calculate turn order based on speed and move priority
export function calculateTurnOrder(
  playerMonster: Monster, 
  playerMove: Move, 
  enemyMonster: Monster, 
  enemyMove: Move
): 'player' | 'enemy' {
  const playerPriority = playerMonster.stats.speed + (playerMove.speedMod * 10);
  const enemyPriority = enemyMonster.stats.speed + (enemyMove.speedMod * 10);
  
  if (playerPriority === enemyPriority) {
    return Math.random() > 0.5 ? 'player' : 'enemy';
  }
  
  return playerPriority > enemyPriority ? 'player' : 'enemy';
}
