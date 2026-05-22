// Tiny visual of a move's AoE shape (smallest bounding box around anchor + cells).
// Used in move tooltips/descriptions so players can see the pattern at a glance.

import type { Move } from './moves';

interface Props {
  move: Move;
  cellPx?: number;
  className?: string;
}

export function MoveShapeThumbnail({ move, cellPx = 8, className = '' }: Props) {
  const shape = move.customShape;
  const movement = move.movement;
  const offsets = shape?.offsets ?? movement?.offsets ?? [];
  if (offsets.length === 0) return null;

  // Include the anchor (0,0) so the caster is always visible in the thumbnail.
  const all = [{ dx: 0, dy: 0 }, ...offsets];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const o of all) {
    if (o.dx < minX) minX = o.dx;
    if (o.dx > maxX) maxX = o.dx;
    if (o.dy < minY) minY = o.dy;
    if (o.dy > maxY) maxY = o.dy;
  }
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;

  const cellSet = new Set(offsets.map((o) => `${o.dx},${o.dy}`));
  const isMovement = !shape && !!movement;

  return (
    <div
      className={`inline-grid gap-px bg-border/40 p-px rounded-sm ${className}`}
      style={{ gridTemplateColumns: `repeat(${w}, ${cellPx}px)` }}
      aria-label="AoE shape"
    >
      {Array.from({ length: w * h }).map((_, i) => {
        const gx = i % w;
        const gy = Math.floor(i / w);
        const dx = gx + minX;
        const dy = gy + minY;
        const isAnchor = dx === 0 && dy === 0;
        const on = cellSet.has(`${dx},${dy}`);
        const cls = isAnchor
          ? 'bg-foreground'
          : on
            ? isMovement ? 'bg-sky-500/80' : 'bg-destructive/80'
            : 'bg-muted/60';
        return (
          <div
            key={i}
            className={cls}
            style={{ width: cellPx, height: cellPx, borderRadius: 1 }}
          />
        );
      })}
    </div>
  );
}
