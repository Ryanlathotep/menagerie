// Attack Targeting Overlay - Shows attack patterns when aiming on the dungeon map

import { useRef, useState } from 'react';
import { GripHorizontal } from 'lucide-react';
import { Position } from './types';

import { Move } from './moves';
import { MoveTagBadges } from './MoveTagBadges';
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
  
  // Get affected tiles based on cursor position (pass tiles for wall blocking)
  const affectedTiles = cursorPos 
    ? getAffectedTiles(playerPos, cursorPos, config, dungeonWidth, dungeonHeight, tiles)
    : [];
  
  // Check if cursor is on a valid target
  const isValidTarget = cursorPos && validTargets.some(t => t.x === cursorPos.x && t.y === cursorPos.y);
  const cursorInRange = cursorPos && isInRange(playerPos, cursorPos, config.range);
  
  return (
    <>
      {/* Range indicator overlay — faint outline of all legal target tiles */}
      {validTargets.map(pos => {
        const inAoe = affectedTiles.some(t => t.x === pos.x && t.y === pos.y);
        if (inAoe) return null; // Don't draw range under AoE shading
        return (
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
        );
      })}
      
      {/* Affected tiles preview — clearly shaded red so the AoE area is obvious. */}
      {cursorInRange && affectedTiles.map(pos => {
        const isCenter = cursorPos && pos.x === cursorPos.x && pos.y === cursorPos.y;
        return (
          <div
            key={`affected-${pos.x}-${pos.y}`}
            className={`absolute pointer-events-none z-20 ${
              isValidTarget
                ? isCenter
                  ? 'bg-red-600/60 border-2 border-red-500'
                  : 'bg-red-500/45 border border-red-500/70'
                : 'bg-muted/40 border border-muted-foreground/50'
            }`}
            style={{
              left: pos.x * tileSize,
              top: pos.y * tileSize,
              width: tileSize,
              height: tileSize,
            }}
          >
            {/* Attack indicator icon on the center tile only */}
            {isCenter && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm animate-pulse">⚔️</span>
              </div>
            )}
          </div>
        );
      })}
      
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
      
      {/* Cursor highlight — yellow ring marks the aiming center */}
      {cursorPos && cursorInRange && (
        <div
          className={`absolute pointer-events-none z-25 ring-4 ${
            isValidTarget ? 'ring-yellow-400' : 'ring-muted-foreground/50'
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

  // Draggable so the panel can never block the tile you're trying to hit.
  // Offset is persisted so the player only repositions it once.
  const [offset, setOffset] = useState<{ x: number; y: number }>(() => {
    try {
      const raw = localStorage.getItem('moveInfoPanelOffset');
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p?.x === 'number' && typeof p?.y === 'number') return p;
      }
    } catch { /* ignore */ }
    return { x: 0, y: 0 };
  });
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: offset.x, baseY: offset.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    e.preventDefault();
    setOffset({ x: d.baseX + (e.clientX - d.startX), y: d.baseY + (e.clientY - d.startY) });
  };
  const onPointerUp = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    try { localStorage.setItem('moveInfoPanelOffset', JSON.stringify(offset)); } catch { /* ignore */ }
  };

  const patternLabels: Record<string, string> = {
    single: '🎯 Single Target',
    line: '➡️ Line Attack (Piercing)',
    cone: '📐 Cone Attack',
    cross: '✚ Cross Attack',
    area: '💥 Area Attack',
    aura: '🌀 Aura (Around Self)',
    self: '🔄 Self Target',
  };
  
  // Get targeting info from move
  const moveTargeting = 'targeting' in move ? (move as import('./moves').Move).targeting : undefined;
  const wallPen = 'wallPenetrate' in move ? (move as import('./moves').Move).wallPenetrate : false;
  
  return (
    <div
      className="fixed bottom-28 left-1/2 z-50 bg-card border-2 border-primary rounded-lg shadow-xl p-3 min-w-[200px] touch-none"
      style={{ transform: `translate(calc(-50% + ${offset.x}px), ${offset.y}px)` }}
    >
      <div
        className="flex items-center justify-center -mt-1 mb-1 cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        title="Drag to move this panel"
      >
        <GripHorizontal className="h-4 w-4 text-muted-foreground" />
      </div>

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
          {/* Every tag this move carries, so nothing is hidden while aiming */}
          <MoveTagBadges move={move as import('./moves').Move} className="pt-0.5" />
        </div>

      
      <div className="text-xs mt-2 space-y-0.5">
        <p className="text-primary hidden sm:block">
          🖱️ Click a tile to attack • Right-click to cancel
        </p>
        <p className="text-primary sm:hidden">
          👆 <b>Tap once</b> to aim (highlights target &amp; area) • <b>Tap same tile again</b> to fire
        </p>
        <p className="text-muted-foreground sm:hidden">
          Tap a different tile to re-aim • Tap Cancel above to exit
        </p>
      </div>
    </div>
  );
}
