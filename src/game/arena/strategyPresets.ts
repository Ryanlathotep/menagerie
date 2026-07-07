/**
 * Rule-based team strategy presets. Players pick from these instead of
 * writing code — safe, deterministic, and diffable in replays.
 */
import type { TacticInput, TacticDecision, TeamStrategy } from '@/game/arenaCombat/types';
import { autoStrategy } from '@/game/arenaCombat/strategy';
import { chebyshev } from '@/game/arenaCombat/turnOrder';

export type StrategyPresetId =
  | 'balanced'          // default AI
  | 'focus_weakest'     // always attack the lowest-HP enemy
  | 'focus_strongest'   // always attack the highest-max-HP enemy
  | 'kite'              // prefer ranged moves, keep distance
  | 'rush'              // move toward nearest, use highest-damage move
  | 'support_first';    // heal/buff allies below 60% before attacking

export interface StrategyPresetMeta {
  id: StrategyPresetId;
  label: string;
  description: string;
}

export const STRATEGY_PRESETS: StrategyPresetMeta[] = [
  { id: 'balanced',        label: '⚖️ Balanced',        description: 'Default archetype AI — smart move scoring.' },
  { id: 'focus_weakest',   label: '🎯 Focus Weakest',   description: 'Always target the lowest-HP enemy.' },
  { id: 'focus_strongest', label: '💥 Focus Strongest', description: 'Always target the highest-max-HP enemy.' },
  { id: 'kite',            label: '🏹 Kite',            description: 'Prefer ranged moves and keep distance.' },
  { id: 'rush',            label: '⚡ Rush',            description: 'Close distance and use highest-damage move.' },
  { id: 'support_first',   label: '💚 Support First',   description: 'Heal/buff allies below 60% HP first.' },
];

// ─── Preset resolvers ───

function pickTarget(input: TacticInput, mode: 'weakest' | 'strongest' | 'nearest'): typeof input.enemies[0] | null {
  const alive = input.enemies.filter(e => e.monster.stats.currentHp > 0);
  if (!alive.length) return null;
  if (mode === 'weakest') return [...alive].sort((a, b) => a.monster.stats.currentHp - b.monster.stats.currentHp)[0];
  if (mode === 'strongest') return [...alive].sort((a, b) => b.monster.stats.maxHp - a.monster.stats.maxHp)[0];
  return [...alive].sort((a, b) => chebyshev(a.pos, input.self.pos) - chebyshev(b.pos, input.self.pos))[0];
}

function stepToward(from: { x: number; y: number }, to: { x: number; y: number }, grid: { width: number; height: number }) {
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);
  return { x: Math.max(0, Math.min(grid.width - 1, from.x + dx)), y: Math.max(0, Math.min(grid.height - 1, from.y + dy)) };
}

function stepAway(from: { x: number; y: number }, to: { x: number; y: number }, grid: { width: number; height: number }) {
  const dx = -Math.sign(to.x - from.x);
  const dy = -Math.sign(to.y - from.y);
  return { x: Math.max(0, Math.min(grid.width - 1, from.x + dx)), y: Math.max(0, Math.min(grid.height - 1, from.y + dy)) };
}

function pickMove(input: TacticInput, filter: (m: any) => boolean, score: (m: any) => number) {
  const moves = (input.self.monster.moves ?? []).filter(filter);
  if (!moves.length) return undefined;
  return [...moves].sort((a, b) => score(b) - score(a))[0];
}

const focusTarget = (mode: 'weakest' | 'strongest'): TeamStrategy => (input) => {
  const target = pickTarget(input, mode);
  if (!target) return {};
  const dist = chebyshev(input.self.pos, target.pos);
  const move = pickMove(input,
    m => (m.type !== 'buff' && m.type !== 'heal') && (input.self.monster.stats.currentStamina ?? 0) >= (m.staminaCost ?? 0),
    m => (m.power ?? 0) + (m.aoeRadius ?? 0) * 5,
  );
  if (!move) return { moveTo: stepToward(input.self.pos, target.pos, input.grid) };
  const isRanged = move.type === 'ranged' || (move.aoeRadius ?? 0) > 0;
  if (!isRanged && dist > 1) return { moveTo: stepToward(input.self.pos, target.pos, input.grid) };
  return { move, targetId: target.monster.id };
};

const kite: TeamStrategy = (input) => {
  const target = pickTarget(input, 'nearest');
  if (!target) return {};
  const dist = chebyshev(input.self.pos, target.pos);
  const rangedMove = pickMove(input, m => m.type === 'ranged' || (m.aoeRadius ?? 0) > 0, m => m.power ?? 0);
  if (dist < 3) return { moveTo: stepAway(input.self.pos, target.pos, input.grid) };
  if (rangedMove) return { move: rangedMove, targetId: target.monster.id };
  return autoStrategy(input);
};

const rush: TeamStrategy = (input) => {
  const target = pickTarget(input, 'nearest');
  if (!target) return {};
  const dist = chebyshev(input.self.pos, target.pos);
  const move = pickMove(input, m => m.type !== 'buff' && m.type !== 'heal', m => (m.power ?? 0));
  if (!move) return { moveTo: stepToward(input.self.pos, target.pos, input.grid) };
  const isRanged = move.type === 'ranged' || (move.aoeRadius ?? 0) > 0;
  if (!isRanged && dist > 1) return { moveTo: stepToward(input.self.pos, target.pos, input.grid) };
  return { move, targetId: target.monster.id };
};

const supportFirst: TeamStrategy = (input) => {
  const woundedAlly = input.allies.find(a => a.monster.id !== input.self.monster.id
    && a.monster.stats.currentHp > 0
    && a.monster.stats.currentHp / Math.max(1, a.monster.stats.maxHp) < 0.6);
  if (woundedAlly) {
    const healMove = (input.self.monster.moves ?? []).find(m => m.type === 'heal');
    if (healMove) return { move: healMove, targetId: woundedAlly.monster.id };
  }
  return autoStrategy(input);
};

export function resolveStrategy(id: StrategyPresetId | undefined): TeamStrategy {
  switch (id) {
    case 'focus_weakest':   return focusTarget('weakest');
    case 'focus_strongest': return focusTarget('strongest');
    case 'kite':            return kite;
    case 'rush':            return rush;
    case 'support_first':   return supportFirst;
    case 'balanced':
    default:                return autoStrategy;
  }
}
