import { describe, it, expect } from 'vitest';
import { autoStrategy, pickMovementDestination } from './strategy';
import type { TacticInput, Combatant } from './types';
import type { Move } from '@/game/moves';
import type { Monster } from '@/game/types';

function mon(id: string, over: Partial<Monster> = {}): Monster {
  return {
    id,
    name: id,
    species: 'slime',
    element: 'normal',
    class: 'normal',
    level: 20,
    experience: 0,
    stats: {
      maxHp: 100, currentHp: 100, attack: 20, defense: 10, special: 10,
      speed: 10, dexterity: 10, stamina: 50, currentStamina: 50,
    },
    ...over,
  } as unknown as Monster;
}

const dash: Move = {
  id: 'test-dash', name: 'Test Dash', description: 'dash', type: 'movement',
  power: 0, accuracy: 100, staminaCost: 5, speedMod: 0, aspects: ['species'],
  unlockLevel: 1,
  movement: { offsets: [{ dx: 4, dy: 0 }, { dx: -4, dy: 0 }], range: 4 },
} as unknown as Move;

function input(selfPos = { x: 0, y: 0 }, foePos = { x: 8, y: 0 }, blocked: string[] = []): TacticInput {
  const self: Combatant = { monster: mon('self'), team: 'A', pos: selfPos } as Combatant;
  const foe: Combatant = { monster: mon('foe'), team: 'B', pos: foePos } as Combatant;
  return {
    self, allies: [], enemies: [foe],
    distance: (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)),
    grid: { width: 24, height: 24 },
    isBlocked: (p) => blocked.includes(`${p.x},${p.y}`),
    isOccupied: (p) => p.x === foePos.x && p.y === foePos.y,
    turn: 1,
  };
}

describe('arena movement skills', () => {
  it('picks the offset that closes distance to the focus target', () => {
    const dest = pickMovementDestination(dash, { x: 0, y: 0 }, { x: 8, y: 0 }, input());
    expect(dest).toEqual({ x: 4, y: 0 });
  });

  it('rejects landing tiles that are walls', () => {
    const inp = input({ x: 0, y: 0 }, { x: 8, y: 0 }, ['4,0', '2,0']);
    const dest = pickMovementDestination(dash, { x: 0, y: 0 }, { x: 8, y: 0 }, inp);
    // Forward landing tile is a wall and the path is blocked → only backward left,
    // which is off-grid from x=0, so no legal destination.
    expect(dest).toBeNull();
  });

  it('never returns a decision that steps into a wall', () => {
    const inp = input({ x: 0, y: 0 }, { x: 3, y: 0 }, ['1,0', '1,1', '0,1']);
    const d = autoStrategy(inp);
    if (d.moveTo) expect(inp.isBlocked(d.moveTo)).toBe(false);
  });
});
