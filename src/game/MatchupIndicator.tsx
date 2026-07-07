// Matchup arrows shown above enemies indicating effectiveness vs the active player monster
// ▲ (green) = player has advantage; ▼ (red) = player is at disadvantage; both = mixed
import { ElementType, ClassType, ELEMENT_ADVANTAGES, CLASS_ADVANTAGES_CORRECTED } from './types';

export interface MatchupIndicatorProps {
  playerElement?: ElementType;
  playerClass?: ClassType;
  enemyElement: ElementType;
  enemyClass: ClassType;
  size?: number; // Container size used for scaling
}

export function getMatchup(
  playerElement: ElementType | undefined,
  playerClass: ClassType | undefined,
  enemyElement: ElementType,
  enemyClass: ClassType,
) {
  if (!playerElement || !playerClass) {
    return { strong: false, weak: false };
  }
  const playerBeatsElement = ELEMENT_ADVANTAGES[playerElement]?.includes(enemyElement) || false;
  const enemyBeatsElement = ELEMENT_ADVANTAGES[enemyElement]?.includes(playerElement) || false;
  const playerBeatsClass = CLASS_ADVANTAGES_CORRECTED[playerClass]?.includes(enemyClass) || false;
  const enemyBeatsClass = CLASS_ADVANTAGES_CORRECTED[enemyClass]?.includes(playerClass) || false;
  return {
    strong: playerBeatsElement || playerBeatsClass,
    weak: enemyBeatsElement || enemyBeatsClass,
  };
}

// Numeric matchup score for picking the best swap-in against an enemy.
// +1 per player advantage (element / class), -1 per enemy advantage.
// Range: [-2, +2]. Higher is better.
export function matchupScore(
  playerElement: ElementType | undefined,
  playerClass: ClassType | undefined,
  enemyElement: ElementType,
  enemyClass: ClassType,
): number {
  if (!playerElement || !playerClass) return 0;
  const pe = ELEMENT_ADVANTAGES[playerElement]?.includes(enemyElement) ? 1 : 0;
  const ee = ELEMENT_ADVANTAGES[enemyElement]?.includes(playerElement) ? 1 : 0;
  const pc = CLASS_ADVANTAGES_CORRECTED[playerClass]?.includes(enemyClass) ? 1 : 0;
  const ec = CLASS_ADVANTAGES_CORRECTED[enemyClass]?.includes(playerClass) ? 1 : 0;
  return pe + pc - ee - ec;
}

// Find the party member with the best matchup score vs an enemy. Skips the
// current active monster and any fainted party members. Returns null when no
// conscious alternative is strictly better than what's already out.
export function findBestMatchupSwap<T extends { element: ElementType; class: ClassType; stats: { currentHp: number } }>(
  party: T[] | undefined,
  activeIndex: number,
  enemyElement: ElementType,
  enemyClass: ClassType,
): { index: number; member: T; score: number; currentScore: number } | null {
  if (!party || party.length === 0) return null;
  const active = party[activeIndex];
  const currentScore = active ? matchupScore(active.element, active.class, enemyElement, enemyClass) : -Infinity;
  let best: { index: number; member: T; score: number } | null = null;
  for (let i = 0; i < party.length; i++) {
    if (i === activeIndex) continue;
    const m = party[i];
    if (!m || m.stats.currentHp <= 0) continue;
    const s = matchupScore(m.element, m.class, enemyElement, enemyClass);
    if (!best || s > best.score) best = { index: i, member: m, score: s };
  }
  if (!best) return null;
  if (best.score <= currentScore) return null;
  return { ...best, currentScore };
}


export function MatchupIndicator({
  playerElement,
  playerClass,
  enemyElement,
  enemyClass,
  size = 40,
}: MatchupIndicatorProps) {
  const { strong, weak } = getMatchup(playerElement, playerClass, enemyElement, enemyClass);
  if (!strong && !weak) return null;

  const fontSize = Math.max(10, Math.floor(size * 0.32));

  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 pointer-events-none flex gap-0.5 z-20 select-none"
      style={{
        top: -Math.floor(size * 0.12),
        fontSize,
        lineHeight: 1,
        textShadow: '0 0 3px rgba(0,0,0,0.85), 0 1px 2px rgba(0,0,0,0.9)',
      }}
      aria-label={strong && weak ? 'Mixed matchup' : strong ? 'You have advantage' : 'You are weak'}
    >
      {strong && (
        <span className="font-bold animate-pulse" style={{ color: 'hsl(142 71% 45%)' }}>▲</span>
      )}
      {weak && (
        <span className="font-bold animate-pulse" style={{ color: 'hsl(0 84% 60%)' }}>▼</span>
      )}
    </div>
  );
}
