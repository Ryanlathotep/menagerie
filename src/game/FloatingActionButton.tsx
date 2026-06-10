import { useEffect, useRef, useState, ReactNode } from 'react';

interface Pos { x: number; y: number; }

export interface FloatingActionButtonProps {
  /** Unique storage key for this button's persisted position. */
  storageKey: string;
  /** Default {x,y} if nothing is saved. Pass a function for viewport-relative defaults. */
  defaultPosition: Pos | ((viewport: { w: number; h: number; size: number }) => Pos);
  /** Tap handler — only fires when the user did NOT drag. */
  onTap: () => void;
  /** Pixel size of the round button. Defaults to 40. */
  size?: number;
  /** Tooltip text. */
  title?: string;
  /** aria-label for accessibility. */
  ariaLabel: string;
  /** Inner icon / content. */
  children: ReactNode;
  /** Extra classes for the button (color, etc.). */
  className?: string;
  /** z-index. Defaults to 9999. */
  zIndex?: number;
}

/**
 * Generic always-visible draggable floating action button.
 * Position persists to localStorage under `storageKey`.
 * Tap = onTap; drag-then-release = save position, no tap.
 *
 * Used by FloatingBugButton, FloatingFeatureButton, and the in-dungeon
 * Unstuck button so every always-on overlay control behaves identically
 * across desktop / tablet / mobile.
 */
export function FloatingActionButton({
  storageKey,
  defaultPosition,
  onTap,
  size = 40,
  title,
  ariaLabel,
  children,
  className = 'bg-card/90 text-foreground hover:bg-accent hover:text-accent-foreground',
  zIndex = 9999,
}: FloatingActionButtonProps) {
  const clamp = (p: Pos): Pos => {
    if (typeof window === 'undefined') return p;
    const maxX = Math.max(0, window.innerWidth - size - 4);
    const maxY = Math.max(0, window.innerHeight - size - 4);
    return {
      x: Math.min(Math.max(4, p.x), maxX),
      y: Math.min(Math.max(4, p.y), maxY),
    };
  };

  const loadPos = (): Pos => {
    if (typeof window === 'undefined') return { x: 12, y: 12 };
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Pos;
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return clamp(parsed);
        }
      }
    } catch { /* ignore */ }
    const def = typeof defaultPosition === 'function'
      ? defaultPosition({ w: window.innerWidth, h: window.innerHeight, size })
      : defaultPosition;
    return clamp(def);
  };

  const [pos, setPos] = useState<Pos>(() => loadPos());
  const [dragging, setDragging] = useState(false);
  const dragState = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
    moved: boolean;
    startX: number;
    startY: number;
  } | null>(null);

  useEffect(() => {
    const onResize = () => setPos((p) => clamp(p));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
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
      setPos(clamp({ x: e.clientX - ds.offsetX, y: e.clientY - ds.offsetY }));
    }
  };

  const endDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    const ds = dragState.current;
    if (!ds || ds.pointerId !== e.pointerId) return;
    const wasDrag = ds.moved;
    dragState.current = null;
    if (wasDrag) {
      setDragging(false);
      try { localStorage.setItem(storageKey, JSON.stringify(pos)); } catch { /* ignore */ }
    } else {
      onTap();
    }
  };

  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      title={title}
      aria-label={ariaLabel}
      style={{
        left: pos.x,
        top: pos.y,
        width: size,
        height: size,
        zIndex,
        touchAction: 'none',
      }}
      className={`fixed flex items-center justify-center rounded-full border border-border shadow-md backdrop-blur transition ${className} ${dragging ? 'cursor-grabbing scale-110' : 'cursor-grab hover:scale-105'}`}
    >
      {children}
    </button>
  );
}
