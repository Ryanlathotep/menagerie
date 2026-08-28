// Automatic move "tag" normalization.
//
// Moves carry derived metadata (targeting pattern, aoeRadius, piercing,
// wallPenetrate, movement typing). It is easy for a newly authored or
// admin-edited move to leave those out, which silently turns an intended AoE
// into a single-target poke. `normalizeMoveTags` re-derives the consistent set
// from the move's own data (shape, pattern, name/description wording) so every
// read path — built-in moves, admin overrides and fully custom moves — is
// tagged the same way.

import type { Move, TargetingPattern } from './moves';

/** Wording that implies the move covers an area rather than one tile. */
const AOE_WORDS =
  /\b(all enemies|everyone|every enemy|around|aura|explos\w*|explode|eruption|erupt\w*|nova|storm|quake|shockwave|cone|radius|area|sweep|swirl|whirl\w*|vortex|spray|barrage|shower|cloud|field|meteor|avalanche|tremor|ground slam|splash)\b/i;
/** Wording that implies the move hits every enemy in a line. */
const PIERCE_WORDS = /\b(pierc\w*|impal\w*|skewer|penetrat\w*|through all)\b/i;
/** Wording that implies the projectile ignores walls. */
const WALL_WORDS = /\b(ghostly|phase\w*|through walls|psychic|spirit|ethereal|arcing)\b/i;

const AOE_PATTERNS: TargetingPattern[] = ['aura', 'cone', 'area', 'piercing', 'custom'];

/** True when the move already resolves as an area/multi-target attack. */
export function isAoeMove(m: Move): boolean {
  return Boolean(
    m.customShape ||
      m.piercing ||
      (m.aoeRadius ?? 0) > 0 ||
      AOE_PATTERNS.includes(m.targeting as TargetingPattern),
  );
}

/**
 * Returns a copy of the move with its derived tags filled in / corrected.
 * Never fights an explicit designer choice: existing patterns and radii win,
 * only missing or contradictory tags are repaired.
 */
export function normalizeMoveTags<T extends Move>(move: T): T {
  const m: T = { ...move };
  const text = `${m.name ?? ''} ${m.description ?? ''}`;

  // 1. A movement pattern always makes this a movement move.
  if (m.movement && m.type !== 'movement') m.type = 'movement';

  // 2. A designer shape drives resolution; keep targeting in sync.
  if (m.customShape && m.targeting !== 'custom') m.targeting = 'custom';

  // 3. Piercing wording implies a line that hits everything.
  if (PIERCE_WORDS.test(text) && !m.piercing && m.targeting !== 'piercing' && !m.customShape) {
    m.targeting = 'piercing';
    m.piercing = true;
  }
  if (m.targeting === 'piercing') m.piercing = true;

  // 4. AoE wording on an attack that has no area tagging → give it one.
  const isAttack = m.type === 'melee' || m.type === 'ranged';
  if (isAttack && !isAoeMove(m) && AOE_WORDS.test(text)) {
    // "around / aura / storm / nova" centres on the caster, everything else
    // reads as a targeted blast.
    const centred = /\b(around|aura|storm|nova|vortex|swirl|whirl\w*|tremor|quake|shockwave|ground slam|sweep)\b/i.test(text);
    m.targeting = centred ? 'aura' : m.type === 'melee' ? 'aura' : 'area';
    m.aoeRadius = m.aoeRadius ?? (m.type === 'melee' ? 1 : 2);
  }

  // 5. Area/aura/cone patterns need a radius to resolve sensibly.
  if ((m.targeting === 'area' || m.targeting === 'aura' || m.targeting === 'cone') && !m.aoeRadius) {
    m.aoeRadius = m.type === 'melee' ? 1 : 2;
  }

  // 6. A radius with no area pattern is meaningless — promote it.
  if ((m.aoeRadius ?? 0) > 0 && !m.customShape && !AOE_PATTERNS.includes(m.targeting as TargetingPattern)) {
    m.targeting = m.type === 'melee' ? 'aura' : 'area';
  }

  // 7. Ranged attacks must state how they target.
  if (m.type === 'ranged' && !m.targeting && !m.customShape) m.targeting = 'single';

  // 8. Wall-ignoring wording (ghost / psychic / arcing shots).
  if (WALL_WORDS.test(text) && m.wallPenetrate === undefined && isAttack) {
    m.wallPenetrate = true;
  }

  return m;
}

/** Convenience for lists (built-in pools, custom move registries). */
export function normalizeMoveList<T extends Move>(moves: T[]): T[] {
  return moves.map(normalizeMoveTags);
}
