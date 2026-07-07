/**
 * Balance analytics — aggregates ArenaAnalyticsRow[] into by-dimension
 * summaries. Pure functions, safe to run over the full ring buffer.
 */
import type { ArenaAnalyticsRow } from './types';
import type { SpeciesType, ClassType, ElementType } from '@/game/types';

export interface DimensionStats {
  key: string;
  matches: number;
  wins: number;
  winRate: number;
  avgDmgDealt: number;
  avgDmgTaken: number;
}

function summarize<T extends string>(
  rows: ArenaAnalyticsRow[],
  pick: (m: ArenaAnalyticsRow['monsters'][number]) => T,
): DimensionStats[] {
  const acc = new Map<string, { matches: number; wins: number; dmg: number; taken: number }>();
  for (const r of rows) {
    for (const m of r.monsters) {
      const key = pick(m);
      const cur = acc.get(key) ?? { matches: 0, wins: 0, dmg: 0, taken: 0 };
      cur.matches += 1;
      if (m.won) cur.wins += 1;
      cur.dmg += m.dmgDealt;
      cur.taken += m.dmgTaken;
      acc.set(key, cur);
    }
  }
  return Array.from(acc.entries())
    .map(([key, v]) => ({
      key,
      matches: v.matches,
      wins: v.wins,
      winRate: v.matches ? v.wins / v.matches : 0,
      avgDmgDealt: v.matches ? v.dmg / v.matches : 0,
      avgDmgTaken: v.matches ? v.taken / v.matches : 0,
    }))
    .sort((a, b) => b.winRate - a.winRate);
}

export const byElement = (rows: ArenaAnalyticsRow[]) => summarize<ElementType>(rows, m => m.element);
export const byClass   = (rows: ArenaAnalyticsRow[]) => summarize<ClassType>(rows, m => m.classType);
export const bySpecies = (rows: ArenaAnalyticsRow[]) => summarize<SpeciesType>(rows, m => m.species);

export interface MoveStat {
  moveId: string;
  uses: number;
  totalDamage: number;
  avgDamage: number;
  crits: number;
  critRate: number;
}

export function byMove(rows: ArenaAnalyticsRow[]): MoveStat[] {
  const acc = new Map<string, { uses: number; damage: number; crits: number }>();
  for (const r of rows) for (const m of r.monsters) {
    for (const [moveId, mu] of Object.entries(m.moveUses)) {
      const cur = acc.get(moveId) ?? { uses: 0, damage: 0, crits: 0 };
      cur.uses += mu.uses;
      cur.damage += mu.damage;
      cur.crits += mu.crits;
      acc.set(moveId, cur);
    }
  }
  return Array.from(acc.entries())
    .map(([moveId, v]) => ({
      moveId,
      uses: v.uses,
      totalDamage: v.damage,
      avgDamage: v.uses ? v.damage / v.uses : 0,
      crits: v.crits,
      critRate: v.uses ? v.crits / v.uses : 0,
    }))
    .sort((a, b) => b.uses - a.uses);
}

/** Simple z-score outlier detection over win rate. Returns {high, low} tags. */
export function balanceSuggestions(rows: DimensionStats[], label: string): string[] {
  if (rows.length < 3) return [];
  const rates = rows.map(r => r.winRate);
  const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
  const variance = rates.reduce((a, b) => a + (b - mean) ** 2, 0) / rates.length;
  const sd = Math.sqrt(variance);
  const out: string[] = [];
  for (const r of rows) {
    if (sd === 0 || r.matches < 5) continue;
    const z = (r.winRate - mean) / sd;
    if (z > 1.2) out.push(`⚠️ ${label} "${r.key}" is over-performing (+${((r.winRate - mean) * 100).toFixed(1)}%) — consider a nerf.`);
    if (z < -1.2) out.push(`ℹ️ ${label} "${r.key}" is under-performing (${((r.winRate - mean) * 100).toFixed(1)}%) — consider a buff.`);
  }
  return out;
}
