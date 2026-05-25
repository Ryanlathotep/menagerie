// Status Effects and Buff/Debuff System

import { Monster } from './types';

// ============= STATUS EFFECT TYPES =============
export type StatusEffectType = 'poison' | 'burn' | 'freeze' | 'paralyze' | 'confuse' | 'grappled';

export interface StatusEffect {
  type: StatusEffectType;
  turnsRemaining: number;
  damagePerTurn?: number; // For DoT effects
  source: string; // Move name that caused it
  // ── Grapple-specific modifiers (percent, 0-100). Stored on the status so
  // the visual badge can show them and combat/escape math can read them.
  grappleEscapeMod?: number;     // % reduction to flee success chance
  grappleRangedAccMod?: number;  // % reduction to ranged accuracy
  grappleMovementMod?: number;   // % reduction to movement-skill reach
}

// Default grapple modifiers when a move/entry doesn't override them.
export const DEFAULT_GRAPPLE_ESCAPE_MOD = 25;
export const DEFAULT_GRAPPLE_RANGED_ACC_MOD = 25;
export const DEFAULT_GRAPPLE_MOVEMENT_MOD = 25;
export const DEFAULT_GRAPPLE_DURATION = 3;

// Status effect configurations
export const STATUS_EFFECT_CONFIG: Record<StatusEffectType, {
  icon: string;
  color: string;
  description: string;
  baseDuration: number;
  damagePercent?: number; // % of max HP per turn
}> = {
  poison: {
    icon: '🟣',
    color: 'text-purple-400',
    description: 'Takes damage each turn',
    baseDuration: 3,
    damagePercent: 6, // 6% max HP per turn
  },
  burn: {
    icon: '🔥',
    color: 'text-orange-400',
    description: 'Takes fire damage each turn, -10% attack',
    baseDuration: 3,
    damagePercent: 8, // 8% max HP per turn
  },
  freeze: {
    icon: '❄️',
    color: 'text-cyan-400',
    description: '25% chance to skip turn, -20% speed',
    baseDuration: 2,
  },
  paralyze: {
    icon: '⚡',
    color: 'text-yellow-400',
    description: '30% chance to skip turn',
    baseDuration: 3,
  },
  confuse: {
    icon: '💫',
    color: 'text-pink-400',
    description: '25% chance to hurt self',
    baseDuration: 3,
  },
};

// ============= BUFF/DEBUFF TYPES =============
export type BuffType = 'attack' | 'defense' | 'speed' | 'special' | 'accuracy' | 'dodge' | 'all_stats';
export type BuffDirection = 'buff' | 'debuff';

export interface StatModifier {
  stat: BuffType;
  direction: BuffDirection;
  percentage: number; // e.g., 20 = +/- 20%
  turnsRemaining: number;
  source: string;
  stacks?: number; // Some buffs can stack
}

// Standard buff/debuff values
export const BUFF_CONFIG: Record<BuffType, { icon: string; buffColor: string; debuffColor: string }> = {
  attack: { icon: '⚔️', buffColor: 'text-red-400', debuffColor: 'text-red-300/50' },
  defense: { icon: '🛡️', buffColor: 'text-blue-400', debuffColor: 'text-blue-300/50' },
  speed: { icon: '💨', buffColor: 'text-green-400', debuffColor: 'text-green-300/50' },
  special: { icon: '✨', buffColor: 'text-purple-400', debuffColor: 'text-purple-300/50' },
  accuracy: { icon: '🎯', buffColor: 'text-yellow-400', debuffColor: 'text-yellow-300/50' },
  dodge: { icon: '👻', buffColor: 'text-cyan-400', debuffColor: 'text-cyan-300/50' },
  all_stats: { icon: '⭐', buffColor: 'text-amber-400', debuffColor: 'text-amber-300/50' },
};

// ============= COMBAT EFFECTS TRACKER =============
export interface CombatEffects {
  statusEffects: StatusEffect[];
  statModifiers: StatModifier[];
}

export const EMPTY_COMBAT_EFFECTS: CombatEffects = {
  statusEffects: [],
  statModifiers: [],
};

// ============= EFFECT APPLICATION =============

// Map move effects to status/buff applications
export function getMoveEffectResult(effectId: string | undefined): {
  statusEffect?: { type: StatusEffectType; duration: number };
  statModifier?: { stat: BuffType; direction: BuffDirection; percentage: number; duration: number };
  self?: boolean; // Target self instead of enemy
} | null {
  if (!effectId) return null;
  
  switch (effectId) {
    // Status effects
    case 'poison':
      return { statusEffect: { type: 'poison', duration: 3 } };
    case 'burn':
      return { statusEffect: { type: 'burn', duration: 3 } };
    case 'freeze':
      return { statusEffect: { type: 'freeze', duration: 2 } };
    case 'paralyze':
      return { statusEffect: { type: 'paralyze', duration: 3 } };
    case 'confuse':
      return { statusEffect: { type: 'confuse', duration: 3 } };
    
    // Debuffs (applied to enemy)
    case 'lower_attack':
      return { statModifier: { stat: 'attack', direction: 'debuff', percentage: 20, duration: 3 } };
    case 'lower_defense':
      return { statModifier: { stat: 'defense', direction: 'debuff', percentage: 20, duration: 3 } };
    case 'lower_speed':
      return { statModifier: { stat: 'speed', direction: 'debuff', percentage: 20, duration: 3 } };
    case 'lower_all_stats':
      return { statModifier: { stat: 'all_stats', direction: 'debuff', percentage: 10, duration: 3 } };
    
    // Buffs (applied to self)
    case 'raise_attack':
      return { statModifier: { stat: 'attack', direction: 'buff', percentage: 25, duration: 3 }, self: true };
    case 'raise_defense':
      return { statModifier: { stat: 'defense', direction: 'buff', percentage: 25, duration: 3 }, self: true };
    case 'raise_speed':
      return { statModifier: { stat: 'speed', direction: 'buff', percentage: 25, duration: 3 }, self: true };
    case 'raise_special':
      return { statModifier: { stat: 'special', direction: 'buff', percentage: 25, duration: 3 }, self: true };
    case 'raise_accuracy':
      return { statModifier: { stat: 'accuracy', direction: 'buff', percentage: 20, duration: 3 }, self: true };
    case 'raise_dodge':
      return { statModifier: { stat: 'dodge', direction: 'buff', percentage: 25, duration: 3 }, self: true };
    case 'raise_all_stats':
      return { statModifier: { stat: 'all_stats', direction: 'buff', percentage: 15, duration: 4 }, self: true };
    
    // Special effects handled elsewhere
    case 'charge_next':
    case 'double_next':
    case 'crit_chance':
    case 'crit_vs_wounded':
    case 'bonus_vs_wounded':
    case 'heal_self':
    case 'restore_stamina':
    case 'restore_stamina_15':
    case 'restore_stamina_20':
    case 'restore_stamina_25':
    case 'restore_stamina_30':
    case 'drain_stamina':
    case 'drain_enemy_stamina':
    case 'find_item':
    case 'reveal_stats':
    case 'copy_type':
    case 'steal_buff':
      return null; // Handled by combat system
    
    default:
      return null;
  }
}

// Apply a status effect to a combat effects tracker
export function applyStatusEffect(
  effects: CombatEffects,
  type: StatusEffectType,
  duration: number,
  source: string
): { effects: CombatEffects; applied: boolean; message: string } {
  // Check if already has this status (can't stack same status)
  const existing = effects.statusEffects.find(e => e.type === type);
  if (existing) {
    // Refresh duration if new one is longer
    if (duration > existing.turnsRemaining) {
      existing.turnsRemaining = duration;
      return {
        effects,
        applied: true,
        message: `${STATUS_EFFECT_CONFIG[type].icon} ${type.charAt(0).toUpperCase() + type.slice(1)} refreshed!`
      };
    }
    return { effects, applied: false, message: '' };
  }
  
  const newEffect: StatusEffect = {
    type,
    turnsRemaining: duration,
    source,
  };
  
  return {
    effects: {
      ...effects,
      statusEffects: [...effects.statusEffects, newEffect],
    },
    applied: true,
    message: `${STATUS_EFFECT_CONFIG[type].icon} Inflicted ${type}!`
  };
}

// Apply a stat modifier to a combat effects tracker
export function applyStatModifier(
  effects: CombatEffects,
  stat: BuffType,
  direction: BuffDirection,
  percentage: number,
  duration: number,
  source: string
): { effects: CombatEffects; applied: boolean; message: string } {
  const config = BUFF_CONFIG[stat];
  const arrow = direction === 'buff' ? '↑' : '↓';
  const word = direction === 'buff' ? 'raised' : 'lowered';
  
  // For all_stats, apply individual modifiers
  if (stat === 'all_stats') {
    let currentEffects: CombatEffects = { 
      statusEffects: [...effects.statusEffects], 
      statModifiers: [...effects.statModifiers] 
    };
    const stats: BuffType[] = ['attack', 'defense', 'speed', 'special'];
    for (const s of stats) {
      const result = applyStatModifier(currentEffects, s, direction, percentage, duration, source);
      currentEffects = result.effects;
    }
    return {
      effects: currentEffects,
      applied: true,
      message: `${config.icon} All stats ${word}!`
    };
  }
  
  // Check for existing modifier on same stat
  const existingIndex = effects.statModifiers.findIndex(m => m.stat === stat && m.direction === direction);
  
  if (existingIndex !== -1) {
    // Stack or refresh
    const existing = effects.statModifiers[existingIndex];
    const newModifiers = [...effects.statModifiers];
    newModifiers[existingIndex] = {
      ...existing,
      percentage: Math.min(existing.percentage + percentage, 100), // Cap at 100%
      turnsRemaining: Math.max(existing.turnsRemaining, duration),
      stacks: (existing.stacks || 1) + 1,
    };
    return {
      effects: { ...effects, statModifiers: newModifiers },
      applied: true,
      message: `${config.icon} ${stat.charAt(0).toUpperCase() + stat.slice(1)} ${word} further! ${arrow}`
    };
  }
  
  const newModifier: StatModifier = {
    stat,
    direction,
    percentage,
    turnsRemaining: duration,
    source,
    stacks: 1,
  };
  
  return {
    effects: {
      ...effects,
      statModifiers: [...effects.statModifiers, newModifier],
    },
    applied: true,
    message: `${config.icon} ${stat.charAt(0).toUpperCase() + stat.slice(1)} ${word}! ${arrow}`
  };
}

// ============= TURN PROCESSING =============

// Process start of turn effects (status damage, etc.)
export function processStartOfTurn(
  monster: Monster,
  effects: CombatEffects
): { 
  damage: number; 
  skipTurn: boolean; 
  hurtSelf: boolean;
  messages: string[];
  modifiedStats: Partial<Monster['stats']>;
} {
  const messages: string[] = [];
  let damage = 0;
  let skipTurn = false;
  let hurtSelf = false;
  const modifiedStats: Partial<Monster['stats']> = {};
  
  for (const effect of effects.statusEffects) {
    const config = STATUS_EFFECT_CONFIG[effect.type];
    
    switch (effect.type) {
      case 'poison':
        const poisonDmg = Math.max(1, Math.floor(monster.stats.maxHp * (config.damagePercent! / 100)));
        damage += poisonDmg;
        messages.push(`${config.icon} Poison deals ${poisonDmg} damage!`);
        break;
        
      case 'burn':
        const burnDmg = Math.max(1, Math.floor(monster.stats.maxHp * (config.damagePercent! / 100)));
        damage += burnDmg;
        messages.push(`${config.icon} Burn deals ${burnDmg} damage!`);
        break;
        
      case 'freeze':
        if (Math.random() < 0.25) {
          skipTurn = true;
          messages.push(`${config.icon} Frozen solid! Can't move!`);
        }
        break;
        
      case 'paralyze':
        if (Math.random() < 0.30) {
          skipTurn = true;
          messages.push(`${config.icon} Paralyzed! Can't move!`);
        }
        break;
        
      case 'confuse':
        if (Math.random() < 0.25) {
          hurtSelf = true;
          messages.push(`${config.icon} Confused! Hit itself!`);
        }
        break;
    }
  }
  
  return { damage, skipTurn, hurtSelf, messages, modifiedStats };
}

// Get effective stats after applying buffs/debuffs
export function getEffectiveStats(
  baseStats: Monster['stats'],
  modifiers: StatModifier[]
): Monster['stats'] {
  const stats = { ...baseStats };
  
  for (const mod of modifiers) {
    if (mod.stat === 'all_stats') continue; // Handled by individual stats
    
    const multiplier = mod.direction === 'buff' 
      ? 1 + (mod.percentage / 100)
      : 1 - (mod.percentage / 100);
    
    switch (mod.stat) {
      case 'attack':
        stats.attack = Math.floor(baseStats.attack * multiplier);
        break;
      case 'defense':
        stats.defense = Math.floor(baseStats.defense * multiplier);
        break;
      case 'speed':
        stats.speed = Math.floor(baseStats.speed * multiplier);
        break;
      case 'special':
        stats.special = Math.floor(baseStats.special * multiplier);
        break;
      case 'dodge':
        stats.dodge = Math.floor(baseStats.dodge * multiplier);
        break;
    }
  }
  
  return stats;
}

// Decrement turn counters and remove expired effects
export function tickEffects(effects: CombatEffects): { 
  effects: CombatEffects; 
  expiredMessages: string[] 
} {
  const expiredMessages: string[] = [];
  
  const newStatusEffects = effects.statusEffects
    .map(e => ({ ...e, turnsRemaining: e.turnsRemaining - 1 }))
    .filter(e => {
      if (e.turnsRemaining <= 0) {
        expiredMessages.push(`${STATUS_EFFECT_CONFIG[e.type].icon} ${e.type.charAt(0).toUpperCase() + e.type.slice(1)} wore off!`);
        return false;
      }
      return true;
    });
  
  const newStatModifiers = effects.statModifiers
    .map(m => ({ ...m, turnsRemaining: m.turnsRemaining - 1 }))
    .filter(m => {
      if (m.turnsRemaining <= 0) {
        const config = BUFF_CONFIG[m.stat];
        const word = m.direction === 'buff' ? 'boost' : 'penalty';
        expiredMessages.push(`${config.icon} ${m.stat.charAt(0).toUpperCase() + m.stat.slice(1)} ${word} wore off!`);
        return false;
      }
      return true;
    });
  
  return {
    effects: { statusEffects: newStatusEffects, statModifiers: newStatModifiers },
    expiredMessages,
  };
}

// Remove a specific status effect (for cure items)
export function cureStatusEffect(
  effects: CombatEffects,
  type: StatusEffectType
): { effects: CombatEffects; cured: boolean } {
  const index = effects.statusEffects.findIndex(e => e.type === type);
  if (index === -1) {
    return { effects, cured: false };
  }
  
  return {
    effects: {
      ...effects,
      statusEffects: effects.statusEffects.filter((_, i) => i !== index),
    },
    cured: true,
  };
}

// Cure all status effects
export function cureAllStatusEffects(effects: CombatEffects): CombatEffects {
  return {
    ...effects,
    statusEffects: [],
  };
}

// Check if monster has a specific status
export function hasStatus(effects: CombatEffects, type: StatusEffectType): boolean {
  return effects.statusEffects.some(e => e.type === type);
}

// Get total buff/debuff percentage for a stat
export function getStatModifierTotal(modifiers: StatModifier[], stat: BuffType): number {
  let total = 0;
  for (const mod of modifiers) {
    if (mod.stat === stat || mod.stat === 'all_stats') {
      total += mod.direction === 'buff' ? mod.percentage : -mod.percentage;
    }
  }
  return total;
}
