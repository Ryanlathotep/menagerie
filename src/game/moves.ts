// Movesets System - Abilities based on Species, Element, and Class

import { SpeciesType, ElementType, ClassType } from './types';

export type MoveType = 'melee' | 'ranged' | 'status' | 'heal';

export interface Move {
  id: string;
  name: string;
  description: string;
  type: MoveType;
  power: number;        // Base damage (0 for status/heal)
  accuracy: number;     // 0-100
  staminaCost: number;  // Stamina consumed
  element?: ElementType; // Element moves use this
  effect?: string;      // Special effect description
}

// Species-specific moves (unique to each creature type)
export const SPECIES_MOVES: Record<SpeciesType, Move[]> = {
  slime: [
    { id: 'slime_slam', name: 'Slime Slam', description: 'A goopy body slam', type: 'melee', power: 25, accuracy: 95, staminaCost: 5 },
    { id: 'absorb', name: 'Absorb', description: 'Absorb HP from enemy', type: 'melee', power: 15, accuracy: 100, staminaCost: 8, effect: 'heal_self' },
  ],
  skeleton: [
    { id: 'bone_throw', name: 'Bone Throw', description: 'Hurl a sharp bone', type: 'ranged', power: 30, accuracy: 85, staminaCost: 6 },
    { id: 'rattle', name: 'Rattle', description: 'Scary bone rattling', type: 'status', power: 0, accuracy: 90, staminaCost: 4, effect: 'lower_defense' },
  ],
  goblin: [
    { id: 'sneaky_stab', name: 'Sneaky Stab', description: 'A cunning strike', type: 'melee', power: 35, accuracy: 80, staminaCost: 7, effect: 'crit_chance' },
    { id: 'taunt', name: 'Taunt', description: 'Mock the enemy', type: 'status', power: 0, accuracy: 100, staminaCost: 3, effect: 'lower_attack' },
  ],
  mushroom: [
    { id: 'spore_burst', name: 'Spore Burst', description: 'Release toxic spores', type: 'ranged', power: 20, accuracy: 90, staminaCost: 6, effect: 'poison' },
    { id: 'regenerate', name: 'Regenerate', description: 'Heal over time', type: 'heal', power: 25, accuracy: 100, staminaCost: 10 },
  ],
  ghost: [
    { id: 'haunt', name: 'Haunt', description: 'Phase through and strike', type: 'melee', power: 30, accuracy: 100, staminaCost: 8 },
    { id: 'terrify', name: 'Terrify', description: 'Cause fear', type: 'status', power: 0, accuracy: 85, staminaCost: 5, effect: 'lower_speed' },
  ],
  imp: [
    { id: 'mischief', name: 'Mischief', description: 'Tricky attack', type: 'melee', power: 25, accuracy: 90, staminaCost: 5 },
    { id: 'steal_buff', name: 'Steal Buff', description: 'Take enemy buff', type: 'status', power: 0, accuracy: 75, staminaCost: 8, effect: 'steal_buff' },
  ],
  golem: [
    { id: 'rock_smash', name: 'Rock Smash', description: 'Devastating punch', type: 'melee', power: 45, accuracy: 75, staminaCost: 10 },
    { id: 'fortify', name: 'Fortify', description: 'Harden defenses', type: 'status', power: 0, accuracy: 100, staminaCost: 6, effect: 'raise_defense' },
  ],
  wisp: [
    { id: 'light_beam', name: 'Light Beam', description: 'Focused light attack', type: 'ranged', power: 30, accuracy: 95, staminaCost: 7 },
    { id: 'illuminate', name: 'Illuminate', description: 'Boost team accuracy', type: 'status', power: 0, accuracy: 100, staminaCost: 5, effect: 'raise_accuracy' },
  ],
  chimera: [
    { id: 'triple_strike', name: 'Triple Strike', description: 'Three-headed assault', type: 'melee', power: 35, accuracy: 85, staminaCost: 9 },
    { id: 'adapt', name: 'Adapt', description: 'Copy enemy type', type: 'status', power: 0, accuracy: 100, staminaCost: 7, effect: 'copy_type' },
  ],
  dragon: [
    { id: 'claw_rend', name: 'Claw Rend', description: 'Savage claw attack', type: 'melee', power: 40, accuracy: 90, staminaCost: 8 },
    { id: 'dragon_roar', name: 'Dragon Roar', description: 'Intimidating roar', type: 'status', power: 0, accuracy: 100, staminaCost: 6, effect: 'lower_all_stats' },
  ],
  rat: [
    { id: 'quick_bite', name: 'Quick Bite', description: 'Fast nibble attack', type: 'melee', power: 20, accuracy: 100, staminaCost: 4 },
    { id: 'scavenge', name: 'Scavenge', description: 'Find an item', type: 'status', power: 0, accuracy: 80, staminaCost: 8, effect: 'find_item' },
  ],
  spider: [
    { id: 'venom_bite', name: 'Venom Bite', description: 'Poisonous fangs', type: 'melee', power: 25, accuracy: 90, staminaCost: 6, effect: 'poison' },
    { id: 'web_trap', name: 'Web Trap', description: 'Slow the enemy', type: 'status', power: 0, accuracy: 85, staminaCost: 5, effect: 'lower_speed' },
  ],
  bat: [
    { id: 'sonic_screech', name: 'Sonic Screech', description: 'Disorienting sound', type: 'ranged', power: 25, accuracy: 95, staminaCost: 6 },
    { id: 'life_drain', name: 'Life Drain', description: 'Vampiric bite', type: 'melee', power: 20, accuracy: 90, staminaCost: 8, effect: 'heal_self' },
  ],
  snake: [
    { id: 'constrict', name: 'Constrict', description: 'Crushing squeeze', type: 'melee', power: 30, accuracy: 85, staminaCost: 7 },
    { id: 'toxic_fang', name: 'Toxic Fang', description: 'Venomous strike', type: 'melee', power: 25, accuracy: 90, staminaCost: 6, effect: 'poison' },
  ],
  wolf: [
    { id: 'pack_strike', name: 'Pack Strike', description: 'Coordinated attack', type: 'melee', power: 35, accuracy: 90, staminaCost: 7 },
    { id: 'howl', name: 'Howl', description: 'Boost attack power', type: 'status', power: 0, accuracy: 100, staminaCost: 5, effect: 'raise_attack' },
  ],
  beetle: [
    { id: 'horn_charge', name: 'Horn Charge', description: 'Powerful charge', type: 'melee', power: 35, accuracy: 85, staminaCost: 8 },
    { id: 'shell_guard', name: 'Shell Guard', description: 'Defensive stance', type: 'status', power: 0, accuracy: 100, staminaCost: 4, effect: 'raise_defense' },
  ],
  crow: [
    { id: 'peck_flurry', name: 'Peck Flurry', description: 'Rapid pecking', type: 'melee', power: 28, accuracy: 95, staminaCost: 6 },
    { id: 'keen_sight', name: 'Keen Sight', description: 'Reveal enemy stats', type: 'status', power: 0, accuracy: 100, staminaCost: 3, effect: 'reveal_stats' },
  ],
  shark: [
    { id: 'bite_frenzy', name: 'Bite Frenzy', description: 'Savage biting', type: 'melee', power: 45, accuracy: 80, staminaCost: 10, effect: 'bonus_vs_wounded' },
    { id: 'blood_sense', name: 'Blood Sense', description: 'Track wounded prey', type: 'status', power: 0, accuracy: 100, staminaCost: 4, effect: 'crit_vs_wounded' },
  ],
  frog: [
    { id: 'tongue_lash', name: 'Tongue Lash', description: 'Stretchy tongue attack', type: 'ranged', power: 25, accuracy: 95, staminaCost: 5 },
    { id: 'croak', name: 'Croak', description: 'Confusing sound', type: 'status', power: 0, accuracy: 80, staminaCost: 5, effect: 'confuse' },
  ],
  jellyfish: [
    { id: 'sting_tentacle', name: 'Sting Tentacle', description: 'Stinging attack', type: 'melee', power: 20, accuracy: 90, staminaCost: 5, effect: 'paralyze' },
    { id: 'drift', name: 'Drift', description: 'Evasive movement', type: 'status', power: 0, accuracy: 100, staminaCost: 4, effect: 'raise_evasion' },
  ],
};

// Element-specific moves (elemental magic)
export const ELEMENT_MOVES: Record<ElementType, Move[]> = {
  fire: [
    { id: 'fireball', name: 'Fireball', description: 'Launch a blazing orb', type: 'ranged', power: 35, accuracy: 90, staminaCost: 8, element: 'fire' },
    { id: 'flame_burst', name: 'Flame Burst', description: 'Explosive fire', type: 'ranged', power: 25, accuracy: 95, staminaCost: 6, element: 'fire', effect: 'burn' },
  ],
  water: [
    { id: 'aqua_jet', name: 'Aqua Jet', description: 'High-pressure water', type: 'ranged', power: 30, accuracy: 95, staminaCost: 7, element: 'water' },
    { id: 'tidal_wave', name: 'Tidal Wave', description: 'Crushing wave', type: 'ranged', power: 40, accuracy: 80, staminaCost: 10, element: 'water' },
  ],
  earth: [
    { id: 'rock_throw', name: 'Rock Throw', description: 'Hurl boulders', type: 'ranged', power: 35, accuracy: 85, staminaCost: 7, element: 'earth' },
    { id: 'earthquake', name: 'Earthquake', description: 'Ground-shaking attack', type: 'melee', power: 40, accuracy: 75, staminaCost: 12, element: 'earth' },
  ],
  air: [
    { id: 'wind_slash', name: 'Wind Slash', description: 'Cutting air blade', type: 'ranged', power: 30, accuracy: 95, staminaCost: 6, element: 'air' },
    { id: 'cyclone', name: 'Cyclone', description: 'Spinning vortex', type: 'ranged', power: 35, accuracy: 85, staminaCost: 9, element: 'air', effect: 'confuse' },
  ],
  void: [
    { id: 'shadow_bolt', name: 'Shadow Bolt', description: 'Dark energy blast', type: 'ranged', power: 35, accuracy: 90, staminaCost: 8, element: 'void' },
    { id: 'null_zone', name: 'Null Zone', description: 'Drain enemy stamina', type: 'status', power: 0, accuracy: 85, staminaCost: 10, element: 'void', effect: 'drain_stamina' },
  ],
};

// Class-specific moves (combat style)
export const CLASS_MOVES: Record<ClassType, Move[]> = {
  kinetic: [
    { id: 'power_strike', name: 'Power Strike', description: 'Raw physical force', type: 'melee', power: 40, accuracy: 90, staminaCost: 8 },
    { id: 'momentum', name: 'Momentum', description: 'Build up power', type: 'status', power: 0, accuracy: 100, staminaCost: 5, effect: 'charge_next' },
  ],
  energy: [
    { id: 'energy_blast', name: 'Energy Blast', description: 'Pure energy attack', type: 'ranged', power: 35, accuracy: 95, staminaCost: 7 },
    { id: 'overcharge', name: 'Overcharge', description: 'Boost special power', type: 'status', power: 0, accuracy: 100, staminaCost: 6, effect: 'raise_special' },
  ],
  biological: [
    { id: 'bio_strike', name: 'Bio Strike', description: 'Nature-infused attack', type: 'melee', power: 30, accuracy: 90, staminaCost: 6 },
    { id: 'regeneration', name: 'Regeneration', description: 'Heal over time', type: 'heal', power: 30, accuracy: 100, staminaCost: 10 },
  ],
  chemical: [
    { id: 'acid_spray', name: 'Acid Spray', description: 'Corrosive attack', type: 'ranged', power: 30, accuracy: 90, staminaCost: 7, effect: 'lower_defense' },
    { id: 'catalyst', name: 'Catalyst', description: 'Boost next attack', type: 'status', power: 0, accuracy: 100, staminaCost: 5, effect: 'double_next' },
  ],
  political: [
    { id: 'decree', name: 'Decree', description: 'Commanding strike', type: 'ranged', power: 25, accuracy: 100, staminaCost: 6 },
    { id: 'inspire', name: 'Inspire', description: 'Boost all stats', type: 'status', power: 0, accuracy: 100, staminaCost: 12, effect: 'raise_all_stats' },
  ],
};

// Get all moves available to a monster
export function getMonsterMoves(species: SpeciesType, element: ElementType, classType: ClassType): Move[] {
  return [
    ...SPECIES_MOVES[species],
    ...ELEMENT_MOVES[element],
    ...CLASS_MOVES[classType],
  ];
}

// Get move by ID
export function getMoveById(id: string): Move | undefined {
  const allMoves = [
    ...Object.values(SPECIES_MOVES).flat(),
    ...Object.values(ELEMENT_MOVES).flat(),
    ...Object.values(CLASS_MOVES).flat(),
  ];
  return allMoves.find(m => m.id === id);
}