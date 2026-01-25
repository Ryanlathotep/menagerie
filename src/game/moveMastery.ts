// Move Mastery & Evolution System
// Hybrid approach: Level-based scaling + Mastery via usage + Tier evolution

import { Move } from './moves';

// ============= TIER SYSTEM =============
// Tiers progress: Lesser → Minor → (Base) → Greater → Omega
// Each tier can have a Mass variant for AoE
export type MoveTier = 'lesser' | 'minor' | 'base' | 'greater' | 'omega';
export type MoveVariant = 'single' | 'mass';

export const TIER_ORDER: MoveTier[] = ['lesser', 'minor', 'base', 'greater', 'omega'];

export const TIER_PREFIXES: Record<MoveTier, string> = {
  lesser: 'Lesser',
  minor: 'Minor',
  base: '',  // No prefix for base tier
  greater: 'Greater',
  omega: 'Omega',
};

export const TIER_MULTIPLIERS: Record<MoveTier, { power: number; accuracy: number; staminaCost: number }> = {
  lesser: { power: 0.6, accuracy: 1.05, staminaCost: 0.7 },   // Weaker but more reliable, cheaper
  minor: { power: 0.8, accuracy: 1.02, staminaCost: 0.85 },   // Slightly weaker
  base: { power: 1.0, accuracy: 1.0, staminaCost: 1.0 },      // Standard
  greater: { power: 1.3, accuracy: 0.95, staminaCost: 1.25 }, // Stronger but less accurate, more expensive
  omega: { power: 1.6, accuracy: 0.90, staminaCost: 1.5 },    // Ultimate power
};

// Mass variants: slightly reduced power, hit multiple targets (future AoE support)
export const MASS_MULTIPLIERS = {
  power: 0.75,       // 75% power vs single target
  staminaCost: 1.4,  // 40% more stamina
  accuracy: 0.95,    // Slightly less accurate
};

// ============= MASTERY SYSTEM =============
// Moves gain mastery through usage, unlocking higher tiers
export interface MoveMastery {
  moveId?: string;        // Optional - key is typically the move ID in records
  uses: number;           // Total times this move has been used
  currentTier: MoveTier;  // Current unlocked tier
  hasAoE: boolean;        // Has unlocked Mass variant
}

// Mastery thresholds
export const MASTERY_THRESHOLDS: Record<MoveTier, number> = {
  lesser: 0,      // Always available (if monster level allows)
  minor: 10,      // 10 uses to unlock Minor
  base: 25,       // 25 uses to unlock Base
  greater: 50,    // 50 uses to unlock Greater
  omega: 100,     // 100 uses to unlock Omega
};

export const AOE_UNLOCK_THRESHOLD = 30; // Uses required to unlock Mass variant

// ============= LEVEL SCALING =============
// Moves get subtle auto-scaling based on monster level
// This is separate from tier multipliers
export function getLevelScaling(level: number): { powerBonus: number; accuracyBonus: number } {
  return {
    powerBonus: Math.floor(level * 1.5),  // +1.5 power per level
    accuracyBonus: Math.min(level * 0.5, 10),  // +0.5% accuracy per level, max +10%
  };
}

// ============= TIER UNLOCKING =============
// Monster level requirements to use higher tiers
export const TIER_LEVEL_REQUIREMENTS: Record<MoveTier, number> = {
  lesser: 1,    // Available from level 1
  minor: 3,     // Unlock at level 3
  base: 6,      // Unlock at level 6
  greater: 10,  // Unlock at level 10
  omega: 15,    // Unlock at level 15
};

// ============= MOVE EVOLUTION =============
export interface EvolvedMove extends Move {
  tier: MoveTier;
  variant: MoveVariant;
  baseMoveId: string;  // Original move this evolved from
}

// Get available tiers for a move based on mastery and monster level
export function getAvailableTiers(
  mastery: MoveMastery | undefined,
  monsterLevel: number
): MoveTier[] {
  const availableTiers: MoveTier[] = [];
  const uses = mastery?.uses || 0;

  for (const tier of TIER_ORDER) {
    // Check both mastery threshold and level requirement
    if (uses >= MASTERY_THRESHOLDS[tier] && monsterLevel >= TIER_LEVEL_REQUIREMENTS[tier]) {
      availableTiers.push(tier);
    }
  }

  // Always have at least lesser tier available
  if (availableTiers.length === 0) {
    availableTiers.push('lesser');
  }

  return availableTiers;
}

// Check if Mass variant is available
export function hasAoEUnlocked(mastery: MoveMastery | undefined): boolean {
  return (mastery?.uses || 0) >= AOE_UNLOCK_THRESHOLD;
}

// Create an evolved version of a move
export function createEvolvedMove(
  baseMove: Move,
  tier: MoveTier,
  variant: MoveVariant,
  monsterLevel: number
): EvolvedMove {
  const tierMult = TIER_MULTIPLIERS[tier];
  const levelScale = getLevelScaling(monsterLevel);
  
  // Calculate base stats with tier multipliers
  let power = Math.round(baseMove.power * tierMult.power);
  let accuracy = Math.round(baseMove.accuracy * tierMult.accuracy);
  let staminaCost = Math.round(baseMove.staminaCost * tierMult.staminaCost);
  
  // Apply Mass variant modifiers
  if (variant === 'mass') {
    power = Math.round(power * MASS_MULTIPLIERS.power);
    accuracy = Math.round(accuracy * MASS_MULTIPLIERS.accuracy);
    staminaCost = Math.round(staminaCost * MASS_MULTIPLIERS.staminaCost);
  }
  
  // Apply level scaling (additive, not multiplicative)
  power += levelScale.powerBonus;
  accuracy = Math.min(100, accuracy + Math.round(levelScale.accuracyBonus));
  
  // Generate evolved name
  const tierPrefix = TIER_PREFIXES[tier];
  const massPrefix = variant === 'mass' ? 'Mass ' : '';
  const name = `${tierPrefix}${tierPrefix ? ' ' : ''}${massPrefix}${baseMove.name}`.trim();
  
  // Generate evolved ID
  const tierId = tier === 'base' ? '' : `_${tier}`;
  const variantId = variant === 'mass' ? '_mass' : '';
  const id = `${baseMove.id}${tierId}${variantId}`;
  
  // Update description
  const tierDesc = tier !== 'base' ? ` [${TIER_PREFIXES[tier] || 'Standard'} tier]` : '';
  const massDesc = variant === 'mass' ? ' Hits all enemies.' : '';
  const description = `${baseMove.description}${tierDesc}${massDesc}`;
  
  return {
    ...baseMove,
    id,
    name,
    description,
    power,
    accuracy,
    staminaCost,
    tier,
    variant,
    baseMoveId: baseMove.id,
  };
}

// Get all available versions of a move
export function getAvailableMoveVersions(
  baseMove: Move,
  mastery: MoveMastery | undefined,
  monsterLevel: number
): EvolvedMove[] {
  const versions: EvolvedMove[] = [];
  const availableTiers = getAvailableTiers(mastery, monsterLevel);
  const canUseAoE = hasAoEUnlocked(mastery);
  
  // Only generate evolved versions for moves with power (attack moves)
  // Status moves don't need tier evolution
  if (baseMove.power === 0) {
    // For status moves, just return the base version
    return [{
      ...baseMove,
      tier: 'base',
      variant: 'single',
      baseMoveId: baseMove.id,
    }];
  }
  
  for (const tier of availableTiers) {
    // Single target version
    versions.push(createEvolvedMove(baseMove, tier, 'single', monsterLevel));
    
    // Mass version (if unlocked and move is an attack)
    if (canUseAoE) {
      versions.push(createEvolvedMove(baseMove, tier, 'mass', monsterLevel));
    }
  }
  
  return versions;
}

// Get the highest available tier for a move
export function getHighestTier(mastery: MoveMastery | undefined, monsterLevel: number): MoveTier {
  const available = getAvailableTiers(mastery, monsterLevel);
  return available[available.length - 1];
}

// Get the best version of a move (highest tier, single target by default)
export function getBestMoveVersion(
  baseMove: Move,
  mastery: MoveMastery | undefined,
  monsterLevel: number,
  preferMass: boolean = false
): EvolvedMove {
  const highestTier = getHighestTier(mastery, monsterLevel);
  const variant: MoveVariant = preferMass && hasAoEUnlocked(mastery) ? 'mass' : 'single';
  return createEvolvedMove(baseMove, highestTier, variant, monsterLevel);
}

// ============= MASTERY TRACKING =============
// Track move usage for a monster
export interface MonsterMasteryData {
  monsterId: string;
  moveMastery: Record<string, MoveMastery>;
}

// Update mastery when a move is used
export function recordMoveUse(
  masteryData: MonsterMasteryData,
  moveId: string
): MonsterMasteryData {
  const currentMastery = masteryData.moveMastery[moveId] || {
    moveId,
    uses: 0,
    currentTier: 'lesser' as MoveTier,
    hasAoE: false,
  };
  
  const newUses = currentMastery.uses + 1;
  
  // Determine new tier based on uses
  let newTier: MoveTier = 'lesser';
  for (const tier of TIER_ORDER) {
    if (newUses >= MASTERY_THRESHOLDS[tier]) {
      newTier = tier;
    }
  }
  
  const hasAoE = newUses >= AOE_UNLOCK_THRESHOLD;
  
  return {
    ...masteryData,
    moveMastery: {
      ...masteryData.moveMastery,
      [moveId]: {
        moveId,
        uses: newUses,
        currentTier: newTier,
        hasAoE,
      },
    },
  };
}

// Get mastery progress info for UI display
export function getMasteryProgress(mastery: MoveMastery | undefined): {
  tier: MoveTier;
  uses: number;
  nextTier: MoveTier | null;
  usesToNextTier: number;
  percentToNextTier: number;
  hasAoE: boolean;
  usesToAoE: number;
} {
  const uses = mastery?.uses || 0;
  const currentTier = mastery?.currentTier || 'lesser';
  const hasAoE = mastery?.hasAoE || false;
  
  // Find next tier
  const currentIndex = TIER_ORDER.indexOf(currentTier);
  const nextTier = currentIndex < TIER_ORDER.length - 1 ? TIER_ORDER[currentIndex + 1] : null;
  
  // Calculate progress to next tier
  const currentThreshold = MASTERY_THRESHOLDS[currentTier];
  const nextThreshold = nextTier ? MASTERY_THRESHOLDS[nextTier] : uses;
  const usesToNextTier = nextTier ? Math.max(0, nextThreshold - uses) : 0;
  const progressRange = nextThreshold - currentThreshold;
  const progressMade = uses - currentThreshold;
  const percentToNextTier = nextTier ? Math.min(100, Math.round((progressMade / progressRange) * 100)) : 100;
  
  // AoE progress
  const usesToAoE = Math.max(0, AOE_UNLOCK_THRESHOLD - uses);
  
  return {
    tier: currentTier,
    uses,
    nextTier,
    usesToNextTier,
    percentToNextTier,
    hasAoE,
    usesToAoE,
  };
}

// ============= UI HELPERS =============
export const TIER_COLORS: Record<MoveTier, string> = {
  lesser: 'text-muted-foreground',
  minor: 'text-foreground',
  base: 'text-primary',
  greater: 'text-amber-500',
  omega: 'text-purple-500',
};

export const TIER_BG_COLORS: Record<MoveTier, string> = {
  lesser: 'bg-muted/50',
  minor: 'bg-muted',
  base: 'bg-primary/20',
  greater: 'bg-amber-500/20',
  omega: 'bg-purple-500/20',
};

export function getTierDisplayName(tier: MoveTier): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}
