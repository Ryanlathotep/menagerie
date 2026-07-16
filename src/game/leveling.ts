import { Monster, MonsterStats } from './types';
import { Move, getNewMovesAtLevel } from './moves';
import { xpToNextLevel } from './combat';
import { calculateStats } from './utils';

export interface LevelProgressResult {
  monster: Monster;
  xpRemaining: number;
  leveled: boolean;
  previousLevel: number;
  previousStats: MonsterStats;
  levelsGained: number;
  newMoves: Move[];
}

export function applyXpProgress(monster: Monster, currentXp: number, xpGained: number): LevelProgressResult {
  let xpRemaining = Math.max(0, currentXp + xpGained);
  let level = Math.max(1, Math.floor(monster.level || 1));
  let stats = { ...monster.stats };
  const previousLevel = level;
  const previousStats = { ...monster.stats };
  const hpPercent = monster.stats.maxHp > 0
    ? Math.max(0, monster.stats.currentHp / monster.stats.maxHp)
    : 1;
  const staminaMax = monster.stats.stamina || 50;
  const staminaPercent = staminaMax > 0
    ? Math.max(0, (monster.stats.currentStamina ?? staminaMax) / staminaMax)
    : 1;
  const newMoves: Move[] = [];

  while (xpRemaining >= xpToNextLevel(level)) {
    xpRemaining -= xpToNextLevel(level);
    level += 1;

    const nextStats = calculateStats(monster.species, monster.class, level);
    stats = {
      ...nextStats,
      currentHp: Math.max(1, Math.ceil(nextStats.maxHp * hpPercent)),
      currentStamina: Math.max(0, Math.ceil(nextStats.stamina * staminaPercent)),
    };

    newMoves.push(...getNewMovesAtLevel(monster.species, monster.element, monster.class, level));
  }

  const leveled = level > previousLevel;
  return {
    monster: leveled ? { ...monster, level, stats, experience: xpRemaining } : { ...monster, experience: xpRemaining },
    xpRemaining,
    leveled,
    previousLevel,
    previousStats,
    levelsGained: level - previousLevel,
    newMoves,
  };
}
