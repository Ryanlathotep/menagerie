// Attack Targeting Overlay - Shows attack patterns when aiming on the dungeon map

import { Position } from './types';
import { Move } from './moves';
import { EvolvedMove } from './moveMastery';
import { 
  AttackConfig, 
  getAttackConfig, 
  getAffectedTiles, 
  getValidTargets,
  isInRange 
} from './dungeonCombat';

interface AttackTargetingProps {
  playerPos: Position;
  selectedMove: Move | EvolvedMove;
  cursorPos: Position | null;
  dungeonWidth: number;
  dungeonHeight: number;
  tiles: import('./types').DungeonTile[][];
  tileSize: number;
  onFire: (target: Position, affectedTiles: Position[]) => void;
  onCancel: () => void;
}

export function AttackTargeting({
  playerPos,
  selectedMove,
  cursorPos,
  dungeonWidth,
  dungeonHeight,
  tiles,
  tileSize,
  onFire,
  onCancel,
}: AttackTargetingProps) {
  const config = getAttackConfig(selectedMove);
  const validTargets = getValidTargets(playerPos, config, tiles, dungeonWidth, dungeonHeight, true);
  
  // Get affected tiles based on cursor position
  const affectedTiles = cursorPos 
    ? getAffectedTiles(playerPos, cursorPos, config, dungeonWidth, dungeonHeight)
    : [];
  
  // Check if cursor is on a valid target
  const isValidTarget = cursorPos && validTargets.some(t => t.x === cursorPos.x && t.y === cursorPos.y);
  const cursorInRange = cursorPos && isInRange(playerPos, cursorPos, config.range);
  
  return (
    <>
      {/* Range indicator overlay */}
      {validTargets.map(pos => (
        <div
          key={`range-${pos.x}-${pos.y}`}
          className="absolute pointer-events-none border border-primary/30 bg-primary/10 z-10"
          style={{
            left: pos.x * tileSize,
            top: pos.y * tileSize,
            width: tileSize,
            height: tileSize,
          }}
        />
      ))}
      
      {/* Affected tiles preview (when hovering) */}
      {cursorInRange && affectedTiles.map(pos => (
        <div
          key={`affected-${pos.x}-${pos.y}`}
          className={`absolute pointer-events-none z-20 ${
            isValidTarget 
              ? 'bg-destructive/40 border-2 border-destructive' 
              : 'bg-muted/40 border border-muted-foreground/50'
          }`}
          style={{
            left: pos.x * tileSize,
            top: pos.y * tileSize,
            width: tileSize,
            height: tileSize,
          }}
        >
          {/* Attack indicator icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm animate-pulse">⚔️</span>
          </div>
        </div>
      ))}
      
      {/* Player origin indicator */}
      <div
        className="absolute pointer-events-none z-15 ring-2 ring-primary ring-offset-1 ring-offset-background rounded-sm"
        style={{
          left: playerPos.x * tileSize,
          top: playerPos.y * tileSize,
          width: tileSize,
          height: tileSize,
        }}
      />
      
      {/* Cursor highlight */}
      {cursorPos && cursorInRange && (
        <div
          className={`absolute pointer-events-none z-25 ring-4 ${
            isValidTarget ? 'ring-destructive' : 'ring-muted-foreground/50'
          } rounded-sm`}
          style={{
            left: cursorPos.x * tileSize,
            top: cursorPos.y * tileSize,
            width: tileSize,
            height: tileSize,
          }}
        />
      )}
    </>
  );
}

// Move info panel shown when targeting
interface MoveInfoPanelProps {
  move: Move | EvolvedMove;
  onCancel: () => void;
}

export function MoveInfoPanel({ move, onCancel }: MoveInfoPanelProps) {
  const config = getAttackConfig(move);
  
  const patternLabels: Record<string, string> = {
    single: '🎯 Single Target',
    line: '➡️ Line Attack',
    cone: '📐 Cone Attack',
    cross: '✚ Cross Attack',
    area: '💥 Area Attack',
    self: '🔄 Self Target',
  };
  
  return (
    <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 bg-card border-2 border-primary rounded-lg shadow-xl p-3 min-w-[200px]">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-sm">{move.name}</h3>
        <button 
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground text-xs"
        >
          ESC to cancel
        </button>
      </div>
      
      <div className="space-y-1 text-xs text-muted-foreground">
        <p>{patternLabels[config.pattern] || config.pattern}</p>
        <div className="flex gap-3">
          <span>Range: {config.range}</span>
          {move.power > 0 && <span>⚔️ {move.power}</span>}
          <span>⚡ {move.staminaCost}</span>
        </div>
      </div>
      
      <p className="text-xs mt-2 text-primary">
        Click a tile to attack • Right-click to cancel
      </p>
    </div>
  );
}
