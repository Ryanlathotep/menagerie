// ============================================================
// Enemy AI v3 — Archetype-aware decision making with level-based intelligence
//
// Pure functions. No DOM, no React. Consumed by:
//   - src/pages/Index.tsx          (dungeon enemy turns)
//   - src/game/overworldCombat.ts  (overworld enemy turns)
//
// Key concepts:
//   - Archetype: derived from species + class (tank/bruiser/assassin/mage/ranger/support)
//   - IQ:        smooth ramp by enemy level (~0 at lvl 1, ~0.7 at lvl 50)
//   - Move pick: scored vs current situation, blurred by (1 - IQ) randomness
//   - Movement:  archetype hint (approach/retreat/flank/hold) + retreat threshold
// ============================================================

import { Monster, ClassType, SpeciesType, ElementType } from './types';
import { Move, getMonsterMoves } from './moves';
import { getElementMultiplier } from './combat';

export type EnemyArchetype = 'tank' | 'bruiser' | 'assassin' | 'mage' | 'ranger' | 'support';

// --- Archetype derivation -----------------------------------------------------

const RANGED_SPECIES: SpeciesType[] = ['wisp', 'crow', 'bat', 'spider', 'jellyfish'] as SpeciesType[];
const TANK_SPECIES: SpeciesType[]   = ['golem', 'beetle', 'shark'] as SpeciesType[];
const ASSASSIN_SPECIES: SpeciesType[] = ['imp', 'rat'] as SpeciesType[];
const SUPPORT_SPECIES: SpeciesType[] = ['mushroom', 'ghost', 'slime'] as SpeciesType[];
const BRUISER_SPECIES: SpeciesType[] = ['dragon', 'wolf'] as SpeciesType[];

// Class tags are best-effort; missing classes just fall through to bruiser.
const TANK_CLASSES: ClassType[]     = ['military', 'industrial'] as ClassType[];
const MAGE_CLASSES: ClassType[]     = ['chemical', 'religious', 'occult'] as ClassType[];
const ASSASSIN_CLASSES: ClassType[] = ['criminal', 'political'] as ClassType[];
const SUPPORT_CLASSES: ClassType[]  = ['academic', 'pastoral', 'medical'] as ClassType[];

export function getEnemyArchetype(m: Monster): EnemyArchetype {
  if (TANK_SPECIES.includes(m.species)) return 'tank';
  if (RANGED_SPECIES.includes(m.species)) {
    if (MAGE_CLASSES.includes(m.class)) return 'mage';
    return 'ranger';
  }
  if (ASSASSIN_SPECIES.includes(m.species) || ASSASSIN_CLASSES.includes(m.class)) return 'assassin';
  if (SUPPORT_SPECIES.includes(m.species) || SUPPORT_CLASSES.includes(m.class)) return 'support';
  if (BRUISER_SPECIES.includes(m.species)) return 'bruiser';
  if (TANK_CLASSES.includes(m.class)) return 'tank';
  if (MAGE_CLASSES.includes(m.class)) return 'mage';
  return 'bruiser';
}

// --- Intelligence ramp --------------------------------------------------------
// Subtle curve: 0.04 @ 1, 0.5 @ 25, 0.67 @ 50, 0.8 @ 100.
export function getEnemyIQ(level: number): number {
  const L = Math.max(1, level);
  return 1 - 1 / (1 + L / 25);
}

// --- Movement hints -----------------------------------------------------------

export interface MovementHint {
  prefer: 'approach' | 'retreat' | 'flank' | 'hold';
  retreatHpThreshold: number; // retreat when enemyHpRatio < this
  idealRange: number;         // chebyshev / manhattan tiles
}

export function getMovementHint(archetype: EnemyArchetype, iq: number): MovementHint {
  switch (archetype) {
    case 'tank':     return { prefer: 'approach', retreatHpThreshold: 0.05,                 idealRange: 1 };
    case 'bruiser':  return { prefer: 'approach', retreatHpThreshold: 0.10 + iq * 0.05,     idealRange: 1 };
    case 'assassin': return { prefer: iq > 0.4 ? 'flank' : 'approach', retreatHpThreshold: 0.20 + iq * 0.15, idealRange: 1 };
    case 'mage':     return { prefer: 'retreat',  retreatHpThreshold: 0.25 + iq * 0.15,     idealRange: 3 };
    case 'ranger':   return { prefer: 'retreat',  retreatHpThreshold: 0.20 + iq * 0.10,     idealRange: 3 };
    case 'support':  return { prefer: 'retreat',  retreatHpThreshold: 0.30 + iq * 0.20,     idealRange: 4 };
  }
}

// --- Move selection -----------------------------------------------------------

export interface TacticContext {
  distance: number;             // manhattan distance to player
  iq: number;                   // 0..1
  archetype: EnemyArchetype;
  enemyHpRatio: number;         // 0..1
  enemyStaminaRatio: number;    // 0..1
  playerHpRatio: number;        // 0..1
  playerElement: ElementType;
}

export interface MoveDecision {
  move: Move | null; // null = no affordable move; caller may rest or basic-attack
  score?: number;
}

const isDamageMove = (m: Move) => m.type === 'melee' || m.type === 'ranged';

function scoreMove(move: Move, _enemy: Monster, ctx: TacticContext): number {
  let s = 0;

  if (isDamageMove(move)) {
    const elementMult = move.element ? getElementMultiplier(move.element, ctx.playerElement) : 1;
    s += move.power * elementMult * (move.accuracy / 100);

    // Range fit — heavily prefer correct range, but high-IQ enemies don't waste melee turns at distance
    const isRanged = move.type === 'ranged';
    if (isRanged && ctx.distance > 1) s += 10;
    if (!isRanged && ctx.distance > 1) s -= 18;

    // Finisher: low player HP → favor high-damage closers
    if (ctx.playerHpRatio < 0.3 && move.power >= 40) s += 18;

    // Element super-effective bonus
    if (move.element && elementMult > 1) s += 12;
  } else if (move.type === 'status') {
    s += 10;
    // Status moves matter most when fight is still long
    if (ctx.playerHpRatio > 0.7) s += 8;
    if (ctx.playerHpRatio < 0.3) s -= 15;

    // Archetype affinities
    if (ctx.archetype === 'support' || ctx.archetype === 'tank') s += 8;
    if (ctx.archetype === 'assassin' && /lower_(speed|accuracy)/.test(move.effect ?? '')) s += 8;
    if (ctx.archetype === 'mage' && /lower_(defense|special)/.test(move.effect ?? '')) s += 8;
  } else if (move.type === 'heal') {
    if (ctx.enemyHpRatio < 0.5) s += 30 * (1 - ctx.enemyHpRatio);
    else s -= 60; // never heal at full HP
  }

  // Stamina pressure: conserve when low
  if (ctx.enemyStaminaRatio < 0.3 && move.staminaCost > 10) s -= 12;

  return s;
}

export function chooseEnemyMove(enemy: Monster, ctx: TacticContext): MoveDecision {
  const all = getMonsterMoves(enemy.species, enemy.element, enemy.class, enemy.level);
  const stamina = enemy.stats.currentStamina ?? enemy.stats.stamina ?? 0;
  const affordable = all.filter((m) => m.staminaCost <= stamina);
  if (affordable.length === 0) return { move: null };

  // Very low IQ → near-random affordable damage move (with cheap fallback)
  if (ctx.iq < 0.15) {
    const damage = affordable.filter(isDamageMove);
    const pool = damage.length ? damage : affordable;
    return { move: pool[Math.floor(Math.random() * pool.length)] };
  }

  // Score + randomness inversely proportional to IQ
  const noiseAmp = (1 - ctx.iq) * 25;
  const scored = affordable.map((m) => ({ m, s: scoreMove(m, enemy, ctx) + (Math.random() * noiseAmp) }));
  scored.sort((a, b) => b.s - a.s);
  return { move: scored[0].m, score: scored[0].s };
}

// Convenience: compute damage from a chosen enemy move against the player monster.
// Mirrors the simple formula already used in Index/overworldCombat but folds in
// move power, element matchup, and accuracy roll.
export function rollEnemyMoveDamage(
  enemy: Monster,
  move: Move,
  playerDefense: number,
  playerElement: ElementType,
): { damage: number; hit: boolean; superEffective: boolean } {
  const hit = Math.random() * 100 < move.accuracy;
  if (!hit) return { damage: 0, hit: false, superEffective: false };

  const elementMult = move.element ? getElementMultiplier(move.element, playerElement) : 1;
  const superEffective = elementMult > 1;
  const base = enemy.stats.attack * (1 + move.power / 100);
  const dmg = Math.max(1, Math.floor(base * elementMult - playerDefense * 0.3));
  return { damage: dmg, hit: true, superEffective };
}
