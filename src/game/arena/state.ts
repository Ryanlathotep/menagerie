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

/** Fill NPC slots and lock in stable round-1 match ids so bets placed before
 *  resolution attach to the SAME matches the resolver will run. */
export function commitTournamentBracket(t: ArenaTournament): ArenaTournament {
  if (t.resolved) return t;
  const filled = fillTournamentWithNpcs(t);
  const laterRounds = filled.matches.filter(m => m.round > 1);
  const r1 = [];
  for (let i = 0; i + 1 < filled.teams.length; i += 2) {
    const existing = filled.matches.find(m => m.round === 1 && m.id === `m${t.seed}_r1_${i / 2}`);
    r1.push({
      id: `m${t.seed}_r1_${i / 2}`,
      round: 1,
      teamAId: filled.teams[i].id,
      teamBId: filled.teams[i + 1].id,
      winnerId: existing?.winnerId,
      replayId: existing?.replayId,
    });
  }
  return { ...filled, matches: [...r1, ...laterRounds] };
}

export function addAnalytics(s: ArenaState, row: ArenaAnalyticsRow): ArenaState {
  return { ...s, analytics: [...s.analytics, row].slice(-ANALYTICS_CAP) };
}

export function addReplay(s: ArenaState, replay: ArenaReplay): ArenaState {
  return { ...s, replays: [...s.replays, replay].slice(-REPLAY_CAP) };
}

/** Populate empty tournament slots with NPC teams + rotated fillers.
 *  Player-owned teams are pinned to slot 0 so they always appear in R1 match 0. */
export function fillTournamentWithNpcs(t: ArenaTournament): ArenaTournament {
  if (t.teams.length >= 8) {
    // Still re-sort so player team leads.
    const sorted = [...t.teams].sort((a, b) => (a.ownerId === 'player' ? -1 : b.ownerId === 'player' ? 1 : 0));
    return { ...t, teams: sorted };
  }
  const npcs = getNpcTeams();
  const filled = [...t.teams].sort((a, b) => (a.ownerId === 'player' ? -1 : b.ownerId === 'player' ? 1 : 0));
  let i = 0;
  while (filled.length < 8) {
    const source = npcs[i % npcs.length];
    filled.push({
      ...source,
      id: filled.some(x => x.id === source.id) ? `${source.id}_dup${i}` : source.id,
      name: filled.some(x => x.name === source.name) ? `${source.name} #${Math.floor(i / npcs.length) + 2}` : source.name,
    });
    i++;
  }
  return { ...t, teams: filled };
}
