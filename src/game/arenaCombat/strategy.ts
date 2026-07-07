/**
 * Default team strategy — mirrors enemyAI's move scoring, then chooses to
 * either attack (if a viable move lands) or step one tile closer to the
 * nearest enemy on the 6x6 grid.
 */
import type { TacticInput, TacticDecision, TeamStrategy } from './types';
import { chooseEnemyMove, getEnemyArchetype, getEnemyIQ, type TacticContext } from '@/game/enemyAI';
import { chebyshev } from './turnOrder';

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

  // If no viable move, or the move requires melee and we're far, step toward.
  if (!decision.move) {
    return { moveTo: stepToward(self.pos, target.pos, input.grid) };
  }
  const move = decision.move;
  const isRanged = move.type === 'ranged' || (move.aoeRadius ?? 0) > 0;
  if (!isRanged && dist > 1) {
    return { moveTo: stepToward(self.pos, target.pos, input.grid) };
  }
  if (isRanged && dist > 4) {
    return { moveTo: stepToward(self.pos, target.pos, input.grid) };
  }
  return { move, targetId: target.monster.id };
};

function stepToward(from: { x: number; y: number }, to: { x: number; y: number }, grid: { width: number; height: number }) {
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);
  return {
    x: Math.max(0, Math.min(grid.width - 1, from.x + dx)),
    y: Math.max(0, Math.min(grid.height - 1, from.y + dy)),
  };
}
