// Movesets System - Abilities based on 1-3 aspects (Species, Element, Class)

import { SpeciesType, ElementType, ClassType } from './types';

export type MoveType = 'melee' | 'ranged' | 'status' | 'heal';

// Aspect source types
export type AspectSource = 'species' | 'element' | 'class';

export interface Move {
  id: string;
  name: string;
  description: string;
  type: MoveType;
  power: number;        // Base damage (0 for status/heal)
  accuracy: number;     // 0-100 base accuracy
  staminaCost: number;  // Stamina consumed
  speedMod: number;     // Speed modifier: negative = slower, positive = faster (priority)
  aspects: AspectSource[];  // Which aspects power this move (1-3)
  element?: ElementType;    // Elemental type if applicable
  classBonus?: ClassType;   // Class that gives bonus if applicable
  effect?: string;      // Special effect
}

// ============= SPECIES-ONLY MOVES (1 aspect) =============
export const SPECIES_MOVES: Record<SpeciesType, Move[]> = {
  slime: [
    { id: 'slime_slam', name: 'Slime Slam', description: 'A goopy body slam', type: 'melee', power: 25, accuracy: 95, staminaCost: 5, speedMod: 0, aspects: ['species'] },
    { id: 'absorb', name: 'Absorb', description: 'Absorb HP from enemy', type: 'melee', power: 15, accuracy: 100, staminaCost: 8, speedMod: -1, aspects: ['species'], effect: 'heal_self' },
  ],
  skeleton: [
    { id: 'bone_throw', name: 'Bone Throw', description: 'Hurl a sharp bone', type: 'ranged', power: 30, accuracy: 85, staminaCost: 6, speedMod: 0, aspects: ['species'] },
    { id: 'rattle', name: 'Rattle', description: 'Scary bone rattling', type: 'status', power: 0, accuracy: 90, staminaCost: 4, speedMod: 1, aspects: ['species'], effect: 'lower_defense' },
  ],
  goblin: [
    { id: 'sneaky_stab', name: 'Sneaky Stab', description: 'A cunning strike', type: 'melee', power: 35, accuracy: 80, staminaCost: 7, speedMod: 1, aspects: ['species'], effect: 'crit_chance' },
    { id: 'taunt', name: 'Taunt', description: 'Mock the enemy', type: 'status', power: 0, accuracy: 100, staminaCost: 3, speedMod: 2, aspects: ['species'], effect: 'lower_attack' },
  ],
  mushroom: [
    { id: 'spore_burst', name: 'Spore Burst', description: 'Release toxic spores', type: 'ranged', power: 20, accuracy: 90, staminaCost: 6, speedMod: -1, aspects: ['species'], effect: 'poison' },
    { id: 'regenerate', name: 'Regenerate', description: 'Heal over time', type: 'heal', power: 25, accuracy: 100, staminaCost: 10, speedMod: 0, aspects: ['species'] },
  ],
  ghost: [
    { id: 'haunt', name: 'Haunt', description: 'Phase through and strike', type: 'melee', power: 30, accuracy: 100, staminaCost: 8, speedMod: 0, aspects: ['species'] },
    { id: 'terrify', name: 'Terrify', description: 'Cause fear', type: 'status', power: 0, accuracy: 85, staminaCost: 5, speedMod: 1, aspects: ['species'], effect: 'lower_speed' },
  ],
  imp: [
    { id: 'mischief', name: 'Mischief', description: 'Tricky attack', type: 'melee', power: 25, accuracy: 90, staminaCost: 5, speedMod: 1, aspects: ['species'] },
    { id: 'steal_buff', name: 'Steal Buff', description: 'Take enemy buff', type: 'status', power: 0, accuracy: 75, staminaCost: 8, speedMod: 0, aspects: ['species'], effect: 'steal_buff' },
  ],
  golem: [
    { id: 'rock_smash', name: 'Rock Smash', description: 'Devastating punch', type: 'melee', power: 45, accuracy: 75, staminaCost: 10, speedMod: -2, aspects: ['species'] },
    { id: 'fortify', name: 'Fortify', description: 'Harden defenses', type: 'status', power: 0, accuracy: 100, staminaCost: 6, speedMod: 0, aspects: ['species'], effect: 'raise_defense' },
  ],
  wisp: [
    { id: 'light_beam', name: 'Light Beam', description: 'Focused light attack', type: 'ranged', power: 30, accuracy: 95, staminaCost: 7, speedMod: 1, aspects: ['species'] },
    { id: 'illuminate', name: 'Illuminate', description: 'Boost team accuracy', type: 'status', power: 0, accuracy: 100, staminaCost: 5, speedMod: 0, aspects: ['species'], effect: 'raise_accuracy' },
  ],
  chimera: [
    { id: 'triple_strike', name: 'Triple Strike', description: 'Three-headed assault', type: 'melee', power: 35, accuracy: 85, staminaCost: 9, speedMod: 0, aspects: ['species'] },
    { id: 'adapt', name: 'Adapt', description: 'Copy enemy type', type: 'status', power: 0, accuracy: 100, staminaCost: 7, speedMod: 0, aspects: ['species'], effect: 'copy_type' },
  ],
  dragon: [
    { id: 'claw_rend', name: 'Claw Rend', description: 'Savage claw attack', type: 'melee', power: 40, accuracy: 90, staminaCost: 8, speedMod: 0, aspects: ['species'] },
    { id: 'dragon_roar', name: 'Dragon Roar', description: 'Intimidating roar', type: 'status', power: 0, accuracy: 100, staminaCost: 6, speedMod: 1, aspects: ['species'], effect: 'lower_all_stats' },
  ],
  rat: [
    { id: 'quick_bite', name: 'Quick Bite', description: 'Fast nibble attack', type: 'melee', power: 20, accuracy: 100, staminaCost: 4, speedMod: 2, aspects: ['species'] },
    { id: 'scavenge', name: 'Scavenge', description: 'Find an item', type: 'status', power: 0, accuracy: 80, staminaCost: 8, speedMod: 0, aspects: ['species'], effect: 'find_item' },
  ],
  spider: [
    { id: 'venom_bite', name: 'Venom Bite', description: 'Poisonous fangs', type: 'melee', power: 25, accuracy: 90, staminaCost: 6, speedMod: 0, aspects: ['species'], effect: 'poison' },
    { id: 'web_trap', name: 'Web Trap', description: 'Slow the enemy', type: 'status', power: 0, accuracy: 85, staminaCost: 5, speedMod: 1, aspects: ['species'], effect: 'lower_speed' },
  ],
  bat: [
    { id: 'sonic_screech', name: 'Sonic Screech', description: 'Disorienting sound', type: 'ranged', power: 25, accuracy: 95, staminaCost: 6, speedMod: 1, aspects: ['species'] },
    { id: 'life_drain', name: 'Life Drain', description: 'Vampiric bite', type: 'melee', power: 20, accuracy: 90, staminaCost: 8, speedMod: 0, aspects: ['species'], effect: 'heal_self' },
  ],
  snake: [
    { id: 'constrict', name: 'Constrict', description: 'Crushing squeeze', type: 'melee', power: 30, accuracy: 85, staminaCost: 7, speedMod: -1, aspects: ['species'] },
    { id: 'toxic_fang', name: 'Toxic Fang', description: 'Venomous strike', type: 'melee', power: 25, accuracy: 90, staminaCost: 6, speedMod: 0, aspects: ['species'], effect: 'poison' },
  ],
  wolf: [
    { id: 'pack_strike', name: 'Pack Strike', description: 'Coordinated attack', type: 'melee', power: 35, accuracy: 90, staminaCost: 7, speedMod: 0, aspects: ['species'] },
    { id: 'howl', name: 'Howl', description: 'Boost attack power', type: 'status', power: 0, accuracy: 100, staminaCost: 5, speedMod: 0, aspects: ['species'], effect: 'raise_attack' },
  ],
  beetle: [
    { id: 'horn_charge', name: 'Horn Charge', description: 'Powerful charge', type: 'melee', power: 35, accuracy: 85, staminaCost: 8, speedMod: -1, aspects: ['species'] },
    { id: 'shell_guard', name: 'Shell Guard', description: 'Defensive stance', type: 'status', power: 0, accuracy: 100, staminaCost: 4, speedMod: 0, aspects: ['species'], effect: 'raise_defense' },
  ],
  crow: [
    { id: 'peck_flurry', name: 'Peck Flurry', description: 'Rapid pecking', type: 'melee', power: 28, accuracy: 95, staminaCost: 6, speedMod: 1, aspects: ['species'] },
    { id: 'keen_sight', name: 'Keen Sight', description: 'Reveal enemy stats', type: 'status', power: 0, accuracy: 100, staminaCost: 3, speedMod: 2, aspects: ['species'], effect: 'reveal_stats' },
  ],
  shark: [
    { id: 'bite_frenzy', name: 'Bite Frenzy', description: 'Savage biting', type: 'melee', power: 45, accuracy: 80, staminaCost: 10, speedMod: 0, aspects: ['species'], effect: 'bonus_vs_wounded' },
    { id: 'blood_sense', name: 'Blood Sense', description: 'Track wounded prey', type: 'status', power: 0, accuracy: 100, staminaCost: 4, speedMod: 1, aspects: ['species'], effect: 'crit_vs_wounded' },
  ],
  frog: [
    { id: 'tongue_lash', name: 'Tongue Lash', description: 'Stretchy tongue attack', type: 'ranged', power: 25, accuracy: 95, staminaCost: 5, speedMod: 1, aspects: ['species'] },
    { id: 'croak', name: 'Croak', description: 'Confusing sound', type: 'status', power: 0, accuracy: 80, staminaCost: 5, speedMod: 0, aspects: ['species'], effect: 'confuse' },
  ],
  jellyfish: [
    { id: 'sting_tentacle', name: 'Sting Tentacle', description: 'Stinging attack', type: 'melee', power: 20, accuracy: 90, staminaCost: 5, speedMod: 0, aspects: ['species'], effect: 'paralyze' },
    { id: 'drift', name: 'Drift', description: 'Evasive movement', type: 'status', power: 0, accuracy: 100, staminaCost: 4, speedMod: 0, aspects: ['species'], effect: 'raise_dodge' },
  ],
};

// ============= ELEMENT-ONLY MOVES (1 aspect) =============
export const ELEMENT_MOVES: Record<ElementType, Move[]> = {
  normal: [
    { id: 'tackle', name: 'Tackle', description: 'Basic physical attack', type: 'melee', power: 25, accuracy: 95, staminaCost: 4, speedMod: 0, aspects: ['element'], element: 'normal' },
    { id: 'focus', name: 'Focus', description: 'Concentrate energy', type: 'status', power: 0, accuracy: 100, staminaCost: 5, speedMod: 0, aspects: ['element'], element: 'normal', effect: 'raise_accuracy' },
  ],
  fire: [
    { id: 'fireball', name: 'Fireball', description: 'Launch a blazing orb', type: 'ranged', power: 35, accuracy: 90, staminaCost: 8, speedMod: 0, aspects: ['element'], element: 'fire' },
    { id: 'flame_burst', name: 'Flame Burst', description: 'Explosive fire', type: 'ranged', power: 25, accuracy: 95, staminaCost: 6, speedMod: 1, aspects: ['element'], element: 'fire', effect: 'burn' },
  ],
  water: [
    { id: 'aqua_jet', name: 'Aqua Jet', description: 'High-pressure water', type: 'ranged', power: 30, accuracy: 95, staminaCost: 7, speedMod: 1, aspects: ['element'], element: 'water' },
    { id: 'tidal_wave', name: 'Tidal Wave', description: 'Crushing wave', type: 'ranged', power: 40, accuracy: 80, staminaCost: 10, speedMod: -1, aspects: ['element'], element: 'water' },
  ],
  earth: [
    { id: 'rock_throw', name: 'Rock Throw', description: 'Hurl boulders', type: 'ranged', power: 35, accuracy: 85, staminaCost: 7, speedMod: 0, aspects: ['element'], element: 'earth' },
    { id: 'earthquake', name: 'Earthquake', description: 'Ground-shaking attack', type: 'melee', power: 40, accuracy: 75, staminaCost: 12, speedMod: -2, aspects: ['element'], element: 'earth' },
  ],
  air: [
    { id: 'wind_slash', name: 'Wind Slash', description: 'Cutting air blade', type: 'ranged', power: 30, accuracy: 95, staminaCost: 6, speedMod: 2, aspects: ['element'], element: 'air' },
    { id: 'cyclone', name: 'Cyclone', description: 'Spinning vortex', type: 'ranged', power: 35, accuracy: 85, staminaCost: 9, speedMod: 0, aspects: ['element'], element: 'air', effect: 'confuse' },
  ],
  void: [
    { id: 'shadow_bolt', name: 'Shadow Bolt', description: 'Dark energy blast', type: 'ranged', power: 35, accuracy: 90, staminaCost: 8, speedMod: 0, aspects: ['element'], element: 'void' },
    { id: 'null_zone', name: 'Null Zone', description: 'Drain enemy stamina', type: 'status', power: 0, accuracy: 85, staminaCost: 10, speedMod: -1, aspects: ['element'], element: 'void', effect: 'drain_stamina' },
  ],
};

// ============= CLASS-ONLY MOVES (1 aspect) =============
export const CLASS_MOVES: Record<ClassType, Move[]> = {
  normal: [
    { id: 'basic_attack', name: 'Basic Attack', description: 'Simple attack', type: 'melee', power: 25, accuracy: 100, staminaCost: 3, speedMod: 0, aspects: ['class'], classBonus: 'normal' },
    { id: 'rest', name: 'Rest', description: 'Recover stamina', type: 'status', power: 0, accuracy: 100, staminaCost: 0, speedMod: -2, aspects: ['class'], classBonus: 'normal', effect: 'restore_stamina' },
  ],
  kinetic: [
    { id: 'power_strike', name: 'Power Strike', description: 'Raw physical force', type: 'melee', power: 40, accuracy: 90, staminaCost: 8, speedMod: 0, aspects: ['class'], classBonus: 'kinetic' },
    { id: 'momentum', name: 'Momentum', description: 'Build up power', type: 'status', power: 0, accuracy: 100, staminaCost: 5, speedMod: 0, aspects: ['class'], classBonus: 'kinetic', effect: 'charge_next' },
  ],
  energy: [
    { id: 'energy_blast', name: 'Energy Blast', description: 'Pure energy attack', type: 'ranged', power: 35, accuracy: 95, staminaCost: 7, speedMod: 1, aspects: ['class'], classBonus: 'energy' },
    { id: 'overcharge', name: 'Overcharge', description: 'Boost special power', type: 'status', power: 0, accuracy: 100, staminaCost: 6, speedMod: 0, aspects: ['class'], classBonus: 'energy', effect: 'raise_special' },
  ],
  biological: [
    { id: 'bio_strike', name: 'Bio Strike', description: 'Nature-infused attack', type: 'melee', power: 30, accuracy: 90, staminaCost: 6, speedMod: 0, aspects: ['class'], classBonus: 'biological' },
    { id: 'regeneration', name: 'Regeneration', description: 'Heal over time', type: 'heal', power: 30, accuracy: 100, staminaCost: 10, speedMod: -1, aspects: ['class'], classBonus: 'biological' },
  ],
  chemical: [
    { id: 'acid_spray', name: 'Acid Spray', description: 'Corrosive attack', type: 'ranged', power: 30, accuracy: 90, staminaCost: 7, speedMod: 0, aspects: ['class'], classBonus: 'chemical', effect: 'lower_defense' },
    { id: 'catalyst', name: 'Catalyst', description: 'Boost next attack', type: 'status', power: 0, accuracy: 100, staminaCost: 5, speedMod: 0, aspects: ['class'], classBonus: 'chemical', effect: 'double_next' },
  ],
  political: [
    { id: 'decree', name: 'Decree', description: 'Commanding strike', type: 'ranged', power: 25, accuracy: 100, staminaCost: 6, speedMod: 1, aspects: ['class'], classBonus: 'political' },
    { id: 'inspire', name: 'Inspire', description: 'Boost all stats', type: 'status', power: 0, accuracy: 100, staminaCost: 12, speedMod: 0, aspects: ['class'], classBonus: 'political', effect: 'raise_all_stats' },
  ],
};

// ============= DUAL-ASPECT MOVES (2 aspects) =============
// Species + Element combos
export const SPECIES_ELEMENT_MOVES: Record<string, Move[]> = {
  'bat_fire': [
    { id: 'bat_fire_inferno_screech', name: 'Inferno Screech', description: 'A burning sonic wave', type: 'ranged', power: 40, accuracy: 90, staminaCost: 10, speedMod: 1, aspects: ['species', 'element'], element: 'fire' },
  ],
  'bat_water': [
    { id: 'bat_water_tidal_echo', name: 'Tidal Echo', description: 'Water-enhanced sonar', type: 'ranged', power: 35, accuracy: 95, staminaCost: 9, speedMod: 1, aspects: ['species', 'element'], element: 'water' },
  ],
  'bat_earth': [
    { id: 'bat_earth_cave_dive', name: 'Cave Dive', description: 'Stone-coated strike from above', type: 'melee', power: 38, accuracy: 85, staminaCost: 9, speedMod: 0, aspects: ['species', 'element'], element: 'earth' },
  ],
  'bat_air': [
    { id: 'bat_air_gale_screech', name: 'Gale Screech', description: 'Wind-amplified cry', type: 'ranged', power: 38, accuracy: 95, staminaCost: 8, speedMod: 2, aspects: ['species', 'element'], element: 'air' },
  ],
  'bat_void': [
    { id: 'bat_void_shadow_shriek', name: 'Shadow Shriek', description: 'Dark energy sonic blast', type: 'ranged', power: 42, accuracy: 88, staminaCost: 10, speedMod: 1, aspects: ['species', 'element'], element: 'void' },
  ],
  'slime_fire': [
    { id: 'slime_fire_lava_splash', name: 'Lava Splash', description: 'Molten body slam', type: 'melee', power: 35, accuracy: 90, staminaCost: 9, speedMod: 0, aspects: ['species', 'element'], element: 'fire', effect: 'burn' },
  ],
  'dragon_fire': [
    { id: 'dragon_fire_breath', name: 'Fire Breath', description: 'Classic dragon flames', type: 'ranged', power: 50, accuracy: 88, staminaCost: 12, speedMod: 0, aspects: ['species', 'element'], element: 'fire', effect: 'burn' },
  ],
  'shark_water': [
    { id: 'shark_water_hydro_frenzy', name: 'Hydro Frenzy', description: 'Water-propelled biting', type: 'melee', power: 55, accuracy: 78, staminaCost: 14, speedMod: 1, aspects: ['species', 'element'], element: 'water' },
  ],
  'golem_earth': [
    { id: 'golem_earth_seismic_slam', name: 'Seismic Slam', description: 'Earth-shattering punch', type: 'melee', power: 55, accuracy: 70, staminaCost: 14, speedMod: -2, aspects: ['species', 'element'], element: 'earth' },
  ],
  'ghost_void': [
    { id: 'ghost_void_phantom_drain', name: 'Phantom Drain', description: 'Spectral void attack', type: 'melee', power: 40, accuracy: 95, staminaCost: 11, speedMod: 0, aspects: ['species', 'element'], element: 'void', effect: 'heal_self' },
  ],
};

// Species + Class combos
export const SPECIES_CLASS_MOVES: Record<string, Move[]> = {
  'bat_kinetic': [
    { id: 'bat_kinetic_impact_dive', name: 'Impact Dive', description: 'Full-force aerial strike', type: 'melee', power: 42, accuracy: 85, staminaCost: 10, speedMod: 1, aspects: ['species', 'class'], classBonus: 'kinetic' },
  ],
  'bat_energy': [
    { id: 'bat_energy_pulse_wave', name: 'Pulse Wave', description: 'Energy-charged screech', type: 'ranged', power: 38, accuracy: 92, staminaCost: 9, speedMod: 1, aspects: ['species', 'class'], classBonus: 'energy' },
  ],
  'dragon_kinetic': [
    { id: 'dragon_kinetic_tail_slam', name: 'Tail Slam', description: 'Devastating physical tail strike', type: 'melee', power: 50, accuracy: 85, staminaCost: 11, speedMod: -1, aspects: ['species', 'class'], classBonus: 'kinetic' },
  ],
  'slime_biological': [
    { id: 'slime_bio_mitosis', name: 'Mitosis', description: 'Split and regenerate', type: 'heal', power: 40, accuracy: 100, staminaCost: 12, speedMod: 0, aspects: ['species', 'class'], classBonus: 'biological' },
  ],
  'spider_chemical': [
    { id: 'spider_chem_acid_web', name: 'Acid Web', description: 'Corrosive web trap', type: 'ranged', power: 35, accuracy: 88, staminaCost: 10, speedMod: 0, aspects: ['species', 'class'], classBonus: 'chemical', effect: 'poison' },
  ],
};

// Element + Class combos
export const ELEMENT_CLASS_MOVES: Record<string, Move[]> = {
  'fire_kinetic': [
    { id: 'fire_kinetic_blazing_strike', name: 'Blazing Strike', description: 'Flame-enhanced punch', type: 'melee', power: 45, accuracy: 88, staminaCost: 10, speedMod: 0, aspects: ['element', 'class'], element: 'fire', classBonus: 'kinetic' },
  ],
  'water_energy': [
    { id: 'water_energy_hydro_beam', name: 'Hydro Beam', description: 'High-energy water laser', type: 'ranged', power: 45, accuracy: 90, staminaCost: 11, speedMod: 1, aspects: ['element', 'class'], element: 'water', classBonus: 'energy' },
  ],
  'earth_biological': [
    { id: 'earth_bio_nature_growth', name: "Nature's Growth", description: 'Earth-powered healing', type: 'heal', power: 45, accuracy: 100, staminaCost: 13, speedMod: -1, aspects: ['element', 'class'], element: 'earth', classBonus: 'biological' },
  ],
  'void_political': [
    { id: 'void_political_dark_decree', name: 'Dark Decree', description: 'Commanding void energy', type: 'ranged', power: 40, accuracy: 100, staminaCost: 11, speedMod: 0, aspects: ['element', 'class'], element: 'void', classBonus: 'political' },
  ],
  'air_chemical': [
    { id: 'air_chem_toxic_cloud', name: 'Toxic Cloud', description: 'Poisonous gas attack', type: 'ranged', power: 30, accuracy: 92, staminaCost: 9, speedMod: 0, aspects: ['element', 'class'], element: 'air', classBonus: 'chemical', effect: 'poison' },
  ],
};

// ============= TRIPLE-ASPECT MOVES (3 aspects - unique to specific combos) =============
export const TRIPLE_ASPECT_MOVES: Record<string, Move> = {
  'bat_fire_kinetic': {
    id: 'bat_fire_kinetic_meteor_dive', name: 'Meteor Dive', description: 'A blazing aerial impact strike unique to Fire Kinetic Bats',
    type: 'melee', power: 60, accuracy: 82, staminaCost: 15, speedMod: 1, aspects: ['species', 'element', 'class'], element: 'fire', classBonus: 'kinetic'
  },
  'dragon_fire_energy': {
    id: 'dragon_fire_energy_solar_blast', name: 'Solar Blast', description: 'Pure plasma dragon breath',
    type: 'ranged', power: 65, accuracy: 85, staminaCost: 16, speedMod: 0, aspects: ['species', 'element', 'class'], element: 'fire', classBonus: 'energy', effect: 'burn'
  },
  'shark_water_kinetic': {
    id: 'shark_water_kinetic_torpedo', name: 'Torpedo Rush', description: 'Maximum velocity water assault',
    type: 'melee', power: 70, accuracy: 75, staminaCost: 18, speedMod: 2, aspects: ['species', 'element', 'class'], element: 'water', classBonus: 'kinetic'
  },
  'ghost_void_political': {
    id: 'ghost_void_political_spectral_command', name: 'Spectral Command', description: 'Command the shadows themselves',
    type: 'status', power: 0, accuracy: 100, staminaCost: 14, speedMod: 0, aspects: ['species', 'element', 'class'], element: 'void', classBonus: 'political', effect: 'lower_all_stats'
  },
  'golem_earth_kinetic': {
    id: 'golem_earth_kinetic_continental_crush', name: 'Continental Crush', description: 'The ultimate earth-shattering blow',
    type: 'melee', power: 80, accuracy: 65, staminaCost: 20, speedMod: -3, aspects: ['species', 'element', 'class'], element: 'earth', classBonus: 'kinetic'
  },
  'wisp_air_energy': {
    id: 'wisp_air_energy_aurora_beam', name: 'Aurora Beam', description: 'Prismatic light energy',
    type: 'ranged', power: 55, accuracy: 95, staminaCost: 14, speedMod: 2, aspects: ['species', 'element', 'class'], element: 'air', classBonus: 'energy'
  },
};

// Get all moves available to a monster based on its aspects
export function getMonsterMoves(species: SpeciesType, element: ElementType, classType: ClassType): Move[] {
  const moves: Move[] = [];
  
  // Single aspect moves (always available)
  moves.push(...SPECIES_MOVES[species]);
  moves.push(...ELEMENT_MOVES[element]);
  moves.push(...CLASS_MOVES[classType]);
  
  // Dual aspect moves (if defined)
  const speciesElementKey = `${species}_${element}`;
  if (SPECIES_ELEMENT_MOVES[speciesElementKey]) {
    moves.push(...SPECIES_ELEMENT_MOVES[speciesElementKey]);
  }
  
  const speciesClassKey = `${species}_${classType}`;
  if (SPECIES_CLASS_MOVES[speciesClassKey]) {
    moves.push(...SPECIES_CLASS_MOVES[speciesClassKey]);
  }
  
  const elementClassKey = `${element}_${classType}`;
  if (ELEMENT_CLASS_MOVES[elementClassKey]) {
    moves.push(...ELEMENT_CLASS_MOVES[elementClassKey]);
  }
  
  // Triple aspect move (if defined - unique signature move)
  const tripleKey = `${species}_${element}_${classType}`;
  if (TRIPLE_ASPECT_MOVES[tripleKey]) {
    moves.push(TRIPLE_ASPECT_MOVES[tripleKey]);
  }
  
  return moves;
}

// Get aspect display info
export function getAspectBadges(move: Move): { label: string; colorClass: string }[] {
  return move.aspects.map(aspect => {
    switch (aspect) {
      case 'species': return { label: 'Species', colorClass: 'bg-amber-500/20 text-amber-600' };
      case 'element': return { label: 'Element', colorClass: 'bg-cyan-500/20 text-cyan-600' };
      case 'class': return { label: 'Class', colorClass: 'bg-rose-500/20 text-rose-600' };
    }
  });
}

// Get move by ID
export function getMoveById(id: string): Move | undefined {
  const allMoves = [
    ...Object.values(SPECIES_MOVES).flat(),
    ...Object.values(ELEMENT_MOVES).flat(),
    ...Object.values(CLASS_MOVES).flat(),
    ...Object.values(SPECIES_ELEMENT_MOVES).flat(),
    ...Object.values(SPECIES_CLASS_MOVES).flat(),
    ...Object.values(ELEMENT_CLASS_MOVES).flat(),
    ...Object.values(TRIPLE_ASPECT_MOVES),
  ];
  return allMoves.find(m => m.id === id);
}
