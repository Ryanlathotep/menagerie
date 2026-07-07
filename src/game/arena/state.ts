/**
 * localStorage-backed arena state. Kept out of the main reducer so this whole
 * subsystem can iterate without risk to shipped map/dungeon systems.
 */
import {
  ARENA_STATE_KEY, ANALYTICS_CAP, REPLAY_CAP,
  type ArenaState, type ArenaAnalyticsRow, type ArenaReplay,
  type Cadence, type ArenaTournament, nextCadenceBoundary,
} from './types';
import { getNpcTeams } from './npcTeams';

function emptyTournament(cadence: Cadence, now: number = Date.now()): ArenaTournament {
  const startsAt = nextCadenceBoundary(cadence, now);
  return {
    id: `${cadence}_${startsAt}`,
    cadence,
    startsAt,
    resolved: false,
    teams: [],
    matches: [],
    seed: Math.floor(startsAt / 1000),
  };
}

export function getDefaultArenaState(): ArenaState {
  return {
    currency: 0,
    playerTeams: [],
    tournaments: {
      daily: emptyTournament('daily'),
      weekly: emptyTournament('weekly'),
      monthly: emptyTournament('monthly'),
    },
    bets: [],
    replays: [],
    analytics: [],
    purchasedItems: [],
    version: 1,
  };
}

export function loadArenaState(): ArenaState {
  try {
    const raw = localStorage.getItem(ARENA_STATE_KEY);
    if (!raw) return getDefaultArenaState();
    const parsed = JSON.parse(raw) as ArenaState;
    if (parsed?.version !== 1) return getDefaultArenaState();
    // Backfill missing fields
    return {
      ...getDefaultArenaState(),
      ...parsed,
      tournaments: {
        daily: parsed.tournaments?.daily ?? emptyTournament('daily'),
        weekly: parsed.tournaments?.weekly ?? emptyTournament('weekly'),
        monthly: parsed.tournaments?.monthly ?? emptyTournament('monthly'),
      },
    };
  } catch {
    return getDefaultArenaState();
  }
}

export function saveArenaState(s: ArenaState) {
  try {
    // Enforce ring buffers
    const capped: ArenaState = {
      ...s,
      analytics: s.analytics.slice(-ANALYTICS_CAP),
      replays: s.replays.slice(-REPLAY_CAP),
    };
    localStorage.setItem(ARENA_STATE_KEY, JSON.stringify(capped));
  } catch (e) {
    console.warn('[arena] save failed', e);
  }
}

/** Roll over any tournaments whose scheduled time is in the past. */
export function ensureFutureTournament(s: ArenaState, cadence: Cadence, now: number = Date.now()): ArenaState {
  const t = s.tournaments[cadence];
  if (t.startsAt > now) return s;
  return {
    ...s,
    tournaments: { ...s.tournaments, [cadence]: emptyTournament(cadence, now) },
  };
}

export function addAnalytics(s: ArenaState, row: ArenaAnalyticsRow): ArenaState {
  return { ...s, analytics: [...s.analytics, row].slice(-ANALYTICS_CAP) };
}

export function addReplay(s: ArenaState, replay: ArenaReplay): ArenaState {
  return { ...s, replays: [...s.replays, replay].slice(-REPLAY_CAP) };
}

/** Populate empty tournament slots with NPC teams + rotated fillers. */
export function fillTournamentWithNpcs(t: ArenaTournament): ArenaTournament {
  if (t.teams.length >= 8) return t;
  const npcs = getNpcTeams();
  const filled = [...t.teams];
  let i = 0;
  while (filled.length < 8) {
    const source = npcs[i % npcs.length];
    filled.push({
      ...source,
      // dedupe id when repeating an NPC
      id: filled.some(x => x.id === source.id) ? `${source.id}_dup${i}` : source.id,
      name: filled.some(x => x.name === source.name) ? `${source.name} #${Math.floor(i / npcs.length) + 2}` : source.name,
    });
    i++;
  }
  return { ...t, teams: filled };
}
