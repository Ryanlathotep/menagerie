// Movesets System - Abilities based on 1-3 aspects (Species, Element, Class)
// Moves now have unlock levels for progression

import { SpeciesType, ElementType, ClassType } from './types';
import { applyMoveOverride, getCustomMovesFor, getCustomMoves } from './moveOverrides';



export type MoveType = 'melee' | 'ranged' | 'status' | 'heal' | 'movement';

// Aspect source types
export type AspectSource = 'species' | 'element' | 'class';

// Targeting patterns for ranged attacks
export type TargetingPattern = 
  | 'single'     // Straight line, hits first enemy only (most common)
  | 'piercing'   // Straight line, hits all enemies in line
  | 'cone'       // Cone shape originating from caster
  | 'aura'       // Circle around the caster
  | 'area'       // Target a specific area in line of sight
  | 'arc'        // Curved projectile that ignores walls (rare!)
  | 'self'       // Self-targeting only
  | 'custom';    // Designer-defined shape (see customShape)

/** Where a custom shape anchors. */
export type ShapeOriginType =
  | 'self'             // Centered on caster (melee burst)
  | 'target'           // Legacy alias for target_tile
  | 'target_tile'      // Any tile in range
  | 'target_enemy'     // Must target an enemy unit
  | 'target_ally'      // Must target an ally unit
  | 'target_resource'  // Must target a harvestable resource (tree/stone/plant)
  | 'target_trap'      // Must target a trap
  | 'target_terrain';  // Must target a terrain rune tile

/** Harvestable resource categories a shape can collect. */
export type HarvestableKind = 'tree' | 'stone' | 'plant' | 'trap' | 'terrain';

/** Designer-defined AoE shape. Offsets are relative cells (dx, dy from origin). */
export interface CustomShape {
  offsets: { dx: number; dy: number }[];
  /** Legacy: 'self' | 'target'. Kept for old overrides. Prefer originType. */
  origin: 'self' | 'target';
  /** New richer origin selector. Overrides `origin` when set. */
  originType?: ShapeOriginType;
  /** Max distance the target square may sit from the caster (target origins only). */
  range?: number;
  /** If true, shape ignores walls entirely. */
  wallPenetrate?: boolean;
  /** If true, walls inside the shape stop propagation beyond them. */
  blockedByWalls?: boolean;
  /** If true, units inside the shape stop propagation beyond them. */
  blockedByUnits?: boolean;
  // ----- Effect toggles (what the shape DOES to each cell it covers) -----
  /** Deal the move's power as damage to enemies in shape. Default true. */
  damagesEnemies?: boolean;
  /** Deal damage to allies in shape (friendly fire). Default false. */
  damagesAllies?: boolean;
  /** Damage traps in shape (destroy them). Default false. */
  damagesTraps?: boolean;
  /** Resource categories this move harvests inside shape. */
  harvestsResources?: HarvestableKind[];
  /** Terrain rune to place on empty/air tiles inside shape. */
  placesTerrain?: import('./terrain').TerrainType;
  /** If true, rotate the offsets 0/90/180/270° to match the cardinal direction the player aimed. */
  rotateToFacing?: boolean;
}

/** Designer-defined movement pattern. Each offset is a legal destination
 *  relative to the caster (chess-like jumps). Pick one when targeting. */
export interface MovementPattern {
  offsets: { dx: number; dy: number }[];
  /** If true, ignores walls / units between caster and destination (teleport). */
  blink?: boolean;
  /** If true, rotate the offsets to match the cardinal direction the player aimed. */
  rotateToFacing?: boolean;
  /** Max tile distance from caster the destination may sit (defaults to furthest offset). */
  range?: number;
  /** If true, walls along the path stop the movement before reaching the destination. */
  blockedByWalls?: boolean;
  /** If true, units along the path stop the movement before reaching the destination. */
  blockedByUnits?: boolean;
  // ----- Pass-through rules (override the default blockers when true) -----
  /** Movement can pass over / through enemy units. */
  passThroughEnemies?: boolean;
  /** Movement can pass over trap tiles without triggering them. */
  passThroughTraps?: boolean;
  /** Movement can pass over terrain rune tiles without triggering their effect. */
  passThroughTerrain?: boolean;
  /** Movement can ascend cliff tiles (otherwise blocked by elevation jumps). */
  canClimbCliffs?: boolean;
  /** Movement can cross water tiles (otherwise blocked). */
  canCrossWater?: boolean;
  // ----- Effects triggered along the path / on landing -----
  /** If true, traps and terrain runes the movement path overlaps still trigger. */
  triggersTrapsOnPath?: boolean;
  /** Resource categories the movement harvests as it travels (tree/stone/plant/trap/terrain). */
  harvestsResources?: HarvestableKind[];
}


export interface Move {
  id: string;
  name: string;
  description: string;
  type: MoveType;
  power: number;        // Base damage (0 for status/heal/movement)
  accuracy: number;     // 0-100 base accuracy
  staminaCost: number;  // Stamina consumed
  manaCost?: number;    // Mana / focus consumed (reserved for future mana system; used by the admin balancing tool)
  speedMod: number;     // Speed modifier: negative = slower, positive = faster (priority)
  aspects: AspectSource[];  // Which aspects power this move (1-3)
  element?: ElementType;    // Elemental type if applicable
  classBonus?: ClassType;   // Class that gives bonus if applicable
  effect?: string;      // Special effect
  unlockLevel?: number; // Level required to learn this move (default: 1)
  /** Admin balancing tool: designer-specified power-rating budget for this move. Compared against ratingFor() in the editor. */
  targetRating?: number;

  // Targeting properties for ranged/AoE moves
  targeting?: TargetingPattern;  // How the attack targets (default: 'single' for ranged)
  aoeRadius?: number;            // For area/aura patterns - radius of effect
  piercing?: boolean;            // Hits all enemies in line (for 'single' pattern)
  wallPenetrate?: boolean;       // Can pass through walls (very rare - arc, psychic, ghost moves)
  /** Admin-designable shape; when set, overrides `targeting` for AoE resolution. */
  customShape?: CustomShape;
  /** Admin-designable movement pattern; when set, move is treated as a relocation. */
  movement?: MovementPattern;
  /** Admin override: explicit availability lists. When present these win over
   *  the built-in SPECIES_/ELEMENT_/CLASS_MOVES pool the move appears in. Used
   *  for custom moves and for re-targeting an existing move to a new pool. */
  availableSpecies?: SpeciesType[];
  availableElements?: ElementType[];
  availableClasses?: ClassType[];
  /** How the three availability lists combine.
   *  'all' (default) = monster must match every populated list (AND / prerequisite).
   *  'any'           = monster qualifies if it matches at least one populated list (OR). */
  availabilityMode?: 'all' | 'any';
  /** Marks moves created entirely by the admin (not present in source code). */
  custom?: boolean;
  /** Particle effect id (see src/game/particles). Falls through to element /
   *  class / species defaults when undefined. Admin can override per move via
   *  data_type='particle_default' with data_key='move:<id>'. */
  particleEffectId?: string;
  /** If true, the move uses the CASTER's element for matchup calc instead of (or in addition to) `element`. */
  inheritMonsterElement?: boolean;
  /** If true, the move uses the CASTER's class for matchup calc instead of (or in addition to) `classBonus`. */
  inheritMonsterClass?: boolean;
  /** If true, the move's AoE triggers traps it overlaps and applies rune backlash to non-favored units it covers. */
  triggersTrapsOnAoe?: boolean;
  /** For combo moves that define BOTH `movement` and an attack (`customShape` / `power`),
   *  controls whether the relocation happens before or after the attack resolves.
   *  Default: 'move_then_attack'. */
  comboOrder?: 'move_then_attack' | 'attack_then_move';
  /** Per-tier overrides: stat tweaks and per-tier custom shapes that replace
   *  the auto-scaled tier multipliers when present. Tier keys are
   *  'lesser' | 'minor' | 'base' | 'greater' | 'omega'. */
  tierOverrides?: Record<string, {
    power?: number;
    accuracy?: number;
    staminaCost?: number;
    manaCost?: number;

    speedMod?: number;
    customShape?: CustomShape;
    /** Per-tier movement pattern (overrides base move's `movement` for that tier). */
    movement?: MovementPattern;
  }>;
}


// ============= SPECIES-ONLY MOVES (1 aspect) =============
export const SPECIES_MOVES: Record<SpeciesType, Move[]> = {
  slime: [
    { id: 'slime_slam', name: 'Slime Slam', description: 'A goopy body slam', type: 'melee', power: 25, accuracy: 95, staminaCost: 5, speedMod: 0, aspects: ['species'], unlockLevel: 1 },
    { id: 'absorb', name: 'Absorb', description: 'Absorb HP from enemy', type: 'melee', power: 15, accuracy: 100, staminaCost: 8, speedMod: -1, aspects: ['species'], effect: 'heal_self', unlockLevel: 1 },
    { id: 'slime_shield', name: 'Slime Shield', description: 'Coat yourself in protective goo', type: 'status', power: 0, accuracy: 100, staminaCost: 6, speedMod: 0, aspects: ['species'], effect: 'raise_defense', unlockLevel: 4 },
    { id: 'goo_cannon', name: 'Goo Cannon', description: 'Launch a blob of slime in a straight line', type: 'ranged', power: 35, accuracy: 85, staminaCost: 9, speedMod: 0, aspects: ['species'], effect: 'lower_speed', unlockLevel: 7, targeting: 'single' },
    { id: 'mega_absorb', name: 'Mega Absorb', description: 'Drain massive HP from enemy', type: 'melee', power: 30, accuracy: 95, staminaCost: 14, speedMod: -1, aspects: ['species'], effect: 'heal_self', unlockLevel: 12 },
  ],
  skeleton: [
    { id: 'bone_throw', name: 'Bone Throw', description: 'Hurl a sharp bone in a straight line', type: 'ranged', power: 30, accuracy: 85, staminaCost: 6, speedMod: 0, aspects: ['species'], unlockLevel: 1, targeting: 'single' },
    { id: 'rattle', name: 'Rattle', description: 'Scary bone rattling', type: 'status', power: 0, accuracy: 90, staminaCost: 4, speedMod: 1, aspects: ['species'], effect: 'lower_defense', unlockLevel: 1 },
    { id: 'bone_club', name: 'Bone Club', description: 'Swing a femur like a club', type: 'melee', power: 38, accuracy: 90, staminaCost: 8, speedMod: 0, aspects: ['species'], unlockLevel: 5 },
    { id: 'skull_bash', name: 'Skull Bash', description: 'Headbutt with hollow skull', type: 'melee', power: 45, accuracy: 80, staminaCost: 10, speedMod: -1, aspects: ['species'], unlockLevel: 9 },
    { id: 'bone_storm', name: 'Bone Storm', description: 'Summon a vortex of bones around you (aura)', type: 'ranged', power: 55, accuracy: 75, staminaCost: 15, speedMod: -1, aspects: ['species'], unlockLevel: 14, targeting: 'aura', aoeRadius: 2 },
  ],
  goblin: [
    { id: 'sneaky_stab', name: 'Sneaky Stab', description: 'A cunning strike', type: 'melee', power: 35, accuracy: 80, staminaCost: 7, speedMod: 1, aspects: ['species'], effect: 'crit_chance', unlockLevel: 1 },
    { id: 'taunt', name: 'Taunt', description: 'Mock the enemy', type: 'status', power: 0, accuracy: 100, staminaCost: 3, speedMod: 2, aspects: ['species'], effect: 'lower_attack', unlockLevel: 1 },
    { id: 'dirty_trick', name: 'Dirty Trick', description: 'Throw dirt in their eyes', type: 'status', power: 0, accuracy: 85, staminaCost: 5, speedMod: 2, aspects: ['species'], effect: 'lower_accuracy', unlockLevel: 4 },
    { id: 'backstab', name: 'Backstab', description: 'Critical strike from behind', type: 'melee', power: 50, accuracy: 75, staminaCost: 12, speedMod: 1, aspects: ['species'], effect: 'crit_chance', unlockLevel: 8 },
    { id: 'ambush', name: 'Ambush', description: 'A devastating surprise attack', type: 'melee', power: 65, accuracy: 70, staminaCost: 16, speedMod: 2, aspects: ['species'], effect: 'crit_chance', unlockLevel: 13 },
  ],
  mushroom: [
    { id: 'spore_burst', name: 'Spore Burst', description: 'Release a cloud of toxic spores around you', type: 'ranged', power: 20, accuracy: 90, staminaCost: 6, speedMod: -1, aspects: ['species'], effect: 'poison', unlockLevel: 1, targeting: 'aura', aoeRadius: 2 },
    { id: 'regenerate', name: 'Regenerate', description: 'Heal over time', type: 'heal', power: 25, accuracy: 100, staminaCost: 10, speedMod: 0, aspects: ['species'], unlockLevel: 1 },
    { id: 'fungal_growth', name: 'Fungal Growth', description: 'Boost defense naturally', type: 'status', power: 0, accuracy: 100, staminaCost: 6, speedMod: 0, aspects: ['species'], effect: 'raise_defense', unlockLevel: 3 },
    { id: 'mycelium_net', name: 'Mycelium Net', description: 'Trap enemy in fungal web', type: 'status', power: 0, accuracy: 80, staminaCost: 8, speedMod: -1, aspects: ['species'], effect: 'lower_speed', unlockLevel: 6 },
    { id: 'mega_spore', name: 'Mega Spore', description: 'Massive toxic cloud around you', type: 'ranged', power: 40, accuracy: 85, staminaCost: 12, speedMod: -2, aspects: ['species'], effect: 'poison', unlockLevel: 10, targeting: 'aura', aoeRadius: 3 },
    { id: 'full_bloom', name: 'Full Bloom', description: 'Powerful regeneration', type: 'heal', power: 50, accuracy: 100, staminaCost: 18, speedMod: -1, aspects: ['species'], unlockLevel: 15 },
  ],
  ghost: [
    { id: 'haunt', name: 'Haunt', description: 'Phase through walls to strike (ignores walls)', type: 'melee', power: 30, accuracy: 100, staminaCost: 8, speedMod: 0, aspects: ['species'], unlockLevel: 1, wallPenetrate: true },
    { id: 'terrify', name: 'Terrify', description: 'Cause fear', type: 'status', power: 0, accuracy: 85, staminaCost: 5, speedMod: 1, aspects: ['species'], effect: 'lower_speed', unlockLevel: 1 },
    { id: 'curse', name: 'Curse', description: 'Inflict a weakening curse', type: 'status', power: 0, accuracy: 80, staminaCost: 7, speedMod: 0, aspects: ['species'], effect: 'lower_attack', unlockLevel: 4 },
    { id: 'possession', name: 'Possession', description: 'Partially possess the enemy', type: 'melee', power: 45, accuracy: 90, staminaCost: 12, speedMod: 0, aspects: ['species'], effect: 'confuse', unlockLevel: 8 },
    { id: 'soul_drain', name: 'Soul Drain', description: 'Drain life force (ignores walls)', type: 'melee', power: 50, accuracy: 95, staminaCost: 15, speedMod: -1, aspects: ['species'], effect: 'heal_self', unlockLevel: 13, wallPenetrate: true },
  ],
  imp: [
    { id: 'mischief', name: 'Mischief', description: 'Tricky attack', type: 'melee', power: 25, accuracy: 90, staminaCost: 5, speedMod: 1, aspects: ['species'], unlockLevel: 1 },
    { id: 'steal_buff', name: 'Steal Buff', description: 'Take enemy buff', type: 'status', power: 0, accuracy: 75, staminaCost: 8, speedMod: 0, aspects: ['species'], effect: 'steal_buff', unlockLevel: 1 },
    { id: 'prank', name: 'Prank', description: 'Confuse the enemy', type: 'status', power: 0, accuracy: 85, staminaCost: 5, speedMod: 2, aspects: ['species'], effect: 'confuse', unlockLevel: 3 },
    { id: 'hell_poke', name: 'Hell Poke', description: 'A fiendish jab', type: 'melee', power: 40, accuracy: 95, staminaCost: 9, speedMod: 1, aspects: ['species'], unlockLevel: 7 },
    { id: 'chaos_strike', name: 'Chaos Strike', description: 'Unpredictable but powerful', type: 'melee', power: 55, accuracy: 80, staminaCost: 14, speedMod: 1, aspects: ['species'], effect: 'confuse', unlockLevel: 12 },
  ],
  golem: [
    { id: 'rock_smash', name: 'Rock Smash', description: 'Devastating punch', type: 'melee', power: 45, accuracy: 75, staminaCost: 10, speedMod: -2, aspects: ['species'], unlockLevel: 1 },
    { id: 'fortify', name: 'Fortify', description: 'Harden defenses', type: 'status', power: 0, accuracy: 100, staminaCost: 6, speedMod: 0, aspects: ['species'], effect: 'raise_defense', unlockLevel: 1 },
    { id: 'tremor', name: 'Tremor', description: 'Shake the ground', type: 'melee', power: 30, accuracy: 90, staminaCost: 7, speedMod: -1, aspects: ['species'], effect: 'lower_speed', unlockLevel: 4 },
    { id: 'boulder_throw', name: 'Boulder Throw', description: 'Hurl a massive rock in a straight line', type: 'ranged', power: 55, accuracy: 70, staminaCost: 13, speedMod: -2, aspects: ['species'], unlockLevel: 8, targeting: 'single' },
    { id: 'tectonic_slam', name: 'Tectonic Slam', description: 'Earth-shattering blow that quakes adjacent tiles', type: 'melee', power: 70, accuracy: 65, staminaCost: 18, speedMod: -3, aspects: ['species'], unlockLevel: 14, targeting: 'aura', aoeRadius: 1 },
    { id: 'shockwave', name: 'Shockwave', description: 'Pound the ground — hits all adjacent foes', type: 'melee', power: 32, accuracy: 90, staminaCost: 10, speedMod: -1, aspects: ['species'], unlockLevel: 6, targeting: 'aura', aoeRadius: 1 },
  ],
  wisp: [
    { id: 'light_beam', name: 'Light Beam', description: 'Piercing beam of light that hits all in a line', type: 'ranged', power: 30, accuracy: 95, staminaCost: 7, speedMod: 1, aspects: ['species'], unlockLevel: 1, targeting: 'piercing' },
    { id: 'illuminate', name: 'Illuminate', description: 'Boost team accuracy', type: 'status', power: 0, accuracy: 100, staminaCost: 5, speedMod: 0, aspects: ['species'], effect: 'raise_accuracy', unlockLevel: 1 },
    { id: 'healing_light', name: 'Healing Light', description: 'Soothing radiance', type: 'heal', power: 25, accuracy: 100, staminaCost: 8, speedMod: 0, aspects: ['species'], unlockLevel: 3 },
    { id: 'flash_blind', name: 'Flash Blind', description: 'Blinding flash of light', type: 'status', power: 0, accuracy: 90, staminaCost: 6, speedMod: 2, aspects: ['species'], effect: 'lower_accuracy', unlockLevel: 6 },
    { id: 'radiant_burst', name: 'Radiant Burst', description: 'Explosive light energy around you', type: 'ranged', power: 50, accuracy: 90, staminaCost: 14, speedMod: 1, aspects: ['species'], unlockLevel: 11, targeting: 'aura', aoeRadius: 2 },
  ],
  chimera: [
    { id: 'triple_strike', name: 'Triple Strike', description: 'Three-headed assault', type: 'melee', power: 35, accuracy: 85, staminaCost: 9, speedMod: 0, aspects: ['species'], unlockLevel: 1 },
    { id: 'adapt', name: 'Adapt', description: 'Copy enemy type', type: 'status', power: 0, accuracy: 100, staminaCost: 7, speedMod: 0, aspects: ['species'], effect: 'copy_type', unlockLevel: 1 },
    { id: 'lion_bite', name: 'Lion Bite', description: 'Savage lion head attack', type: 'melee', power: 45, accuracy: 90, staminaCost: 10, speedMod: 0, aspects: ['species'], unlockLevel: 5 },
    { id: 'snake_venom', name: 'Snake Venom', description: 'Venomous snake head strike', type: 'melee', power: 35, accuracy: 95, staminaCost: 9, speedMod: 1, aspects: ['species'], effect: 'poison', unlockLevel: 8 },
    { id: 'goat_ram', name: 'Goat Ram', description: 'Powerful goat head charge', type: 'melee', power: 55, accuracy: 80, staminaCost: 13, speedMod: -1, aspects: ['species'], unlockLevel: 11 },
    { id: 'chimeric_fury', name: 'Chimeric Fury', description: 'All three heads attack together — hits adjacent foes', type: 'melee', power: 70, accuracy: 75, staminaCost: 18, speedMod: 0, aspects: ['species'], unlockLevel: 15, targeting: 'aura', aoeRadius: 1 },
  ],
  dragon: [
    { id: 'claw_rend', name: 'Claw Rend', description: 'Savage claw attack', type: 'melee', power: 40, accuracy: 90, staminaCost: 8, speedMod: 0, aspects: ['species'], unlockLevel: 1 },
    { id: 'dragon_roar', name: 'Dragon Roar', description: 'Intimidating roar', type: 'status', power: 0, accuracy: 100, staminaCost: 6, speedMod: 1, aspects: ['species'], effect: 'lower_all_stats', unlockLevel: 1 },
    { id: 'tail_sweep', name: 'Tail Sweep', description: 'Sweeping tail attack — hits a melee cone', type: 'melee', power: 35, accuracy: 95, staminaCost: 7, speedMod: 0, aspects: ['species'], unlockLevel: 4, targeting: 'cone' },
    { id: 'wing_gust', name: 'Wing Gust', description: 'Cone of wind from wings', type: 'ranged', power: 40, accuracy: 90, staminaCost: 9, speedMod: 1, aspects: ['species'], effect: 'lower_speed', unlockLevel: 7, targeting: 'cone' },
    { id: 'dragon_fury', name: 'Dragon Fury', description: 'Unleash draconic rage', type: 'melee', power: 60, accuracy: 85, staminaCost: 14, speedMod: 0, aspects: ['species'], unlockLevel: 11 },
    { id: 'ancient_wrath', name: 'Ancient Wrath', description: 'Power of an ancient dragon', type: 'melee', power: 80, accuracy: 75, staminaCost: 20, speedMod: -1, aspects: ['species'], unlockLevel: 16 },
  ],
  rat: [
    { id: 'quick_bite', name: 'Quick Bite', description: 'Fast nibble attack', type: 'melee', power: 20, accuracy: 100, staminaCost: 4, speedMod: 2, aspects: ['species'], unlockLevel: 1 },
    { id: 'scavenge', name: 'Scavenge', description: 'Find an item', type: 'status', power: 0, accuracy: 80, staminaCost: 8, speedMod: 0, aspects: ['species'], effect: 'find_item', unlockLevel: 1 },
    { id: 'gnaw', name: 'Gnaw', description: 'Persistent gnawing', type: 'melee', power: 30, accuracy: 95, staminaCost: 6, speedMod: 1, aspects: ['species'], unlockLevel: 3 },
    { id: 'disease_bite', name: 'Disease Bite', description: 'Infectious bite', type: 'melee', power: 25, accuracy: 90, staminaCost: 7, speedMod: 1, aspects: ['species'], effect: 'poison', unlockLevel: 6 },
    { id: 'swarm_call', name: 'Swarm Call', description: 'Call rat allies to swarm adjacent foes', type: 'melee', power: 45, accuracy: 85, staminaCost: 12, speedMod: 0, aspects: ['species'], unlockLevel: 10, targeting: 'aura', aoeRadius: 1 },
  ],
  spider: [
    { id: 'venom_bite', name: 'Venom Bite', description: 'Poisonous fangs', type: 'melee', power: 25, accuracy: 90, staminaCost: 6, speedMod: 0, aspects: ['species'], effect: 'poison', unlockLevel: 1 },
    { id: 'web_trap', name: 'Web Trap', description: 'Slow the enemy', type: 'status', power: 0, accuracy: 85, staminaCost: 5, speedMod: 1, aspects: ['species'], effect: 'lower_speed', unlockLevel: 1 },
    { id: 'web_shot', name: 'Web Shot', description: 'Ranged web attack in a straight line', type: 'ranged', power: 20, accuracy: 95, staminaCost: 5, speedMod: 1, aspects: ['species'], effect: 'lower_speed', unlockLevel: 4, targeting: 'single' },
    { id: 'fang_strike', name: 'Fang Strike', description: 'Powerful fang attack', type: 'melee', power: 40, accuracy: 88, staminaCost: 9, speedMod: 0, aspects: ['species'], effect: 'poison', unlockLevel: 7 },
    { id: 'cocoon', name: 'Cocoon', description: 'Wrap in protective silk', type: 'status', power: 0, accuracy: 100, staminaCost: 8, speedMod: -1, aspects: ['species'], effect: 'raise_defense', unlockLevel: 10 },
    { id: 'spider_swarm', name: 'Spider Swarm', description: 'Summon tiny spiders that swarm around you', type: 'melee', power: 50, accuracy: 85, staminaCost: 14, speedMod: 0, aspects: ['species'], effect: 'poison', unlockLevel: 14, targeting: 'aura', aoeRadius: 1 },
  ],
  bat: [
    { id: 'sonic_screech', name: 'Sonic Screech', description: 'Disorienting cone of sound', type: 'ranged', power: 25, accuracy: 95, staminaCost: 6, speedMod: 1, aspects: ['species'], unlockLevel: 1, targeting: 'cone' },
    { id: 'life_drain', name: 'Life Drain', description: 'Vampiric bite', type: 'melee', power: 20, accuracy: 90, staminaCost: 8, speedMod: 0, aspects: ['species'], effect: 'heal_self', unlockLevel: 1 },
    { id: 'wing_slash', name: 'Wing Slash', description: 'Sharp wing attack', type: 'melee', power: 30, accuracy: 95, staminaCost: 6, speedMod: 1, aspects: ['species'], unlockLevel: 3 },
    { id: 'echolocation', name: 'Echo Pulse', description: 'Boost accuracy with sound', type: 'status', power: 0, accuracy: 100, staminaCost: 5, speedMod: 0, aspects: ['species'], effect: 'raise_accuracy', unlockLevel: 5 },
    { id: 'blood_feast', name: 'Blood Feast', description: 'Powerful vampiric attack', type: 'melee', power: 40, accuracy: 88, staminaCost: 12, speedMod: 0, aspects: ['species'], effect: 'heal_self', unlockLevel: 9 },
    { id: 'ultrasonic_blast', name: 'Ultrasonic Blast', description: 'Devastating cone of sound', type: 'ranged', power: 55, accuracy: 90, staminaCost: 15, speedMod: 1, aspects: ['species'], unlockLevel: 13, targeting: 'cone' },
  ],
  snake: [
    { id: 'constrict', name: 'Constrict', description: 'Crushing squeeze', type: 'melee', power: 30, accuracy: 85, staminaCost: 7, speedMod: -1, aspects: ['species'], unlockLevel: 1 },
    { id: 'toxic_fang', name: 'Toxic Fang', description: 'Venomous strike', type: 'melee', power: 25, accuracy: 90, staminaCost: 6, speedMod: 0, aspects: ['species'], effect: 'poison', unlockLevel: 1 },
    { id: 'coil', name: 'Coil', description: 'Defensive coiling', type: 'status', power: 0, accuracy: 100, staminaCost: 4, speedMod: 0, aspects: ['species'], effect: 'raise_defense', unlockLevel: 3 },
    { id: 'venom_spray', name: 'Venom Spray', description: 'Spray venom in a cone', type: 'ranged', power: 30, accuracy: 85, staminaCost: 8, speedMod: 0, aspects: ['species'], effect: 'poison', unlockLevel: 6, targeting: 'cone' },
    { id: 'crushing_coils', name: 'Crushing Coils', description: 'Powerful constriction — pierces through enemies in line', type: 'melee', power: 50, accuracy: 82, staminaCost: 12, speedMod: -1, aspects: ['species'], unlockLevel: 10, targeting: 'piercing' },
    { id: 'deadly_venom', name: 'Deadly Venom', description: 'Lethal poison attack', type: 'melee', power: 45, accuracy: 90, staminaCost: 14, speedMod: 0, aspects: ['species'], effect: 'poison', unlockLevel: 14 },
  ],
  wolf: [
    { id: 'pack_strike', name: 'Pack Strike', description: 'Coordinated attack', type: 'melee', power: 35, accuracy: 90, staminaCost: 7, speedMod: 0, aspects: ['species'], unlockLevel: 1 },
    { id: 'howl', name: 'Howl', description: 'Boost attack power', type: 'status', power: 0, accuracy: 100, staminaCost: 5, speedMod: 0, aspects: ['species'], effect: 'raise_attack', unlockLevel: 1 },
    { id: 'feral_bite', name: 'Feral Bite', description: 'Savage biting attack', type: 'melee', power: 40, accuracy: 92, staminaCost: 8, speedMod: 0, aspects: ['species'], unlockLevel: 4 },
    { id: 'chase_down', name: 'Chase Down', description: 'Swift pursuit attack', type: 'melee', power: 35, accuracy: 95, staminaCost: 7, speedMod: 2, aspects: ['species'], unlockLevel: 7 },
    { id: 'alpha_strike', name: 'Alpha Strike', description: 'Dominant attack', type: 'melee', power: 55, accuracy: 88, staminaCost: 13, speedMod: 0, aspects: ['species'], effect: 'lower_attack', unlockLevel: 11 },
    { id: 'pack_frenzy', name: 'Pack Frenzy', description: 'Coordinated assault on adjacent foes', type: 'melee', power: 70, accuracy: 80, staminaCost: 17, speedMod: 0, aspects: ['species'], unlockLevel: 15, targeting: 'aura', aoeRadius: 1 },
  ],
  beetle: [
    { id: 'horn_charge', name: 'Horn Charge', description: 'Powerful charge', type: 'melee', power: 35, accuracy: 85, staminaCost: 8, speedMod: -1, aspects: ['species'], unlockLevel: 1 },
    { id: 'shell_guard', name: 'Shell Guard', description: 'Defensive stance', type: 'status', power: 0, accuracy: 100, staminaCost: 4, speedMod: 0, aspects: ['species'], effect: 'raise_defense', unlockLevel: 1 },
    { id: 'mandible_crush', name: 'Mandible Crush', description: 'Crushing mandible attack', type: 'melee', power: 42, accuracy: 88, staminaCost: 9, speedMod: -1, aspects: ['species'], unlockLevel: 4 },
    { id: 'roll_out', name: 'Roll Out', description: 'Rolling ball attack — bowls through enemies in a line', type: 'melee', power: 40, accuracy: 90, staminaCost: 8, speedMod: 0, aspects: ['species'], unlockLevel: 7, targeting: 'piercing' },
    { id: 'iron_shell', name: 'Iron Shell', description: 'Maximum defense', type: 'status', power: 0, accuracy: 100, staminaCost: 10, speedMod: -2, aspects: ['species'], effect: 'raise_defense', unlockLevel: 10 },
    { id: 'horn_javelin', name: 'Horn Javelin', description: 'Devastating horn strike', type: 'melee', power: 65, accuracy: 78, staminaCost: 16, speedMod: -1, aspects: ['species'], unlockLevel: 14 },
  ],
  crow: [
    { id: 'peck_flurry', name: 'Peck Flurry', description: 'Rapid pecking', type: 'melee', power: 28, accuracy: 95, staminaCost: 6, speedMod: 1, aspects: ['species'], unlockLevel: 1 },
    { id: 'keen_sight', name: 'Keen Sight', description: 'Reveal enemy stats', type: 'status', power: 0, accuracy: 100, staminaCost: 3, speedMod: 2, aspects: ['species'], effect: 'reveal_stats', unlockLevel: 1 },
    { id: 'steal_item', name: 'Steal Item', description: 'Snatch an item', type: 'status', power: 0, accuracy: 70, staminaCost: 8, speedMod: 1, aspects: ['species'], effect: 'steal_item', unlockLevel: 4 },
    { id: 'dive_bomb', name: 'Dive Bomb', description: 'Aerial dive attack', type: 'melee', power: 45, accuracy: 88, staminaCost: 10, speedMod: 1, aspects: ['species'], unlockLevel: 7 },
    { id: 'murder_call', name: 'Murder Call', description: 'Summon shadowy crows (arc - ignores walls)', type: 'ranged', power: 40, accuracy: 92, staminaCost: 11, speedMod: 0, aspects: ['species'], unlockLevel: 10, targeting: 'arc', wallPenetrate: true },
    { id: 'shadow_wing', name: 'Shadow Wing', description: 'Dark aerial assault', type: 'melee', power: 55, accuracy: 90, staminaCost: 14, speedMod: 1, aspects: ['species'], unlockLevel: 13 },
  ],
  shark: [
    { id: 'bite_frenzy', name: 'Bite Frenzy', description: 'Savage biting', type: 'melee', power: 45, accuracy: 80, staminaCost: 10, speedMod: 0, aspects: ['species'], effect: 'bonus_vs_wounded', unlockLevel: 1 },
    { id: 'blood_sense', name: 'Blood Sense', description: 'Track wounded prey', type: 'status', power: 0, accuracy: 100, staminaCost: 4, speedMod: 1, aspects: ['species'], effect: 'crit_vs_wounded', unlockLevel: 1 },
    { id: 'thrash', name: 'Thrash', description: 'Violent thrashing', type: 'melee', power: 40, accuracy: 88, staminaCost: 9, speedMod: 0, aspects: ['species'], unlockLevel: 4 },
    { id: 'ram', name: 'Ram', description: 'Body slam attack', type: 'melee', power: 50, accuracy: 85, staminaCost: 11, speedMod: 0, aspects: ['species'], unlockLevel: 7 },
    { id: 'feeding_frenzy', name: 'Feeding Frenzy', description: 'Berserker attack', type: 'melee', power: 60, accuracy: 78, staminaCost: 14, speedMod: 0, aspects: ['species'], effect: 'bonus_vs_wounded', unlockLevel: 11 },
    { id: 'apex_predator', name: 'Apex Predator', description: 'Ultimate predator strike', type: 'melee', power: 75, accuracy: 72, staminaCost: 18, speedMod: 0, aspects: ['species'], effect: 'bonus_vs_wounded', unlockLevel: 15 },
  ],
  frog: [
    { id: 'tongue_lash', name: 'Tongue Lash', description: 'Stretchy tongue attack (straight line)', type: 'ranged', power: 25, accuracy: 95, staminaCost: 5, speedMod: 1, aspects: ['species'], unlockLevel: 1, targeting: 'single' },
    { id: 'croak', name: 'Croak', description: 'Confusing sound aura', type: 'status', power: 0, accuracy: 80, staminaCost: 5, speedMod: 0, aspects: ['species'], effect: 'confuse', unlockLevel: 1 },
    { id: 'hop_kick', name: 'Hop Kick', description: 'Leaping kick attack', type: 'melee', power: 32, accuracy: 92, staminaCost: 6, speedMod: 1, aspects: ['species'], unlockLevel: 3 },
    { id: 'sticky_tongue', name: 'Sticky Tongue', description: 'Grab and pull enemy (straight line)', type: 'ranged', power: 30, accuracy: 90, staminaCost: 7, speedMod: 0, aspects: ['species'], effect: 'lower_speed', unlockLevel: 6, targeting: 'single' },
    { id: 'poison_skin', name: 'Poison Skin', description: 'Secrete toxins around you', type: 'status', power: 0, accuracy: 100, staminaCost: 8, speedMod: 0, aspects: ['species'], effect: 'poison', unlockLevel: 9 },
    { id: 'frog_bomb', name: 'Frog Bomb', description: 'Explosive leap attack', type: 'melee', power: 55, accuracy: 85, staminaCost: 14, speedMod: 1, aspects: ['species'], unlockLevel: 13 },
  ],
  jellyfish: [
    { id: 'sting_tentacle', name: 'Sting Tentacle', description: 'Stinging attack', type: 'melee', power: 20, accuracy: 90, staminaCost: 5, speedMod: 0, aspects: ['species'], effect: 'paralyze', unlockLevel: 1 },
    { id: 'drift', name: 'Drift', description: 'Evasive movement', type: 'status', power: 0, accuracy: 100, staminaCost: 4, speedMod: 0, aspects: ['species'], effect: 'raise_dodge', unlockLevel: 1 },
    { id: 'tentacle_wrap', name: 'Tentacle Wrap', description: 'Constricting tentacles', type: 'melee', power: 30, accuracy: 88, staminaCost: 7, speedMod: -1, aspects: ['species'], effect: 'paralyze', unlockLevel: 4 },
    { id: 'bioluminescence', name: 'Bioluminescence', description: 'Confusing light display', type: 'status', power: 0, accuracy: 85, staminaCost: 6, speedMod: 0, aspects: ['species'], effect: 'confuse', unlockLevel: 6 },
    { id: 'venom_cloud', name: 'Venom Cloud', description: 'Toxic cloud around you', type: 'ranged', power: 35, accuracy: 85, staminaCost: 10, speedMod: -1, aspects: ['species'], effect: 'poison', unlockLevel: 9, targeting: 'aura', aoeRadius: 2 },
    { id: 'tentacle_storm', name: 'Tentacle Storm', description: 'Flurry of stinging attacks', type: 'melee', power: 50, accuracy: 82, staminaCost: 14, speedMod: -1, aspects: ['species'], effect: 'paralyze', unlockLevel: 13 },
  ],
};

// ============= ELEMENT-ONLY MOVES (1 aspect) =============
export const ELEMENT_MOVES: Record<ElementType, Move[]> = {
  normal: [
    { id: 'tackle', name: 'Tackle', description: 'Basic physical attack', type: 'melee', power: 25, accuracy: 95, staminaCost: 4, speedMod: 0, aspects: ['element'], element: 'normal', unlockLevel: 1 },
    { id: 'focus', name: 'Focus', description: 'Concentrate energy', type: 'status', power: 0, accuracy: 100, staminaCost: 5, speedMod: 0, aspects: ['element'], element: 'normal', effect: 'raise_accuracy', unlockLevel: 1 },
    { id: 'slam', name: 'Slam', description: 'Powerful body slam', type: 'melee', power: 40, accuracy: 88, staminaCost: 8, speedMod: 0, aspects: ['element'], element: 'normal', unlockLevel: 5 },
    { id: 'double_strike', name: 'Double Strike', description: 'Two quick attacks', type: 'melee', power: 35, accuracy: 92, staminaCost: 7, speedMod: 1, aspects: ['element'], element: 'normal', unlockLevel: 8 },
    { id: 'full_power', name: 'Full Power', description: 'Maximum effort attack', type: 'melee', power: 60, accuracy: 80, staminaCost: 14, speedMod: -1, aspects: ['element'], element: 'normal', unlockLevel: 12 },
  ],
  fire: [
    { id: 'fireball', name: 'Fireball', description: 'Launch a blazing orb (straight line)', type: 'ranged', power: 35, accuracy: 90, staminaCost: 8, speedMod: 0, aspects: ['element'], element: 'fire', unlockLevel: 1, targeting: 'single' },
    { id: 'flame_burst', name: 'Flame Burst', description: 'Explosive fire at target area', type: 'ranged', power: 25, accuracy: 95, staminaCost: 6, speedMod: 1, aspects: ['element'], element: 'fire', effect: 'burn', unlockLevel: 1, targeting: 'area', aoeRadius: 1 },
    { id: 'heat_wave', name: 'Heat Wave', description: 'Searing cone of heat', type: 'ranged', power: 40, accuracy: 88, staminaCost: 10, speedMod: 0, aspects: ['element'], element: 'fire', effect: 'burn', unlockLevel: 5, targeting: 'cone' },
    { id: 'fire_spin', name: 'Fire Spin', description: 'Spiraling flames around you', type: 'ranged', power: 45, accuracy: 85, staminaCost: 11, speedMod: 0, aspects: ['element'], element: 'fire', unlockLevel: 8, targeting: 'aura', aoeRadius: 2 },
    { id: 'inferno', name: 'Inferno', description: 'Massive fire eruption at target', type: 'ranged', power: 65, accuracy: 78, staminaCost: 16, speedMod: -1, aspects: ['element'], element: 'fire', effect: 'burn', unlockLevel: 12, targeting: 'area', aoeRadius: 2 },
    { id: 'solar_flare', name: 'Solar Flare', description: 'Blinding fire cone', type: 'ranged', power: 75, accuracy: 72, staminaCost: 20, speedMod: 0, aspects: ['element'], element: 'fire', effect: 'burn', unlockLevel: 16, targeting: 'cone' },
  ],
  water: [
    { id: 'aqua_jet', name: 'Aqua Jet', description: 'High-pressure piercing water beam', type: 'ranged', power: 30, accuracy: 95, staminaCost: 7, speedMod: 1, aspects: ['element'], element: 'water', unlockLevel: 1, targeting: 'piercing' },
    { id: 'tidal_wave', name: 'Tidal Wave', description: 'Crushing wave in a cone', type: 'ranged', power: 40, accuracy: 80, staminaCost: 10, speedMod: -1, aspects: ['element'], element: 'water', unlockLevel: 1, targeting: 'cone' },
    { id: 'bubble_beam', name: 'Bubble Beam', description: 'Stream of bubbles (straight line)', type: 'ranged', power: 35, accuracy: 92, staminaCost: 8, speedMod: 0, aspects: ['element'], element: 'water', unlockLevel: 4, targeting: 'single' },
    { id: 'whirlpool', name: 'Whirlpool', description: 'Trapping vortex at target area', type: 'ranged', power: 45, accuracy: 85, staminaCost: 11, speedMod: -1, aspects: ['element'], element: 'water', effect: 'lower_speed', unlockLevel: 7, targeting: 'area', aoeRadius: 1 },
    { id: 'hydro_pump', name: 'Hydro Pump', description: 'Devastating piercing water blast', type: 'ranged', power: 65, accuracy: 75, staminaCost: 16, speedMod: 0, aspects: ['element'], element: 'water', unlockLevel: 11, targeting: 'piercing' },
    { id: 'tsunami', name: 'Tsunami', description: 'Massive wave in wide cone', type: 'ranged', power: 80, accuracy: 68, staminaCost: 22, speedMod: -2, aspects: ['element'], element: 'water', unlockLevel: 15, targeting: 'cone' },
  ],
  earth: [
    { id: 'rock_throw', name: 'Rock Throw', description: 'Hurl boulders (straight line)', type: 'ranged', power: 35, accuracy: 85, staminaCost: 7, speedMod: 0, aspects: ['element'], element: 'earth', unlockLevel: 1, targeting: 'single' },
    { id: 'earthquake', name: 'Earthquake', description: 'Ground-shaking aura attack', type: 'melee', power: 40, accuracy: 75, staminaCost: 12, speedMod: -2, aspects: ['element'], element: 'earth', unlockLevel: 1, targeting: 'aura', aoeRadius: 2 },
    { id: 'mud_slap', name: 'Mud Slap', description: 'Blinding mud attack (straight line)', type: 'ranged', power: 25, accuracy: 95, staminaCost: 5, speedMod: 0, aspects: ['element'], element: 'earth', effect: 'lower_accuracy', unlockLevel: 3, targeting: 'single' },
    { id: 'stone_edge', name: 'Stone Edge', description: 'Sharp stone attack', type: 'melee', power: 50, accuracy: 80, staminaCost: 12, speedMod: 0, aspects: ['element'], element: 'earth', unlockLevel: 7 },
    { id: 'landslide', name: 'Landslide', description: 'Avalanche of rocks in cone', type: 'ranged', power: 60, accuracy: 75, staminaCost: 15, speedMod: -1, aspects: ['element'], element: 'earth', unlockLevel: 11, targeting: 'cone' },
    { id: 'tectonic_fury', name: 'Tectonic Fury', description: 'Earth-shattering aura', type: 'melee', power: 85, accuracy: 65, staminaCost: 22, speedMod: -3, aspects: ['element'], element: 'earth', unlockLevel: 15, targeting: 'aura', aoeRadius: 3 },
  ],
  air: [
    { id: 'wind_slash', name: 'Wind Slash', description: 'Cutting air blade (straight line)', type: 'ranged', power: 30, accuracy: 95, staminaCost: 6, speedMod: 2, aspects: ['element'], element: 'air', unlockLevel: 1, targeting: 'single' },
    { id: 'cyclone', name: 'Cyclone', description: 'Spinning vortex at target area', type: 'ranged', power: 35, accuracy: 85, staminaCost: 9, speedMod: 0, aspects: ['element'], element: 'air', effect: 'confuse', unlockLevel: 1, targeting: 'area', aoeRadius: 1 },
    { id: 'gust', name: 'Gust', description: 'Powerful wind blast (straight line)', type: 'ranged', power: 28, accuracy: 100, staminaCost: 5, speedMod: 2, aspects: ['element'], element: 'air', unlockLevel: 3, targeting: 'single' },
    { id: 'air_cutter', name: 'Air Cutter', description: 'Sharp piercing wind blades', type: 'ranged', power: 45, accuracy: 92, staminaCost: 10, speedMod: 1, aspects: ['element'], element: 'air', unlockLevel: 6, targeting: 'piercing' },
    { id: 'tornado', name: 'Tornado', description: 'Massive wind funnel at area', type: 'ranged', power: 55, accuracy: 80, staminaCost: 14, speedMod: 0, aspects: ['element'], element: 'air', effect: 'confuse', unlockLevel: 10, targeting: 'area', aoeRadius: 2 },
    { id: 'hurricane', name: 'Hurricane', description: 'Devastating storm cone', type: 'ranged', power: 70, accuracy: 72, staminaCost: 18, speedMod: -1, aspects: ['element'], element: 'air', effect: 'confuse', unlockLevel: 14, targeting: 'cone' },
  ],
  void: [
    { id: 'shadow_bolt', name: 'Shadow Bolt', description: 'Dark energy arc (ignores walls)', type: 'ranged', power: 35, accuracy: 90, staminaCost: 8, speedMod: 0, aspects: ['element'], element: 'void', unlockLevel: 1, targeting: 'arc', wallPenetrate: true },
    { id: 'null_zone', name: 'Null Zone', description: 'Drain enemy stamina', type: 'status', power: 0, accuracy: 85, staminaCost: 10, speedMod: -1, aspects: ['element'], element: 'void', effect: 'drain_stamina', unlockLevel: 1 },
    { id: 'dark_pulse', name: 'Dark Pulse', description: 'Wave of darkness around you', type: 'ranged', power: 40, accuracy: 88, staminaCost: 9, speedMod: 0, aspects: ['element'], element: 'void', unlockLevel: 4, targeting: 'aura', aoeRadius: 2 },
    { id: 'void_touch', name: 'Void Touch', description: 'Draining contact (ignores walls)', type: 'melee', power: 35, accuracy: 95, staminaCost: 8, speedMod: 0, aspects: ['element'], element: 'void', effect: 'drain_stamina', unlockLevel: 7, wallPenetrate: true },
    { id: 'shadow_storm', name: 'Shadow Storm', description: 'Storm of darkness at target area', type: 'ranged', power: 55, accuracy: 82, staminaCost: 14, speedMod: 0, aspects: ['element'], element: 'void', unlockLevel: 10, targeting: 'area', aoeRadius: 2 },
    { id: 'void_collapse', name: 'Void Collapse', description: 'Collapse reality - ignores all walls', type: 'ranged', power: 75, accuracy: 70, staminaCost: 20, speedMod: -1, aspects: ['element'], element: 'void', effect: 'drain_stamina', unlockLevel: 14, targeting: 'area', aoeRadius: 3, wallPenetrate: true },
  ],
};

// ============= CLASS-ONLY MOVES (1 aspect) =============
export const CLASS_MOVES: Record<ClassType, Move[]> = {
  normal: [
    { id: 'basic_attack', name: 'Basic Attack', description: 'Simple attack', type: 'melee', power: 25, accuracy: 100, staminaCost: 3, speedMod: 0, aspects: ['class'], classBonus: 'normal', unlockLevel: 1 },
    { id: 'rest', name: 'Rest', description: 'Recover stamina', type: 'status', power: 0, accuracy: 100, staminaCost: 0, speedMod: -2, aspects: ['class'], classBonus: 'normal', effect: 'restore_stamina', unlockLevel: 1 },
    { id: 'balanced_strike', name: 'Balanced Strike', description: 'Well-rounded attack', type: 'melee', power: 35, accuracy: 95, staminaCost: 6, speedMod: 0, aspects: ['class'], classBonus: 'normal', unlockLevel: 5 },
    { id: 'adaptability', name: 'Adaptability', description: 'Boost all stats slightly', type: 'status', power: 0, accuracy: 100, staminaCost: 10, speedMod: 0, aspects: ['class'], classBonus: 'normal', effect: 'raise_all_stats', unlockLevel: 10 },
  ],
  kinetic: [
    { id: 'power_strike', name: 'Power Strike', description: 'Raw physical force', type: 'melee', power: 40, accuracy: 90, staminaCost: 8, speedMod: 0, aspects: ['class'], classBonus: 'kinetic', unlockLevel: 1 },
    { id: 'momentum', name: 'Momentum', description: 'Build up power', type: 'status', power: 0, accuracy: 100, staminaCost: 5, speedMod: 0, aspects: ['class'], classBonus: 'kinetic', effect: 'charge_next', unlockLevel: 1 },
    { id: 'second_wind', name: 'Second Wind', description: 'Recover 25 stamina', type: 'status', power: 0, accuracy: 100, staminaCost: 0, speedMod: -1, aspects: ['class'], classBonus: 'kinetic', effect: 'restore_stamina_25', unlockLevel: 1 },
    { id: 'heavy_blow', name: 'Heavy Blow', description: 'Powerful but slow', type: 'melee', power: 55, accuracy: 82, staminaCost: 12, speedMod: -1, aspects: ['class'], classBonus: 'kinetic', unlockLevel: 5 },
    { id: 'full_force', name: 'Full Force', description: 'Maximum physical power', type: 'melee', power: 70, accuracy: 75, staminaCost: 16, speedMod: -2, aspects: ['class'], classBonus: 'kinetic', unlockLevel: 9 },
    { id: 'meteor_strike', name: 'Meteor Strike', description: 'Devastating physical attack', type: 'melee', power: 85, accuracy: 68, staminaCost: 20, speedMod: -2, aspects: ['class'], classBonus: 'kinetic', unlockLevel: 14 },
  ],
  energy: [
    { id: 'energy_blast', name: 'Energy Blast', description: 'Pure energy attack', type: 'ranged', power: 35, accuracy: 95, staminaCost: 7, speedMod: 1, aspects: ['class'], classBonus: 'energy', unlockLevel: 1 },
    { id: 'overcharge', name: 'Overcharge', description: 'Boost special power', type: 'status', power: 0, accuracy: 100, staminaCost: 6, speedMod: 0, aspects: ['class'], classBonus: 'energy', effect: 'raise_special', unlockLevel: 1 },
    { id: 'energy_siphon', name: 'Energy Siphon', description: 'Drain stamina from enemy', type: 'status', power: 0, accuracy: 85, staminaCost: 0, speedMod: 0, aspects: ['class'], classBonus: 'energy', effect: 'drain_enemy_stamina', unlockLevel: 1 },
    { id: 'power_surge', name: 'Power Surge', description: 'Surge of energy', type: 'ranged', power: 45, accuracy: 92, staminaCost: 10, speedMod: 1, aspects: ['class'], classBonus: 'energy', unlockLevel: 5 },
    { id: 'plasma_bolt', name: 'Plasma Bolt', description: 'Superheated energy', type: 'ranged', power: 60, accuracy: 85, staminaCost: 14, speedMod: 1, aspects: ['class'], classBonus: 'energy', unlockLevel: 9 },
    { id: 'nova_burst', name: 'Nova Burst', description: 'Explosive energy release', type: 'ranged', power: 75, accuracy: 78, staminaCost: 18, speedMod: 0, aspects: ['class'], classBonus: 'energy', unlockLevel: 13 },
  ],
  biological: [
    { id: 'bio_strike', name: 'Bio Strike', description: 'Nature-infused attack', type: 'melee', power: 30, accuracy: 90, staminaCost: 6, speedMod: 0, aspects: ['class'], classBonus: 'biological', unlockLevel: 1 },
    { id: 'regeneration', name: 'Regeneration', description: 'Heal 30 HP', type: 'heal', power: 30, accuracy: 100, staminaCost: 10, speedMod: -1, aspects: ['class'], classBonus: 'biological', unlockLevel: 1 },
    { id: 'photosynthesis', name: 'Photosynthesis', description: 'Recover 20 stamina', type: 'status', power: 0, accuracy: 100, staminaCost: 0, speedMod: -2, aspects: ['class'], classBonus: 'biological', effect: 'restore_stamina_20', unlockLevel: 1 },
    { id: 'growth', name: 'Growth', description: 'Boost attack and special', type: 'status', power: 0, accuracy: 100, staminaCost: 8, speedMod: 0, aspects: ['class'], classBonus: 'biological', effect: 'raise_attack', unlockLevel: 4 },
    { id: 'nature_wrath', name: "Nature's Wrath", description: 'Powerful natural attack', type: 'melee', power: 50, accuracy: 88, staminaCost: 12, speedMod: 0, aspects: ['class'], classBonus: 'biological', unlockLevel: 8 },
    { id: 'full_restore', name: 'Full Restore', description: 'Heal 60 HP', type: 'heal', power: 60, accuracy: 100, staminaCost: 18, speedMod: -2, aspects: ['class'], classBonus: 'biological', unlockLevel: 12 },
  ],
  chemical: [
    { id: 'acid_spray', name: 'Acid Spray', description: 'Corrosive attack', type: 'ranged', power: 30, accuracy: 90, staminaCost: 7, speedMod: 0, aspects: ['class'], classBonus: 'chemical', effect: 'lower_defense', unlockLevel: 1 },
    { id: 'catalyst', name: 'Catalyst', description: 'Boost next attack', type: 'status', power: 0, accuracy: 100, staminaCost: 5, speedMod: 0, aspects: ['class'], classBonus: 'chemical', effect: 'double_next', unlockLevel: 1 },
    { id: 'adrenaline', name: 'Adrenaline', description: 'Recover 15 stamina', type: 'status', power: 0, accuracy: 100, staminaCost: 0, speedMod: 1, aspects: ['class'], classBonus: 'chemical', effect: 'restore_stamina_15', unlockLevel: 1 },
    { id: 'corrosive_bomb', name: 'Corrosive Bomb', description: 'Explosive acid', type: 'ranged', power: 45, accuracy: 85, staminaCost: 11, speedMod: 0, aspects: ['class'], classBonus: 'chemical', effect: 'lower_defense', unlockLevel: 5 },
    { id: 'toxic_injection', name: 'Toxic Injection', description: 'Inject deadly toxins', type: 'melee', power: 40, accuracy: 92, staminaCost: 10, speedMod: 0, aspects: ['class'], classBonus: 'chemical', effect: 'poison', unlockLevel: 8 },
    { id: 'chemical_warfare', name: 'Chemical Warfare', description: 'Devastating chemical attack', type: 'ranged', power: 65, accuracy: 78, staminaCost: 17, speedMod: -1, aspects: ['class'], classBonus: 'chemical', effect: 'poison', unlockLevel: 13 },
  ],
  political: [
    { id: 'decree', name: 'Decree', description: 'Commanding strike', type: 'ranged', power: 25, accuracy: 100, staminaCost: 6, speedMod: 1, aspects: ['class'], classBonus: 'political', unlockLevel: 1 },
    { id: 'inspire', name: 'Inspire', description: 'Boost all stats', type: 'status', power: 0, accuracy: 100, staminaCost: 12, speedMod: 0, aspects: ['class'], classBonus: 'political', effect: 'raise_all_stats', unlockLevel: 1 },
    { id: 'rally', name: 'Rally', description: 'Recover 30 stamina', type: 'status', power: 0, accuracy: 100, staminaCost: 0, speedMod: -1, aspects: ['class'], classBonus: 'political', effect: 'restore_stamina_30', unlockLevel: 1 },
    { id: 'diplomacy', name: 'Diplomacy', description: 'Lower enemy attack', type: 'status', power: 0, accuracy: 90, staminaCost: 6, speedMod: 1, aspects: ['class'], classBonus: 'political', effect: 'lower_attack', unlockLevel: 4 },
    { id: 'royal_command', name: 'Royal Command', description: 'Authoritative attack', type: 'ranged', power: 45, accuracy: 95, staminaCost: 11, speedMod: 1, aspects: ['class'], classBonus: 'political', unlockLevel: 8 },
    { id: 'absolute_authority', name: 'Absolute Authority', description: 'Overwhelming command', type: 'ranged', power: 60, accuracy: 92, staminaCost: 15, speedMod: 0, aspects: ['class'], classBonus: 'political', effect: 'lower_all_stats', unlockLevel: 12 },
  ],
};

// Free basic attack for when out of stamina
export const STRUGGLE_MOVE: Move = {
  id: 'struggle',
  name: 'Struggle',
  description: 'A desperate attack when out of stamina',
  type: 'melee',
  power: 15,
  accuracy: 90,
  staminaCost: 0,
  speedMod: -1,
  aspects: [],
};

// ============= DUAL-ASPECT MOVES (2 aspects) - Unlock at level 5+ =============
// Species + Element combos
export const SPECIES_ELEMENT_MOVES: Record<string, Move[]> = {
  'bat_fire': [
    { id: 'bat_fire_inferno_screech', name: 'Inferno Screech', description: 'A burning sonic wave', type: 'ranged', power: 40, accuracy: 90, staminaCost: 10, speedMod: 1, aspects: ['species', 'element'], element: 'fire', unlockLevel: 5 },
  ],
  'bat_water': [
    { id: 'bat_water_tidal_echo', name: 'Tidal Echo', description: 'Water-enhanced sonar', type: 'ranged', power: 35, accuracy: 95, staminaCost: 9, speedMod: 1, aspects: ['species', 'element'], element: 'water', unlockLevel: 5 },
  ],
  'bat_earth': [
    { id: 'bat_earth_cave_dive', name: 'Cave Dive', description: 'Stone-coated strike from above', type: 'melee', power: 38, accuracy: 85, staminaCost: 9, speedMod: 0, aspects: ['species', 'element'], element: 'earth', unlockLevel: 5 },
  ],
  'bat_air': [
    { id: 'bat_air_gale_screech', name: 'Gale Screech', description: 'Wind-amplified cry', type: 'ranged', power: 38, accuracy: 95, staminaCost: 8, speedMod: 2, aspects: ['species', 'element'], element: 'air', unlockLevel: 5 },
  ],
  'bat_void': [
    { id: 'bat_void_shadow_shriek', name: 'Shadow Shriek', description: 'Dark energy sonic blast', type: 'ranged', power: 42, accuracy: 88, staminaCost: 10, speedMod: 1, aspects: ['species', 'element'], element: 'void', unlockLevel: 5 },
  ],
  'slime_fire': [
    { id: 'slime_fire_lava_splash', name: 'Lava Splash', description: 'Molten body slam', type: 'melee', power: 35, accuracy: 90, staminaCost: 9, speedMod: 0, aspects: ['species', 'element'], element: 'fire', effect: 'burn', unlockLevel: 5 },
  ],
  'slime_water': [
    { id: 'slime_water_tidal_slam', name: 'Tidal Slam', description: 'Water-infused body slam', type: 'melee', power: 38, accuracy: 92, staminaCost: 9, speedMod: 0, aspects: ['species', 'element'], element: 'water', unlockLevel: 5 },
  ],
  'slime_earth': [
    { id: 'slime_earth_mud_slam', name: 'Mud Slam', description: 'Earth-infused goopy slam', type: 'melee', power: 40, accuracy: 88, staminaCost: 10, speedMod: -1, aspects: ['species', 'element'], element: 'earth', unlockLevel: 5 },
  ],
  'slime_air': [
    { id: 'slime_air_bubble_burst', name: 'Bubble Burst', description: 'Explosive air bubbles', type: 'ranged', power: 35, accuracy: 95, staminaCost: 8, speedMod: 1, aspects: ['species', 'element'], element: 'air', unlockLevel: 5 },
  ],
  'slime_void': [
    { id: 'slime_void_dark_absorb', name: 'Dark Absorb', description: 'Void-infused absorption', type: 'melee', power: 32, accuracy: 95, staminaCost: 10, speedMod: 0, aspects: ['species', 'element'], element: 'void', effect: 'heal_self', unlockLevel: 5 },
  ],
  'dragon_fire': [
    { id: 'dragon_fire_breath', name: 'Fire Breath', description: 'Classic dragon flames', type: 'ranged', power: 50, accuracy: 88, staminaCost: 12, speedMod: 0, aspects: ['species', 'element'], element: 'fire', effect: 'burn', unlockLevel: 5 },
    { id: 'dragon_fire_inferno_breath', name: 'Inferno Breath', description: 'Ultimate fire breath', type: 'ranged', power: 70, accuracy: 80, staminaCost: 18, speedMod: -1, aspects: ['species', 'element'], element: 'fire', effect: 'burn', unlockLevel: 12 },
  ],
  'dragon_water': [
    { id: 'dragon_water_breath', name: 'Hydro Breath', description: 'Pressurized water breath', type: 'ranged', power: 50, accuracy: 88, staminaCost: 12, speedMod: 0, aspects: ['species', 'element'], element: 'water', unlockLevel: 5 },
  ],
  'dragon_earth': [
    { id: 'dragon_earth_breath', name: 'Sand Breath', description: 'Blasting sand breath', type: 'ranged', power: 48, accuracy: 85, staminaCost: 12, speedMod: 0, aspects: ['species', 'element'], element: 'earth', effect: 'lower_accuracy', unlockLevel: 5 },
  ],
  'dragon_air': [
    { id: 'dragon_air_breath', name: 'Storm Breath', description: 'Gale-force breath', type: 'ranged', power: 48, accuracy: 92, staminaCost: 11, speedMod: 1, aspects: ['species', 'element'], element: 'air', unlockLevel: 5 },
  ],
  'dragon_void': [
    { id: 'dragon_void_breath', name: 'Void Breath', description: 'Reality-warping breath', type: 'ranged', power: 52, accuracy: 85, staminaCost: 13, speedMod: 0, aspects: ['species', 'element'], element: 'void', effect: 'drain_stamina', unlockLevel: 5 },
  ],
  'shark_water': [
    { id: 'shark_water_hydro_frenzy', name: 'Hydro Frenzy', description: 'Water-propelled biting', type: 'melee', power: 55, accuracy: 78, staminaCost: 14, speedMod: 1, aspects: ['species', 'element'], element: 'water', unlockLevel: 5 },
  ],
  'golem_earth': [
    { id: 'golem_earth_seismic_slam', name: 'Seismic Slam', description: 'Earth-shattering punch', type: 'melee', power: 55, accuracy: 70, staminaCost: 14, speedMod: -2, aspects: ['species', 'element'], element: 'earth', unlockLevel: 5 },
  ],
  'ghost_void': [
    { id: 'ghost_void_phantom_drain', name: 'Phantom Drain', description: 'Spectral void attack', type: 'melee', power: 40, accuracy: 95, staminaCost: 11, speedMod: 0, aspects: ['species', 'element'], element: 'void', effect: 'heal_self', unlockLevel: 5 },
  ],
  'wisp_fire': [
    { id: 'wisp_fire_flame_light', name: 'Flame Light', description: 'Burning radiance', type: 'ranged', power: 42, accuracy: 92, staminaCost: 10, speedMod: 1, aspects: ['species', 'element'], element: 'fire', effect: 'burn', unlockLevel: 5 },
  ],
  'wisp_air': [
    { id: 'wisp_air_wind_light', name: 'Wind Light', description: 'Swift light attack', type: 'ranged', power: 38, accuracy: 98, staminaCost: 8, speedMod: 2, aspects: ['species', 'element'], element: 'air', unlockLevel: 5 },
  ],
  'wolf_fire': [
    { id: 'wolf_fire_flame_fang', name: 'Flame Fang', description: 'Burning bite attack', type: 'melee', power: 45, accuracy: 90, staminaCost: 10, speedMod: 0, aspects: ['species', 'element'], element: 'fire', effect: 'burn', unlockLevel: 5 },
  ],
  'skeleton_void': [
    { id: 'skeleton_void_death_rattle', name: 'Death Rattle', description: 'Cursed bone attack', type: 'ranged', power: 42, accuracy: 88, staminaCost: 10, speedMod: 0, aspects: ['species', 'element'], element: 'void', effect: 'lower_defense', unlockLevel: 5 },
  ],
  'goblin_fire': [
    { id: 'goblin_fire_firebomb', name: 'Firebomb', description: 'Explosive goblin bomb', type: 'ranged', power: 45, accuracy: 82, staminaCost: 11, speedMod: 1, aspects: ['species', 'element'], element: 'fire', effect: 'burn', unlockLevel: 5 },
  ],
  'spider_void': [
    { id: 'spider_void_shadow_web', name: 'Shadow Web', description: 'Darkness-infused web', type: 'ranged', power: 38, accuracy: 90, staminaCost: 10, speedMod: 0, aspects: ['species', 'element'], element: 'void', effect: 'lower_speed', unlockLevel: 5 },
  ],
  'frog_water': [
    { id: 'frog_water_hydro_tongue', name: 'Hydro Tongue', description: 'Water-powered tongue lash', type: 'ranged', power: 40, accuracy: 95, staminaCost: 9, speedMod: 1, aspects: ['species', 'element'], element: 'water', unlockLevel: 5 },
  ],
  'jellyfish_water': [
    { id: 'jellyfish_water_current_sting', name: 'Current Sting', description: 'Water-propelled sting', type: 'melee', power: 38, accuracy: 92, staminaCost: 9, speedMod: 0, aspects: ['species', 'element'], element: 'water', effect: 'paralyze', unlockLevel: 5 },
  ],
};

// Species + Class combos
export const SPECIES_CLASS_MOVES: Record<string, Move[]> = {
  'bat_kinetic': [
    { id: 'bat_kinetic_impact_dive', name: 'Impact Dive', description: 'Full-force aerial strike', type: 'melee', power: 42, accuracy: 85, staminaCost: 10, speedMod: 1, aspects: ['species', 'class'], classBonus: 'kinetic', unlockLevel: 5 },
  ],
  'bat_energy': [
    { id: 'bat_energy_pulse_wave', name: 'Pulse Wave', description: 'Energy-charged screech', type: 'ranged', power: 38, accuracy: 92, staminaCost: 9, speedMod: 1, aspects: ['species', 'class'], classBonus: 'energy', unlockLevel: 5 },
  ],
  'dragon_kinetic': [
    { id: 'dragon_kinetic_tail_slam', name: 'Tail Slam', description: 'Devastating physical tail strike', type: 'melee', power: 50, accuracy: 85, staminaCost: 11, speedMod: -1, aspects: ['species', 'class'], classBonus: 'kinetic', unlockLevel: 5 },
  ],
  'dragon_energy': [
    { id: 'dragon_energy_plasma_breath', name: 'Plasma Breath', description: 'Energy-infused dragon breath', type: 'ranged', power: 52, accuracy: 88, staminaCost: 13, speedMod: 0, aspects: ['species', 'class'], classBonus: 'energy', unlockLevel: 5 },
  ],
  'slime_biological': [
    { id: 'slime_bio_mitosis', name: 'Mitosis', description: 'Split and regenerate', type: 'heal', power: 40, accuracy: 100, staminaCost: 12, speedMod: 0, aspects: ['species', 'class'], classBonus: 'biological', unlockLevel: 5 },
  ],
  'spider_chemical': [
    { id: 'spider_chem_acid_web', name: 'Acid Web', description: 'Corrosive web trap', type: 'ranged', power: 35, accuracy: 88, staminaCost: 10, speedMod: 0, aspects: ['species', 'class'], classBonus: 'chemical', effect: 'poison', unlockLevel: 5 },
  ],
  'golem_kinetic': [
    { id: 'golem_kinetic_mega_punch', name: 'Mega Punch', description: 'Ultimate physical punch', type: 'melee', power: 60, accuracy: 75, staminaCost: 14, speedMod: -2, aspects: ['species', 'class'], classBonus: 'kinetic', unlockLevel: 5 },
  ],
  'wolf_kinetic': [
    { id: 'wolf_kinetic_tackle', name: 'Wild Tackle', description: 'Full-force tackle', type: 'melee', power: 48, accuracy: 88, staminaCost: 10, speedMod: 0, aspects: ['species', 'class'], classBonus: 'kinetic', unlockLevel: 5 },
  ],
  'ghost_political': [
    { id: 'ghost_political_haunt_command', name: 'Haunt Command', description: 'Ghostly authority', type: 'status', power: 0, accuracy: 95, staminaCost: 8, speedMod: 1, aspects: ['species', 'class'], classBonus: 'political', effect: 'lower_all_stats', unlockLevel: 5 },
  ],
  'shark_kinetic': [
    { id: 'shark_kinetic_power_bite', name: 'Power Bite', description: 'Maximum force bite', type: 'melee', power: 58, accuracy: 82, staminaCost: 13, speedMod: 0, aspects: ['species', 'class'], classBonus: 'kinetic', unlockLevel: 5 },
  ],
  'wisp_energy': [
    { id: 'wisp_energy_photon_burst', name: 'Photon Burst', description: 'Pure light energy', type: 'ranged', power: 48, accuracy: 95, staminaCost: 12, speedMod: 1, aspects: ['species', 'class'], classBonus: 'energy', unlockLevel: 5 },
  ],
  'mushroom_biological': [
    { id: 'mushroom_bio_mega_regen', name: 'Mega Regenerate', description: 'Powerful natural healing', type: 'heal', power: 50, accuracy: 100, staminaCost: 14, speedMod: -1, aspects: ['species', 'class'], classBonus: 'biological', unlockLevel: 5 },
  ],
  'imp_chemical': [
    { id: 'imp_chem_trick_bomb', name: 'Trick Bomb', description: 'Mischievous explosive', type: 'ranged', power: 42, accuracy: 88, staminaCost: 10, speedMod: 1, aspects: ['species', 'class'], classBonus: 'chemical', effect: 'confuse', unlockLevel: 5 },
  ],
};

// Element + Class combos
export const ELEMENT_CLASS_MOVES: Record<string, Move[]> = {
  'fire_kinetic': [
    { id: 'fire_kinetic_blazing_strike', name: 'Blazing Strike', description: 'Flame-enhanced punch', type: 'melee', power: 45, accuracy: 88, staminaCost: 10, speedMod: 0, aspects: ['element', 'class'], element: 'fire', classBonus: 'kinetic', unlockLevel: 5 },
  ],
  'fire_energy': [
    { id: 'fire_energy_plasma_flame', name: 'Plasma Flame', description: 'Superheated energy fire', type: 'ranged', power: 48, accuracy: 90, staminaCost: 12, speedMod: 1, aspects: ['element', 'class'], element: 'fire', classBonus: 'energy', unlockLevel: 5 },
  ],
  'water_energy': [
    { id: 'water_energy_hydro_beam', name: 'Hydro Beam', description: 'High-energy water laser', type: 'ranged', power: 45, accuracy: 90, staminaCost: 11, speedMod: 1, aspects: ['element', 'class'], element: 'water', classBonus: 'energy', unlockLevel: 5 },
  ],
  'water_kinetic': [
    { id: 'water_kinetic_hydro_punch', name: 'Hydro Punch', description: 'Water-powered strike', type: 'melee', power: 45, accuracy: 90, staminaCost: 10, speedMod: 0, aspects: ['element', 'class'], element: 'water', classBonus: 'kinetic', unlockLevel: 5 },
  ],
  'earth_biological': [
    { id: 'earth_bio_nature_growth', name: "Nature's Growth", description: 'Earth-powered healing', type: 'heal', power: 45, accuracy: 100, staminaCost: 13, speedMod: -1, aspects: ['element', 'class'], element: 'earth', classBonus: 'biological', unlockLevel: 5 },
  ],
  'earth_kinetic': [
    { id: 'earth_kinetic_boulder_punch', name: 'Boulder Punch', description: 'Earth-infused strike', type: 'melee', power: 52, accuracy: 82, staminaCost: 12, speedMod: -1, aspects: ['element', 'class'], element: 'earth', classBonus: 'kinetic', unlockLevel: 5 },
  ],
  'void_political': [
    { id: 'void_political_dark_decree', name: 'Dark Decree', description: 'Commanding void energy', type: 'ranged', power: 40, accuracy: 100, staminaCost: 11, speedMod: 0, aspects: ['element', 'class'], element: 'void', classBonus: 'political', unlockLevel: 5 },
  ],
  'void_energy': [
    { id: 'void_energy_dark_pulse', name: 'Dark Energy Pulse', description: 'Concentrated void energy', type: 'ranged', power: 48, accuracy: 88, staminaCost: 12, speedMod: 0, aspects: ['element', 'class'], element: 'void', classBonus: 'energy', unlockLevel: 5 },
  ],
  'air_chemical': [
    { id: 'air_chem_toxic_cloud', name: 'Toxic Cloud', description: 'Poisonous gas attack', type: 'ranged', power: 30, accuracy: 92, staminaCost: 9, speedMod: 0, aspects: ['element', 'class'], element: 'air', classBonus: 'chemical', effect: 'poison', unlockLevel: 5 },
  ],
  'air_energy': [
    { id: 'air_energy_lightning_wind', name: 'Lightning Wind', description: 'Electric wind attack', type: 'ranged', power: 45, accuracy: 92, staminaCost: 11, speedMod: 2, aspects: ['element', 'class'], element: 'air', classBonus: 'energy', unlockLevel: 5 },
  ],
};

// ============= TRIPLE-ASPECT MOVES (3 aspects - unique signature moves, unlock at level 10+) =============
export const TRIPLE_ASPECT_MOVES: Record<string, Move> = {
  'bat_fire_kinetic': {
    id: 'bat_fire_kinetic_meteor_dive', name: 'Meteor Dive', description: 'A blazing aerial impact strike unique to Fire Kinetic Bats',
    type: 'melee', power: 60, accuracy: 82, staminaCost: 15, speedMod: 1, aspects: ['species', 'element', 'class'], element: 'fire', classBonus: 'kinetic', unlockLevel: 10
  },
  'bat_fire_energy': {
    id: 'bat_fire_energy_solar_screech', name: 'Solar Screech', description: 'Blazing energy sonic attack',
    type: 'ranged', power: 58, accuracy: 88, staminaCost: 14, speedMod: 1, aspects: ['species', 'element', 'class'], element: 'fire', classBonus: 'energy', unlockLevel: 10
  },
  'dragon_fire_energy': {
    id: 'dragon_fire_energy_solar_blast', name: 'Solar Blast', description: 'Pure plasma dragon breath',
    type: 'ranged', power: 65, accuracy: 85, staminaCost: 16, speedMod: 0, aspects: ['species', 'element', 'class'], element: 'fire', classBonus: 'energy', effect: 'burn', unlockLevel: 10
  },
  'dragon_fire_kinetic': {
    id: 'dragon_fire_kinetic_blazing_charge', name: 'Blazing Charge', description: 'Fiery physical assault',
    type: 'melee', power: 68, accuracy: 80, staminaCost: 17, speedMod: 0, aspects: ['species', 'element', 'class'], element: 'fire', classBonus: 'kinetic', effect: 'burn', unlockLevel: 10
  },
  'shark_water_kinetic': {
    id: 'shark_water_kinetic_torpedo', name: 'Torpedo Rush', description: 'Maximum velocity water assault',
    type: 'melee', power: 70, accuracy: 75, staminaCost: 18, speedMod: 2, aspects: ['species', 'element', 'class'], element: 'water', classBonus: 'kinetic', unlockLevel: 10
  },
  'ghost_void_political': {
    id: 'ghost_void_political_spectral_command', name: 'Spectral Command', description: 'Command the shadows themselves',
    type: 'status', power: 0, accuracy: 100, staminaCost: 14, speedMod: 0, aspects: ['species', 'element', 'class'], element: 'void', classBonus: 'political', effect: 'lower_all_stats', unlockLevel: 10
  },
  'ghost_void_energy': {
    id: 'ghost_void_energy_soul_blast', name: 'Soul Blast', description: 'Pure spectral energy',
    type: 'ranged', power: 62, accuracy: 90, staminaCost: 15, speedMod: 0, aspects: ['species', 'element', 'class'], element: 'void', classBonus: 'energy', effect: 'heal_self', unlockLevel: 10
  },
  'golem_earth_kinetic': {
    id: 'golem_earth_kinetic_continental_crush', name: 'Continental Crush', description: 'The ultimate earth-shattering blow',
    type: 'melee', power: 80, accuracy: 65, staminaCost: 20, speedMod: -3, aspects: ['species', 'element', 'class'], element: 'earth', classBonus: 'kinetic', unlockLevel: 10
  },
  'golem_earth_biological': {
    id: 'golem_earth_bio_living_mountain', name: 'Living Mountain', description: 'Become one with the earth',
    type: 'status', power: 0, accuracy: 100, staminaCost: 15, speedMod: -2, aspects: ['species', 'element', 'class'], element: 'earth', classBonus: 'biological', effect: 'raise_defense', unlockLevel: 10
  },
  'wisp_air_energy': {
    id: 'wisp_air_energy_aurora_beam', name: 'Aurora Beam', description: 'Prismatic light energy',
    type: 'ranged', power: 55, accuracy: 95, staminaCost: 14, speedMod: 2, aspects: ['species', 'element', 'class'], element: 'air', classBonus: 'energy', unlockLevel: 10
  },
  'wolf_fire_kinetic': {
    id: 'wolf_fire_kinetic_inferno_pounce', name: 'Inferno Pounce', description: 'Blazing physical assault',
    type: 'melee', power: 62, accuracy: 85, staminaCost: 15, speedMod: 1, aspects: ['species', 'element', 'class'], element: 'fire', classBonus: 'kinetic', effect: 'burn', unlockLevel: 10
  },
  'spider_void_chemical': {
    id: 'spider_void_chem_nightmare_web', name: 'Nightmare Web', description: 'Toxic darkness trap',
    type: 'ranged', power: 48, accuracy: 88, staminaCost: 14, speedMod: 0, aspects: ['species', 'element', 'class'], element: 'void', classBonus: 'chemical', effect: 'poison', unlockLevel: 10
  },
  'slime_water_biological': {
    id: 'slime_water_bio_tidal_regeneration', name: 'Tidal Regeneration', description: 'Water-powered healing',
    type: 'heal', power: 55, accuracy: 100, staminaCost: 16, speedMod: -1, aspects: ['species', 'element', 'class'], element: 'water', classBonus: 'biological', unlockLevel: 10
  },
  'jellyfish_water_chemical': {
    id: 'jellyfish_water_chem_toxic_current', name: 'Toxic Current', description: 'Poisonous water attack',
    type: 'ranged', power: 50, accuracy: 90, staminaCost: 14, speedMod: 0, aspects: ['species', 'element', 'class'], element: 'water', classBonus: 'chemical', effect: 'poison', unlockLevel: 10
  },
  'mushroom_earth_biological': {
    id: 'mushroom_earth_bio_gaia_bloom', name: 'Gaia Bloom', description: 'Ultimate natural restoration',
    type: 'heal', power: 70, accuracy: 100, staminaCost: 20, speedMod: -2, aspects: ['species', 'element', 'class'], element: 'earth', classBonus: 'biological', unlockLevel: 10
  },
  'skeleton_void_political': {
    id: 'skeleton_void_pol_death_decree', name: 'Death Decree', description: 'Commanding undead authority',
    type: 'ranged', power: 55, accuracy: 95, staminaCost: 14, speedMod: 0, aspects: ['species', 'element', 'class'], element: 'void', classBonus: 'political', effect: 'lower_all_stats', unlockLevel: 10
  },
  'imp_fire_chemical': {
    id: 'imp_fire_chem_hellfire_bomb', name: 'Hellfire Bomb', description: 'Demonic explosive attack',
    type: 'ranged', power: 58, accuracy: 82, staminaCost: 15, speedMod: 1, aspects: ['species', 'element', 'class'], element: 'fire', classBonus: 'chemical', effect: 'burn', unlockLevel: 10
  },
  'crow_void_political': {
    id: 'crow_void_pol_omen_call', name: 'Omen Call', description: 'Dark prophetic attack',
    type: 'ranged', power: 52, accuracy: 95, staminaCost: 13, speedMod: 1, aspects: ['species', 'element', 'class'], element: 'void', classBonus: 'political', effect: 'lower_attack', unlockLevel: 10
  },
};

// Shared availability check: AND across populated lists by default ('all'),
// OR across populated lists when availabilityMode === 'any'. Empty lists are
// always treated as "no restriction" for that axis.
export function passesAvailability(
  m: Partial<Move>,
  species: SpeciesType,
  element: ElementType,
  classType: ClassType,
): boolean {
  const sList = m.availableSpecies?.length ? m.availableSpecies : null;
  const eList = m.availableElements?.length ? m.availableElements : null;
  const cList = m.availableClasses?.length ? m.availableClasses : null;
  if (!sList && !eList && !cList) return true;
  if (m.availabilityMode === 'any') {
    return (
      (sList?.includes(species) ?? false) ||
      (eList?.includes(element) ?? false) ||
      (cList?.includes(classType) ?? false)
    );
  }
  if (sList && !sList.includes(species)) return false;
  if (eList && !eList.includes(element)) return false;
  if (cList && !cList.includes(classType)) return false;
  return true;
}

// Get all moves available to a monster based on its aspects and level.
// Honors admin-registered overrides + custom moves.
export function getMonsterMoves(species: SpeciesType, element: ElementType, classType: ClassType, level: number = 99): Move[] {
  const moves: Move[] = [];

  const filterByLevel = (m: Move) => (m.unlockLevel || 1) <= level;

  // Built-in moves, each merged with any admin override on the way out.
  const pushAll = (list: Move[]) => {
    for (const m of list) {
      const merged = applyMoveOverride(m);
      // Override can also re-target the move via availableSpecies/Elements/Classes.
      if (!passesAvailability(merged, species, element, classType)) continue;
      if (filterByLevel(merged)) moves.push(merged);
    }
  };

  pushAll(SPECIES_MOVES[species]);
  pushAll(ELEMENT_MOVES[element]);
  pushAll(CLASS_MOVES[classType]);

  const speciesElementKey = `${species}_${element}`;
  if (SPECIES_ELEMENT_MOVES[speciesElementKey]) pushAll(SPECIES_ELEMENT_MOVES[speciesElementKey]);

  const speciesClassKey = `${species}_${classType}`;
  if (SPECIES_CLASS_MOVES[speciesClassKey]) pushAll(SPECIES_CLASS_MOVES[speciesClassKey]);

  const elementClassKey = `${element}_${classType}`;
  if (ELEMENT_CLASS_MOVES[elementClassKey]) pushAll(ELEMENT_CLASS_MOVES[elementClassKey]);

  const tripleKey = `${species}_${element}_${classType}`;
  if (TRIPLE_ASPECT_MOVES[tripleKey]) pushAll([TRIPLE_ASPECT_MOVES[tripleKey]]);

  // Admin-defined custom moves (data_type='moves' rows with custom:true).
  for (const m of getCustomMovesFor(species, element, classType, level)) {
    moves.push(m);
  }

  return moves;
}


// Get moves that were just unlocked at a specific level
export function getNewMovesAtLevel(species: SpeciesType, element: ElementType, classType: ClassType, level: number): Move[] {
  const allMoves = getMonsterMoves(species, element, classType, level);
  return allMoves.filter(m => m.unlockLevel === level);
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
  const found = allMoves.find(m => m.id === id);
  if (found) return applyMoveOverride(found);
  return getCustomMoves().find((m) => m.id === id);
}



