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
