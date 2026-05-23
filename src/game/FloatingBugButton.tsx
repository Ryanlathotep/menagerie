import { useEffect, useRef, useState } from 'react';
import { Bug } from 'lucide-react';
import { ReportBugDialog } from './ReportBugDialog';

const STORAGE_KEY = 'bug-button-position-v1';
const BTN_SIZE = 40;

interface Pos { x: number; y: number; }

function clampToViewport(p: Pos): Pos {
  if (typeof window === 'undefined') return p;
  const maxX = Math.max(0, window.innerWidth - BTN_SIZE - 4);
  const maxY = Math.max(0, window.innerHeight - BTN_SIZE - 4);
  return {
    x: Math.min(Math.max(4, p.x), maxX),
    y: Math.min(Math.max(4, p.y), maxY),
  };
}

function loadPos(): Pos {
  if (typeof window === 'undefined') return { x: 12, y: 12 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Pos;
      if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
        return clampToViewport(parsed);
      }
    }
  } catch { /* ignore */ }
  // Default: bottom-right (matches original placement)
  return clampToViewport({
    x: window.innerWidth - BTN_SIZE - 12,
    y: window.innerHeight - BTN_SIZE - 12,
  });
}

/**
 * Always-visible floating bug-report button. Draggable; position persists.
 */
export function FloatingBugButton() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos>(() => loadPos());
  const dragState = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
    moved: boolean;
    startX: number;
    startY: number;
  } | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const onResize = () => setPos((p) => clampToViewport(p));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    dragState.current = {
      pointerId: e.pointerId,
      offsetX: e.clientX - pos.x,
      offsetY: e.clientY - pos.y,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const ds = dragState.current;
    if (!ds || ds.pointerId !== e.pointerId) return;
    const dx = e.clientX - ds.startX;
    const dy = e.clientY - ds.startY;
    if (!ds.moved && Math.hypot(dx, dy) > 4) {
      ds.moved = true;
      setDragging(true);
    }
    if (ds.moved) {
      setPos(clampToViewport({ x: e.clientX - ds.offsetX, y: e.clientY - ds.offsetY }));
    }
  };

  const endDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    const ds = dragState.current;
    if (!ds || ds.pointerId !== e.pointerId) return;
    const wasDrag = ds.moved;
    dragState.current = null;
    if (wasDrag) {
      setDragging(false);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pos)); } catch { /* ignore */ }
    } else {
      setOpen(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        title="Report a bug (drag to reposition)"
        aria-label="Report a bug"
        style={{ left: pos.x, top: pos.y, touchAction: 'none' }}
        className={`fixed z-[9999] flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card/90 text-foreground shadow-md backdrop-blur transition hover:bg-accent hover:text-accent-foreground ${dragging ? 'cursor-grabbing scale-110' : 'cursor-grab hover:scale-105'}`}
      >
        <Bug className="h-5 w-5 pointer-events-none" />
      </button>
      <ReportBugDialog isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
