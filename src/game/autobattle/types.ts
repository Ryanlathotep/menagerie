import type { Monster } from '@/game/types';

/** A team is just an ordered list of monsters; index 0 is the "captain". */
export interface AutobattleTeam {
  /** Stable id — used in logs and result payloads (e.g. "playerA", "arena_slot_3"). */
  id: string;
  /** Optional display name for UI. */
  name?: string;
  /** Members in stat-priority order. Cloned by the resolver so caller state is safe. */
  members: Monster[];
}

export type AutobattleOutcome = 'A' | 'B' | 'draw';

export interface AutobattleLogEntry {
  turn: number;
  actor: string;        // Monster id
  actorTeam: 'A' | 'B';
  message: string;      // From executeCombat.message when a move was used
  target?: string;      // Monster id when a specific target was hit
  damage?: number;
  crit?: boolean;
  faint?: boolean;      // True when this action fainted the target
}

export interface AutobattleResult {
  winner: AutobattleOutcome;
  turns: number;
  seed: number;
  /** Ids of monsters that reached 0 HP during the match, in defeat order. */
  casualties: string[];
  /** Highest total damage dealt by any single monster this match. */
  mvpId: string | null;
  mvpDamage: number;
  log: AutobattleLogEntry[];
}

export interface AutobattleOptions {
  seed?: number;
  /** Hard cap on turn iterations before we declare a draw. */
  maxTurns?: number;
  /** When true, includes every miss/heal message; when false, only impactful entries. */
  verbose?: boolean;
}
