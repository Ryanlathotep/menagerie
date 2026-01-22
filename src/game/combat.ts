// Combat system - damage calculations, hit chances, effectiveness

import { Monster, ElementType, ClassType, ELEMENT_ADVANTAGES, CLASS_ADVANTAGES_CORRECTED } from './types';
import { Move } from './moves';

export interface CombatResult {
  damage: number;
  hit: boolean;
  critical: boolean;
  effectiveness: 'super-effective' | 'effective' | 'normal' | 'weak';
  elementMultiplier: number;
  classMultiplier: number;
  message: string;
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

// Calculate actual hit chance after dodge
// Calculate actual hit chance after dodge (uses DODGE stat, not speed)
export function calculateHitChance(move: Move, attacker: Monster, defender: Monster): number {
  const baseAccuracy = move.accuracy;
  const defenderDodge = defender.stats.dodge; // Use dodge stat directly
  
  // Each point of dodge reduces hit chance by 0.5%, max 40% reduction
  const dodgeReduction = Math.min(40, Math.floor(defenderDodge * 0.5));
  const actualHitChance = Math.max(5, baseAccuracy - dodgeReduction); // Min 5% hit chance
  
  return actualHitChance;
}

// Calculate expected damage after defense
export function calculateExpectedDamage(move: Move, attacker: Monster, defender: Monster): number {
  if (move.power === 0) return 0;
  
  const attackStat = move.type === 'melee' ? attacker.stats.attack : attacker.stats.special;
  const defenseStat = defender.stats.defense;
  
  // Base damage calculation
  const baseDamage = Math.floor(move.power * (attackStat / 20));
  
  // Defense reduces damage (never to 0)
  const defenseReduction = Math.floor(defenseStat / 2);
  const damageAfterDefense = Math.max(1, baseDamage - defenseReduction);
  
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
export function executeCombat(move: Move, attacker: Monster, defender: Monster): CombatResult {
  const hitChance = calculateHitChance(move, attacker, defender);
  const hitRoll = Math.random() * 100;
  const hit = hitRoll <= hitChance;
  
  if (!hit) {
    return {
      damage: 0,
      hit: false,
      critical: false,
      effectiveness: 'normal',
      elementMultiplier: 1,
      classMultiplier: 1,
      message: `${move.name} missed!`,
    };
  }
  
  // Calculate damage
  const damage = calculateExpectedDamage(move, attacker, defender);
  const effectiveness = getEffectiveness(move, attacker, defender);
  const elementMult = move.element ? getElementMultiplier(move.element, defender.element) : 1.0;
  const classMult = move.classBonus ? getClassMultiplier(move.classBonus, defender.class) : 1.0;
  
  // Critical hit chance (10% base)
  const critRoll = Math.random() * 100;
  const critical = critRoll < 10;
  const finalDamage = critical ? Math.floor(damage * 1.5) : damage;
  
  // Build message
  let message = `${move.name} dealt ${finalDamage} damage!`;
  if (critical) message += ' Critical hit!';
  if (effectiveness.overall === 'super-effective') message += ' Super effective!';
  if (effectiveness.overall === 'effective') message += ' Effective!';
  if (effectiveness.overall === 'weak') message += ' Not very effective...';
  
  return {
    damage: finalDamage,
    hit: true,
    critical,
    effectiveness: effectiveness.overall,
    elementMultiplier: elementMult,
    classMultiplier: classMult,
    message,
  };
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
