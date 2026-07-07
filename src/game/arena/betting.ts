/**
 * Betting pool — seeded NPC bets + player bets, 5% house cut going to arena
 * currency for participants.
 */
import type { ArenaBet, ArenaBracketMatch } from './types';
import { mulberry32 } from '@/game/autobattle/seeded';

/** Deterministic seeded NPC bets on a match, in three "whale" tiers. */
export function seedNpcBets(match: ArenaBracketMatch, seed: number): ArenaBet[] {
  const rng = mulberry32(seed ^ hashId(match.id));
  const tiers = [1000, 10000, 100000];
  const bets: ArenaBet[] = [];
  tiers.forEach((amount, tierIdx) => {
    const splits = 3 + Math.floor(rng() * 3); // 3..5 distinct bettors per tier
    for (let i = 0; i < splits; i++) {
      const share = Math.max(1, Math.floor((amount / splits) * (0.7 + rng() * 0.6)));
      bets.push({
        matchId: match.id,
        bettor: `npc_whale_${tierIdx}_${i}`,
        teamId: rng() < 0.5 ? match.teamAId : match.teamBId,
        amount: share,
        placedAt: 0,
      });
    }
  });
  return bets;
}

function hashId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

export interface PoolTotals {
  totalPool: number;
  perTeam: Record<string, number>;
}

export function computePool(bets: ArenaBet[], match: ArenaBracketMatch): PoolTotals {
  const perTeam: Record<string, number> = { [match.teamAId]: 0, [match.teamBId]: 0 };
  let totalPool = 0;
  for (const b of bets) {
    if (b.matchId !== match.id) continue;
    perTeam[b.teamId] = (perTeam[b.teamId] ?? 0) + b.amount;
    totalPool += b.amount;
  }
  return { totalPool, perTeam };
}

export const HOUSE_CUT = 0.05;

/** Payout for a single bet given the resolved winner. Returns 0 if bet lost. */
export function payoutFor(bet: ArenaBet, match: ArenaBracketMatch, pool: PoolTotals, winnerId: string): number {
  if (bet.teamId !== winnerId) return 0;
  const winningSide = pool.perTeam[winnerId] || 0;
  if (winningSide <= 0) return bet.amount; // sole bettor edge case — return stake
  const distributable = Math.floor(pool.totalPool * (1 - HOUSE_CUT));
  return Math.floor((bet.amount / winningSide) * distributable);
}
