/**
 * Tournament resolution — builds a bracket, hydrates NPC teams, runs the
 * arena combat engine per match, records replays + analytics, and computes
 * bet payouts.
 */
import type { Monster, UnlockedMonster } from '@/game/types';
import type {
  ArenaBracketMatch, ArenaReplay, ArenaState, ArenaTeam, ArenaTournament,
  ArenaAnalyticsRow, ArenaBet, Cadence, SerializedMonster,
} from './types';
import { hydrateNpcTeam, isNpcTeam } from './npcTeams';
import { computePool, payoutFor, seedNpcBets } from './betting';
import { runArenaCombat } from '@/game/arenaCombat';
import { getRoom, getAllRooms } from './arenaRooms';
import { createMonster } from '@/game/utils';

function buildBracket(teams: ArenaTeam[], seed: number): ArenaBracketMatch[] {
  const matches: ArenaBracketMatch[] = [];
  // Round 1 — 4 matches (assumes 8 teams; fillTournamentWithNpcs guarantees).
  for (let i = 0; i < teams.length; i += 2) {
    matches.push({
      id: `m${seed}_r1_${i / 2}`,
      round: 1,
      teamAId: teams[i].id,
      teamBId: teams[i + 1].id,
    });
  }
  return matches;
}

function hydratePlayerTeam(team: ArenaTeam, unlocked: UnlockedMonster[]): Monster[] {
  return team.memberCombos.slice(0, 6).map(combo => {
    const found = unlocked.find(u => u.comboId === combo);
    if (found) {
      return createMonster(found.species, found.classType, found.element, Math.max(5, found.level), found.equipment, found.experience, found.moveMastery);
    }
    // Fallback if combo missing — reconstruct from combo id
    const [species, element, classType] = combo.split('_') as any;
    return createMonster(species, classType, element, team.level);
  });
}

function serialize(m: Monster): SerializedMonster {
  return {
    id: m.id, name: m.name,
    species: m.species, classType: m.class, element: m.element,
    level: m.level, maxHp: m.stats.maxHp, speed: m.stats.speed,
  };
}

interface ResolveResult {
  state: ArenaState;
  replays: ArenaReplay[];
  winnerId?: string;
  payoutsToPlayer: number;
}

export function resolveTournament(
  state: ArenaState,
  cadence: Cadence,
  unlocked: UnlockedMonster[],
): ResolveResult {
  const t = state.tournaments[cadence];
  if (t.resolved || t.teams.length < 2) return { state, replays: [], payoutsToPlayer: 0 };

  const teams = t.teams;
  let bracket = t.matches.length ? t.matches : buildBracket(teams, t.seed);
  const replays: ArenaReplay[] = [];
  const analytics: ArenaAnalyticsRow[] = [];
  let bets = state.bets.filter(b => bracket.some(m => m.id === b.matchId));

  // Seed NPC bets for any match that doesn't have any yet
  for (const m of bracket) {
    if (!bets.some(b => b.matchId === m.id)) {
      bets = [...bets, ...seedNpcBets(m, t.seed)];
    }
  }

  const allRooms = getAllRooms();
  const pickRoom = (matchId: string) => {
    const idx = (hashId(matchId) ^ t.seed) % allRooms.length;
    return allRooms[Math.abs(idx)];
  };
  let payoutsToPlayer = 0;
  let currencyGained = 0;
  let bracketWinnerId: string | undefined;

  // Iterate through rounds until we have a winner (single elimination)
  const teamById = new Map<string, ArenaTeam>();
  teams.forEach(tm => teamById.set(tm.id, tm));

  let currentMatches = bracket;
  let round = 1;
  while (currentMatches.length > 0) {
    const roundWinners: ArenaTeam[] = [];
    for (const match of currentMatches) {
      const aTeam = teamById.get(match.teamAId)!;
      const bTeam = teamById.get(match.teamBId)!;
      const targetLevel = Math.max(aTeam.level, bTeam.level, 5);
      const membersA = isNpcTeam(aTeam.id.replace(/_dup\d+$/, '')) ? hydrateNpcTeam({ ...aTeam, id: aTeam.id.replace(/_dup\d+$/, '') }, targetLevel) : hydratePlayerTeam(aTeam, unlocked);
      const membersB = isNpcTeam(bTeam.id.replace(/_dup\d+$/, '')) ? hydrateNpcTeam({ ...bTeam, id: bTeam.id.replace(/_dup\d+$/, '') }, targetLevel) : hydratePlayerTeam(bTeam, unlocked);

      const result = runArenaCombat(
        { id: aTeam.id, name: aTeam.name, members: membersA },
        { id: bTeam.id, name: bTeam.name, members: membersB },
        { seed: (t.seed ^ hashId(match.id)) >>> 0, gridWidth: 6, gridHeight: 6 },
      );
      const winnerTeam = result.winner === 'A' ? aTeam : result.winner === 'B' ? bTeam : aTeam; // draw → default to A
      match.winnerId = winnerTeam.id;

      const replay: ArenaReplay = {
        id: `replay_${match.id}`,
        matchId: match.id,
        cadence,
        createdAt: Date.now(),
        seed: result.seed,
        teamA: { id: aTeam.id, name: aTeam.name, monsters: membersA.map(serialize) },
        teamB: { id: bTeam.id, name: bTeam.name, monsters: membersB.map(serialize) },
        log: result.log,
        winner: result.winner,
        turns: result.turns,
        roomId: pickRoom(match.id).id,
      };
      match.replayId = replay.id;
      replays.push(replay);

      // Analytics
      analytics.push({
        ts: Date.now(),
        matchId: match.id,
        cadence,
        winnerTeam: winnerTeam.id,
        loserTeam: winnerTeam === aTeam ? bTeam.id : aTeam.id,
        monsters: [
          ...membersA.map(m => ({
            id: m.id, team: 'A' as const, species: m.species, classType: m.class, element: m.element, level: m.level,
            hpFracEnd: (result.finalHp[m.id] ?? 0) / Math.max(1, m.stats.maxHp),
            dmgDealt: result.perMonster[m.id]?.dmgDealt ?? 0,
            dmgTaken: result.perMonster[m.id]?.dmgTaken ?? 0,
            moveUses: result.perMonster[m.id]?.moveUses ?? {},
            won: winnerTeam === aTeam,
          })),
          ...membersB.map(m => ({
            id: m.id, team: 'B' as const, species: m.species, classType: m.class, element: m.element, level: m.level,
            hpFracEnd: (result.finalHp[m.id] ?? 0) / Math.max(1, m.stats.maxHp),
            dmgDealt: result.perMonster[m.id]?.dmgDealt ?? 0,
            dmgTaken: result.perMonster[m.id]?.dmgTaken ?? 0,
            moveUses: result.perMonster[m.id]?.moveUses ?? {},
            won: winnerTeam === bTeam,
          })),
        ],
      });

      // Bet payouts for this match
      const pool = computePool(bets, match);
      for (const bet of bets.filter(b => b.matchId === match.id)) {
        const payout = payoutFor(bet, match, pool, winnerTeam.id);
        if (payout > 0 && bet.bettor === 'player') {
          payoutsToPlayer += payout;
        }
        if (bet.bettor === 'player') {
          currencyGained += 1; // token for placing a bet
        }
      }

      // Award tokens for player participation
      if (aTeam.ownerId === 'player' || bTeam.ownerId === 'player') {
        currencyGained += 5; // entered a team
        if (winnerTeam.ownerId === 'player') currencyGained += 10; // won a match
      }

      roundWinners.push(winnerTeam);
    }

    if (roundWinners.length === 1) {
      bracketWinnerId = roundWinners[0].id;
      if (roundWinners[0].ownerId === 'player') currencyGained += 50;
      break;
    }
    // Build next round
    round++;
    currentMatches = [];
    for (let i = 0; i < roundWinners.length; i += 2) {
      const m: ArenaBracketMatch = {
        id: `m${t.seed}_r${round}_${i / 2}`,
        round,
        teamAId: roundWinners[i].id,
        teamBId: roundWinners[i + 1].id,
      };
      currentMatches.push(m);
      bracket = [...bracket, m];
    }
  }

  const nextState: ArenaState = {
    ...state,
    currency: state.currency + currencyGained,
    tournaments: {
      ...state.tournaments,
      [cadence]: { ...t, matches: bracket, resolved: true } as ArenaTournament,
    },
    bets,
    replays: [...state.replays, ...replays],
    analytics: [...state.analytics, ...analytics],
  };

  return { state: nextState, replays, winnerId: bracketWinnerId, payoutsToPlayer };
}

function hashId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h >>> 0;
}
