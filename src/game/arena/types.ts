/**
 * Arena types — tournaments, bets, replays, currency, rooms.
 *
 * The arena is a self-contained subsystem. Its state lives in localStorage
 * (see arena/state.ts) so it doesn't require reducer changes. Gold flows use
 * the existing ADD_TOWN_GOLD / SPEND_TOWN_GOLD actions.
 */
import type { Monster, UnlockedMonster, SpeciesType, ClassType, ElementType } from '@/game/types';

export type Cadence = 'daily' | 'weekly' | 'monthly';

export interface ArenaTeam {
  id: string;                 // stable — 'player_<ts>' or 'npc_<slug>'
  name: string;
  ownerId: 'player' | string; // 'player' or npc slug
  memberCombos: string[];     // comboIds; hydrated from unlockedMonsters at match time
  level: number;              // suggested team level (for NPC scaling)
  banner?: string;            // emoji or short label
  /** Optional strategy preset id (see arena/strategyPresets.ts). Defaults to 'balanced'. */
  strategyId?: string;
}

export interface ArenaBet {
  matchId: string;
  bettor: string;             // 'player' or 'npc_<n>'
  teamId: string;             // team bet on
  amount: number;             // gp
  placedAt: number;           // ms epoch
}

export interface ArenaBracketMatch {
  id: string;
  round: number;
  teamAId: string;
  teamBId: string;
  winnerId?: string;
  replayId?: string;
}

export interface ArenaTournament {
  id: string;
  cadence: Cadence;
  startsAt: number;           // ms epoch — countdown target
  resolved: boolean;
  teams: ArenaTeam[];         // 8 entries
  matches: ArenaBracketMatch[];
  seed: number;               // == floor(startsAt/1000)
}

export interface ArenaAnalyticsRow {
  ts: number;
  matchId: string;
  cadence: Cadence;
  winnerTeam: string;
  loserTeam: string;
  // per-monster snapshot
  monsters: Array<{
    id: string;
    team: 'A' | 'B';
    species: SpeciesType;
    classType: ClassType;
    element: ElementType;
    level: number;
    hpFracEnd: number;
    dmgDealt: number;
    dmgTaken: number;
    moveUses: Record<string, { uses: number; damage: number; crits: number }>;
    won: boolean;
  }>;
}

export interface ArenaReplay {
  id: string;
  matchId: string;
  cadence: Cadence;
  createdAt: number;
  seed: number;
  teamA: { id: string; name: string; monsters: SerializedMonster[] };
  teamB: { id: string; name: string; monsters: SerializedMonster[] };
  log: ReplayEvent[];         // full turn-by-turn log
  winner: 'A' | 'B' | 'draw';
  turns: number;
  roomId: string;
}

export interface SerializedMonster {
  id: string;
  name: string;
  species: SpeciesType;
  classType: ClassType;
  element: ElementType;
  level: number;
  maxHp: number;
  speed: number;
}

export interface ReplayEvent {
  turn: number;
  actorId: string;
  actorTeam: 'A' | 'B';
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  moveId?: string;
  moveName?: string;
  targetId?: string;
  damage?: number;
  crit?: boolean;
  dodged?: boolean;
  faint?: boolean;
  message: string;
  hpAfter: Record<string, number>;
}

export interface ArenaRoom {
  id: string;
  name: string;
  shape: 'oval' | 'circle' | 'rectangle';
  floorColor: string;         // hex or hsl
  rimColor: string;
  crowdDensity: number;       // 8..80
  crowdSpecies?: SpeciesType[]; // biases which sprites appear; falls back to all
}

export interface ArenaState {
  currency: number;                                 // arena tokens
  playerTeams: ArenaTeam[];                         // saved team presets
  tournaments: Record<Cadence, ArenaTournament>;
  bets: ArenaBet[];
  replays: ArenaReplay[];                           // ring-buffer, cap 40
  analytics: ArenaAnalyticsRow[];                   // ring-buffer, cap 5000
  purchasedItems: string[];                         // arena shop items already bought (unique)
  version: 1;
}

export const ARENA_STATE_KEY = 'menagerie_arena_v1';
export const REPLAY_CAP = 40;
export const ANALYTICS_CAP = 5000;

/** Cadence durations in ms — anchored to UTC epoch so every client agrees. */
export const CADENCE_MS: Record<Cadence, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

/** Next boundary for a cadence, relative to the UTC epoch. */
export function nextCadenceBoundary(cadence: Cadence, now: number = Date.now()): number {
  const step = CADENCE_MS[cadence];
  return Math.ceil(now / step) * step;
}

export type { Monster, UnlockedMonster };
