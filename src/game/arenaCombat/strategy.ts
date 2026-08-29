/**
 * Default team strategy — mirrors enemyAI's move scoring, then chooses to
 * either attack (if a viable move lands), spend a movement/reposition skill,
 * or step one tile closer to the nearest enemy on the 24x24 grid.
 */
import type { TacticInput, TacticDecision, TeamStrategy } from './types';
import {
  chooseEnemyMove, getEnemyArchetype, getEnemyIQ, isMovementMove,
  type TacticContext,
} from '@/game/enemyAI';
import { getAttackConfig } from '@/game/dungeonCombat';
import { chebyshev } from './turnOrder';
import type { Move } from '@/game/moves';
import type { Position } from './types';

export const autoStrategy: TeamStrategy = (input: TacticInput): TacticDecision => {
  const { self, enemies } = input;
  const aliveEnemies = enemies.filter(e => e.monster.stats.currentHp > 0);
  if (aliveEnemies.length === 0) return {};

  // Pick nearest enemy as focus
  aliveEnemies.sort((a, b) => chebyshev(a.pos, self.pos) - chebyshev(b.pos, self.pos));
  const target = aliveEnemies[0];
  const dist = chebyshev(self.pos, target.pos);

  const ctx: TacticContext = {
    distance: dist,
    iq: getEnemyIQ(self.monster.level),
    archetype: getEnemyArchetype(self.monster),
    enemyHpRatio: self.monster.stats.currentHp / Math.max(1, self.monster.stats.maxHp),
    enemyStaminaRatio: self.monster.stats.currentStamina / Math.max(1, self.monster.stats.stamina),
    playerHpRatio: target.monster.stats.currentHp / Math.max(1, target.monster.stats.maxHp),
    playerElement: target.monster.element,
  };

  const decision = chooseEnemyMove(self.monster, ctx);

  // Movement / reposition skill — resolve an actual destination from its offsets.
  if (decision.move && isMovementMove(decision.move)) {
    const dest = pickMovementDestination(decision.move, self.pos, target.pos, input);
    if (dest) {
      return { move: decision.move, moveTo: dest, relocate: true, targetId: target.monster.id };
    }
    // Nowhere legal to land — fall through to a plain step.
    return { moveTo: stepToward(self.pos, target.pos, input) };
  }

  // If no viable move, or the move requires melee and we're far, step toward.
  if (!decision.move) {
    return { moveTo: stepToward(self.pos, target.pos, input) };
  }
  const move = decision.move;
  const isRanged = move.type === 'ranged' || (move.aoeRadius ?? 0) > 0;
  if (!isRanged && dist > 1) {
    return { moveTo: stepToward(self.pos, target.pos, input) };
  }
  if (isRanged && dist > 4) {
    return { moveTo: stepToward(self.pos, target.pos, input) };
  }
  return { move, targetId: target.monster.id };
};

/**
 * Choose the best legal landing tile from a movement skill's offsets.
 * Approach archetypes minimise distance to the focus target; wounded or
 * ranged-preferring units maximise it. Walls and occupied tiles are rejected
 * (and, unless the pattern blinks, so is a blocked straight-line path).
 */
export function pickMovementDestination(
  move: Move,
  from: Position,
  focus: Position,
  input: TacticInput,
): Position | null {
  const cfg = getAttackConfig(move);
  const offsets = cfg.customOffsets ?? [];
  if (offsets.length === 0) return null;

  const { grid, isBlocked, isOccupied, self } = input;
  const hpRatio = self.monster.stats.currentHp / Math.max(1, self.monster.stats.maxHp);
  const away = hpRatio < 0.3 || move.type === 'ranged';

  let best: Position | null = null;
  let bestScore = -Infinity;

  for (const o of offsets) {
    const p = { x: from.x + o.dx, y: from.y + o.dy };
    if (p.x < 0 || p.y < 0 || p.x >= grid.width || p.y >= grid.height) continue;
    if (isBlocked(p) || isOccupied(p)) continue;
    if (!cfg.blink && !pathClear(from, p, input)) continue;

    const d = chebyshev(p, focus);
    // Approach: prefer adjacency. Retreat: prefer distance, but stay on the map.
    const score = away ? d : -d;
    if (score > bestScore) { bestScore = score; best = p; }
  }
  return best;
}

/** Straight-line (Bresenham-ish) walkability check between two tiles. */
function pathClear(from: Position, to: Position, input: TacticInput): boolean {
  const steps = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
  if (steps <= 1) return true;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const p = {
      x: Math.round(from.x + (to.x - from.x) * t),
      y: Math.round(from.y + (to.y - from.y) * t),
    };
    if (input.isBlocked(p) || input.isOccupied(p)) return false;
  }
  return true;
}

function stepToward(from: Position, to: Position, input: TacticInput): Position {
  const { grid, isBlocked, isOccupied } = input;
  const clamp = (p: Position) => ({
    x: Math.max(0, Math.min(grid.width - 1, p.x)),
    y: Math.max(0, Math.min(grid.height - 1, p.y)),
  });
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);
  // Try the diagonal step, then each axis, then any free neighbour.
  const candidates: Position[] = [
    { x: from.x + dx, y: from.y + dy },
    { x: from.x + dx, y: from.y },
    { x: from.x, y: from.y + dy },
    { x: from.x + dy, y: from.y + dx },
    { x: from.x - dy, y: from.y - dx },
  ];
  for (const raw of candidates) {
    if (raw.x === from.x && raw.y === from.y) continue;
    const p = clamp(raw);
    if (p.x === from.x && p.y === from.y) continue;
    if (isBlocked(p) || isOccupied(p)) continue;
    return p;
  }
  return clamp({ x: from.x + dx, y: from.y + dy });
}
