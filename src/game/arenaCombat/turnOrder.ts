/**
 * Turn scheduler: fastest-first, but alternating teams whenever possible.
 * If team A has monsters remaining but team B doesn't, A acts consecutively.
 */
import type { Combatant } from './types';

export function buildTurnOrder(all: Combatant[]): Combatant[] {
  const alive = all.filter(c => c.monster.stats.currentHp > 0);
  const bySpeedA = alive.filter(c => c.team === 'A')
    .sort((a, b) => (b.monster.stats.speed - a.monster.stats.speed) || a.monster.id.localeCompare(b.monster.id));
  const bySpeedB = alive.filter(c => c.team === 'B')
    .sort((a, b) => (b.monster.stats.speed - a.monster.stats.speed) || a.monster.id.localeCompare(b.monster.id));

  // Alternate: whichever side's front-runner is fastest goes first, then keep
  // alternating. When a side runs dry, the other side finishes solo.
  const order: Combatant[] = [];
  let firstIsA = (bySpeedA[0]?.monster.stats.speed ?? -1) >= (bySpeedB[0]?.monster.stats.speed ?? -1);
  while (bySpeedA.length || bySpeedB.length) {
    if (firstIsA) {
      if (bySpeedA.length) order.push(bySpeedA.shift()!);
      if (bySpeedB.length) order.push(bySpeedB.shift()!);
    } else {
      if (bySpeedB.length) order.push(bySpeedB.shift()!);
      if (bySpeedA.length) order.push(bySpeedA.shift()!);
    }
  }
  return order;
}

export function chebyshev(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}
