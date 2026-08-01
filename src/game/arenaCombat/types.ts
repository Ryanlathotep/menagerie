/**
 * Types for the alternating-turn 6x6 combat engine. Parallel to the existing
 * map/dungeon combat — reuses combat.ts.executeCombat under the hood but adds
 * team scheduling, positions, and a serializable replay log.
 */
import type { Monster } from '@/game/types';
import type { Move } from '@/game/moves';
import type { ReplayEvent } from '@/game/arena/types';

export type TeamMode = 'solo' | 'duo' | 'trio' | 'full';

export interface Position { x: number; y: number; }

export interface Combatant {
  monster: Monster;             // mutated during the match (cloned inputs)
  team: 'A' | 'B';
  pos: Position;
}

export interface ArenaCombatTeam {
  id: string;
  name: string;
  members: Monster[];           // will be deep-cloned
  strategy?: TeamStrategy;      // defaults to autoStrategy
}

export interface TacticInput {
  self: Combatant;
  allies: Combatant[];
  enemies: Combatant[];
  distance: (a: Position, b: Position) => number;
  grid: { width: number; height: number };
  turn: number;
}

export interface TacticDecision {
  move?: Move;                  // undefined => rest / pass
  targetId?: string;            // enemy id for damage moves; ally id for heals
  moveTo?: Position;            // if set, step one tile toward this (limited by move speed)
}

export type TeamStrategy = (input: TacticInput) => TacticDecision;

export interface ArenaCombatOptions {
  seed?: number;
  gridWidth?: number;   // default 24
  gridHeight?: number;  // default 24
  maxTurns?: number;    // default 480 total combatant actions
  /** Impassable tiles (walls from a room prefab). */
  blockedCells?: Position[];
}

export interface ArenaCombatResult {
  winner: 'A' | 'B' | 'draw';
  turns: number;
  log: ReplayEvent[];
  seed: number;
  survivorsA: string[];
  survivorsB: string[];
  finalHp: Record<string, number>;
  /** Per-monster damage totals — used to build ArenaAnalyticsRow. */
  perMonster: Record<string, { dmgDealt: number; dmgTaken: number; moveUses: Record<string, { uses: number; damage: number; crits: number }> }>;
}
