import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

/**
 * Shared floating-action-button dock.
 *
 * Every always-on floating button (Bug, Feature, SOS/Unstuck, …) registers
 * itself here via `useFloatingButton`. The provider renders:
 *   1. A single dock strip at bottom-right holding all "docked" buttons in
 *      a horizontal, scrollable row (scroll bar appears when full).
 *   2. Loose floating buttons for anything the user has dragged out of the
 *      dock — each retains an independently-persisted (x, y) position.
 *
 * Drag any dock button out to detach it. Drag any floating button onto the
 * dock strip to re-attach it. Position + docked state persist per-id in
 * localStorage under `fab:<id>`.
 */

interface Pos {
  x: number;
  y: number;
}

export interface FabConfig {
  id: string;
  icon: ReactNode;
  onTap: () => void;
  ariaLabel: string;
  title?: string;
  className?: string;
  size?: number;
  /** Whether the button starts docked when nothing is persisted yet. Defaults true. */
  defaultDocked?: boolean;
  /** Fallback floating position if user detaches and no position is saved. */
  defaultPosition?: (v: { w: number; h: number; size: number }) => Pos;
  zIndex?: number;
}

interface FabState {
  docked: boolean;
  x: number;
  y: number;
}

interface CtxVal {
  register: (id: string, cfgRef: React.MutableRefObject<FabConfig>) => void;
  unregister: (id: string) => void;
  configs: Record<string, React.MutableRefObject<FabConfig>>;
  order: string[];
  states: Record<string, FabState>;
  setDocked: (id: string, docked: boolean, pos?: Pos) => void;
  setPos: (id: string, pos: Pos) => void;
  dockRectRef: React.MutableRefObject<DOMRect | null>;
  registerSlot: (id: string, el: HTMLDivElement | null) => void;
  slotVersion: number;
  slotsRef: React.MutableRefObject<Map<string, HTMLDivElement>>;
}

const Ctx = createContext<CtxVal | null>(null);

const storageKey = (id: string) => `fab:${id}`;

function loadState(cfg: FabConfig): FabState {
  const defaultDocked = cfg.defaultDocked !== false;
  const size = cfg.size ?? 40;
  const w = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const h = typeof window !== 'undefined' ? window.innerHeight : 768;
  const defPos = cfg.defaultPosition
    ? cfg.defaultPosition({ w, h, size })
    : { x: w - size - 80, y: h - size - 12 };
  try {
    const raw = localStorage.getItem(storageKey(cfg.id));
    if (raw) {
      const p = JSON.parse(raw);
      if (
        typeof p.docked === 'boolean' &&
        typeof p.x === 'number' &&
        typeof p.y === 'number'
      ) {
        return p;
      }
    }
  } catch {
    /* ignore */
  }
  return { docked: defaultDocked, x: defPos.x, y: defPos.y };
}

function saveState(id: string, s: FabState) {
  try {
    localStorage.setItem(storageKey(id), JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function useFloatingButton(cfg: FabConfig) {
  const ctx = useContext(Ctx);
  // Keep a stable ref pointing at the latest cfg so parents can pass inline
  // closures for onTap without causing re-registration loops.
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;
  useEffect(() => {
    if (!ctx) return;
    ctx.register(cfg.id, cfgRef);
    return () => ctx.unregister(cfg.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.id]);
}

export function FloatingDockProvider({ children }: { children: ReactNode }) {
  const [configs, setConfigs] = useState<Record<string, React.MutableRefObject<FabConfig>>>({});
  const [order, setOrder] = useState<string[]>([]);
  const [states, setStates] = useState<Record<string, FabState>>({});
  const dockRectRef = useRef<DOMRect | null>(null);
  const slotsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const [slotVersion, setSlotVersion] = useState(0);

  const register = useCallback(
    (id: string, cfgRef: React.MutableRefObject<FabConfig>) => {
      setConfigs((prev) => (prev[id] === cfgRef ? prev : { ...prev, [id]: cfgRef }));
      setOrder((prev) => (prev.includes(id) ? prev : [...prev, id]));
      setStates((prev) =>
        prev[id] ? prev : { ...prev, [id]: loadState(cfgRef.current) },
      );
    },
    [],
  );

  const unregister = useCallback((id: string) => {
    setConfigs((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setOrder((prev) => prev.filter((x) => x !== id));
    slotsRef.current.delete(id);
  }, []);

  const setDocked = useCallback((id: string, docked: boolean, pos?: Pos) => {
    setStates((prev) => {
      const cur = prev[id];
      if (!cur) return prev;
      const next: FabState = {
        docked,
        x: pos?.x ?? cur.x,
        y: pos?.y ?? cur.y,
      };
      saveState(id, next);
      return { ...prev, [id]: next };
    });
  }, []);

  const setPos = useCallback((id: string, pos: Pos) => {
    setStates((prev) => {
      const cur = prev[id];
      if (!cur) return prev;
      const next: FabState = { ...cur, x: pos.x, y: pos.y };
      saveState(id, next);
      return { ...prev, [id]: next };
    });
  }, []);

  // Slot mount/unmount notifications arrive during React's commit phase (ref
  // callbacks). Bumping state synchronously there can re-enter the same commit
  // and trip "Maximum update depth exceeded", so coalesce into one rAF tick.
  const bumpHandle = useRef<number | null>(null);
  const scheduleSlotBump = useCallback(() => {
    if (bumpHandle.current != null) return;
    bumpHandle.current = requestAnimationFrame(() => {
      bumpHandle.current = null;
      setSlotVersion((v) => v + 1);
    });
  }, []);

  const registerSlot = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) {
      const prev = slotsRef.current.get(id);
      if (prev !== el) {
        slotsRef.current.set(id, el);
        scheduleSlotBump();
      }
    } else {
      if (slotsRef.current.has(id)) {
        slotsRef.current.delete(id);
        scheduleSlotBump();
      }
    }
  }, [scheduleSlotBump]);

  const value = useMemo<CtxVal>(
    () => ({
      register,
      unregister,
      configs,
      order,
      states,
      setDocked,
      setPos,
      dockRectRef,
      registerSlot,
      slotVersion,
      slotsRef,
    }),
    [
      register,
      unregister,
      configs,
      order,
      states,
      setDocked,
      setPos,
      registerSlot,
      slotVersion,
    ],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <FloatingDockRoot />
    </Ctx.Provider>
  );
}

const DOCK_POS_KEY = 'ui.dock.pos.v2';
/** Fired by Settings → "Reset dock position" so the dock snaps back to default. */
export const DOCK_RESET_EVENT = 'menagerie:dock-reset';
type DockPos = { x: number; y: number };

function loadDockPos(): DockPos | null {
  try {
    const raw = localStorage.getItem(DOCK_POS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p?.x === 'number' && typeof p?.y === 'number') return p;
  } catch { /* ignore */ }
  return null;
}
function saveDockPos(p: DockPos) {
  try { localStorage.setItem(DOCK_POS_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}
/** Clears the saved dock position and tells any mounted dock to reset. */
export function resetDockPosition() {
  try { localStorage.removeItem(DOCK_POS_KEY); } catch { /* ignore */ }
  try { window.dispatchEvent(new Event(DOCK_RESET_EVENT)); } catch { /* ignore */ }
}


function FloatingDockRoot() {
  const ctx = useContext(Ctx)!;
  const dockRef = useRef<HTMLDivElement | null>(null);
  const [dockPos, setDockPos] = useState<DockPos | null>(() => loadDockPos());
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ pointerId: number; offX: number; offY: number; moved: boolean; sx: number; sy: number } | null>(null);
  const slotRefCbs = useRef<Map<string, (el: HTMLDivElement | null) => void>>(new Map());
  const getSlotRef = (id: string) => {
    let cb = slotRefCbs.current.get(id);
    if (!cb) {
      cb = (el: HTMLDivElement | null) => ctx.registerSlot(id, el);
      slotRefCbs.current.set(id, cb);
    }
    return cb;
  };

  useEffect(() => {
    const update = () => {
      if (dockRef.current) {
        ctx.dockRectRef.current = dockRef.current.getBoundingClientRect();
      }
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    const int = setInterval(update, 400);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      clearInterval(int);
    };
  }, [ctx]);

  // Reset to default position when Settings asks for it.
  useEffect(() => {
    const onReset = () => setDockPos(null);
    window.addEventListener(DOCK_RESET_EVENT, onReset);
    return () => window.removeEventListener(DOCK_RESET_EVENT, onReset);
  }, []);

  // Clamp saved dock position to current viewport (handles rotate/resize).
  const clampDock = (p: DockPos): DockPos => {
    if (typeof window === 'undefined') return p;
    const rect = dockRef.current?.getBoundingClientRect();
    const w = rect?.width ?? 120;
    const h = rect?.height ?? 56;
    return {
      x: Math.min(Math.max(4, p.x), Math.max(4, window.innerWidth - w - 4)),
      y: Math.min(Math.max(4, p.y), Math.max(4, window.innerHeight - h - 4)),

    };
  };

  // Snap a dropped dock to whichever screen edge it landed closest to, so it
  // always sits flush instead of floating in the middle of the play area.
  const snapDock = (p: DockPos): DockPos => {
    if (typeof window === 'undefined') return p;
    const rect = dockRef.current?.getBoundingClientRect();
    const w = rect?.width ?? 120;
    const h = rect?.height ?? 56;
    const maxX = Math.max(4, window.innerWidth - w - 4);
    const maxY = Math.max(4, window.innerHeight - h - 4);
    const dLeft = p.x - 4;
    const dRight = maxX - p.x;
    const dTop = p.y - 4;
    const dBottom = maxY - p.y;
    const min = Math.min(dLeft, dRight, dTop, dBottom);
    if (min === dLeft) return { x: 4, y: p.y };
    if (min === dRight) return { x: maxX, y: p.y };
    if (min === dTop) return { x: p.x, y: 4 };
    return { x: p.x, y: maxY };
  };


  const dockedIds = ctx.order.filter((id) => ctx.states[id]?.docked);

  const setDockRef = (el: HTMLDivElement | null) => {
    dockRef.current = el;
    if (el) ctx.dockRectRef.current = el.getBoundingClientRect();
  };

  const onHandleDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dockRef.current) return;
    e.stopPropagation();
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    const rect = dockRef.current.getBoundingClientRect();
    dragRef.current = {
      pointerId: e.pointerId,
      offX: e.clientX - rect.left,
      offY: e.clientY - rect.top,
      moved: false,
      sx: e.clientX,
      sy: e.clientY,
    };
  };
  const onHandleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 4) {
      d.moved = true;
      setDragging(true);
    }
    if (d.moved) {
      setDockPos(clampDock({ x: e.clientX - d.offX, y: e.clientY - d.offY }));
    }
  };
  const onHandleUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    if (d.moved) {
      const p = snapDock(clampDock({ x: e.clientX - d.offX, y: e.clientY - d.offY }));
      setDockPos(p);
      saveDockPos(p);
    }

    setDragging(false);
  };

  const positionStyle: React.CSSProperties = dockPos
    ? { left: dockPos.x, top: dockPos.y, right: 'auto', bottom: 'auto' }
    // Default: hug the right edge but sit well above the bottom-right corner so
    // the dock never covers the Exit / Flee buttons.
    : { right: 12, top: '35%' };


  return (
    <>
      {/* Dock strip */}
      <div
        ref={setDockRef}
        className={`fixed z-[9998] flex items-center gap-1 p-1.5 rounded-2xl border border-border bg-card/85 backdrop-blur shadow-md max-w-[75vw] overflow-x-auto overflow-y-hidden ${dragging ? 'ring-2 ring-primary' : ''}`}
        aria-label="Floating action dock"
        style={{ scrollbarGutter: 'stable', ...positionStyle }}
      >
        {/* Drag handle — grip the whole dock and drop it anywhere */}
        <div
          role="button"
          aria-label="Drag dock"
          title="Drag to move dock"
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
          onDoubleClick={() => { setDockPos(null); try { localStorage.removeItem(DOCK_POS_KEY); } catch { /* ignore */ } }}
          className="shrink-0 flex flex-col items-center justify-center px-1 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/40 cursor-grab active:cursor-grabbing select-none"
          style={{ touchAction: 'none' }}
        >
          <span className="text-[10px] leading-none">⋮⋮</span>
        </div>
        {dockedIds.length === 0 ? (
          <span className="text-[10px] text-muted-foreground px-2 py-1 select-none whitespace-nowrap">
            drop buttons here
          </span>
        ) : (
          dockedIds.map((id) => (
            <div
              key={id}
              ref={getSlotRef(id)}
              className="shrink-0"
              style={{ width: ctx.configs[id]?.current.size ?? 40, height: ctx.configs[id]?.current.size ?? 40 }}
            />
          ))
        )}
      </div>



      {/* Render each button. Docked ones portal into their dock slot;
          floating ones render into document.body at their saved position. */}
      {ctx.order.map((id) => {
        const cfgRef = ctx.configs[id];
        const st = ctx.states[id];
        if (!cfgRef || !st) return null;
        return <FabInstance key={id} cfgRef={cfgRef} state={st} />;
      })}
    </>
  );
}

function FabInstance({ cfgRef, state }: { cfgRef: React.MutableRefObject<FabConfig>; state: FabState }) {
  const cfg = cfgRef.current;
  const ctx = useContext(Ctx)!;
  const size = cfg.size ?? 40;
  const zIndex = cfg.zIndex ?? 9999;
  const [dragging, setDragging] = useState(false);
  const [dragPos, setDragPos] = useState<Pos | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
    moved: boolean;
    startX: number;
    startY: number;
  } | null>(null);

  const clampFloat = (p: Pos): Pos => {
    if (typeof window === 'undefined') return p;
    const maxX = Math.max(0, window.innerWidth - size - 4);
    const maxY = Math.max(0, window.innerHeight - size - 4);
    return {
      x: Math.min(Math.max(4, p.x), maxX),
      y: Math.min(Math.max(4, p.y), maxY),
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    dragRef.current = {
      pointerId: e.pointerId,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) > 4) {
      d.moved = true;
      setDragging(true);
    }
    if (d.moved) {
      setDragPos({ x: e.clientX - d.offsetX, y: e.clientY - d.offsetY });
    }
  };

  const endDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    if (!d.moved) {
      setDragging(false);
      setDragPos(null);
      cfgRef.current.onTap();
      return;
    }
    const finalPos = clampFloat({
      x: e.clientX - d.offsetX,
      y: e.clientY - d.offsetY,
    });
    // Hit-test dock — use pointer position, not button top-left
    const dockRect = ctx.dockRectRef.current;
    const inDock =
      dockRect &&
      e.clientX >= dockRect.left &&
      e.clientX <= dockRect.right &&
      e.clientY >= dockRect.top &&
      e.clientY <= dockRect.bottom;
    setDragging(false);
    setDragPos(null);
    if (inDock) {
      ctx.setDocked(cfg.id, true, finalPos);
    } else {
      ctx.setDocked(cfg.id, false, finalPos);
    }
  };

  const button = (
    <button
      type="button"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      title={cfg.title}
      aria-label={cfg.ariaLabel}
      className={`flex items-center justify-center rounded-full border border-border shadow-md backdrop-blur transition ${
        cfg.className ??
        'bg-card/90 text-foreground hover:bg-accent hover:text-accent-foreground'
      } ${dragging ? 'cursor-grabbing scale-110' : 'cursor-grab hover:scale-105'}`}
      style={{
        width: size,
        height: size,
        touchAction: 'none',
        ...(dragging && dragPos
          ? {
              position: 'fixed',
              left: dragPos.x,
              top: dragPos.y,
              zIndex: zIndex + 1,
            }
          : state.docked
          ? { position: 'relative' }
          : {
              position: 'fixed',
              left: clampFloat({ x: state.x, y: state.y }).x,
              top: clampFloat({ x: state.x, y: state.y }).y,
              zIndex,
            }),
      }}
    >
      {cfg.icon}
    </button>
  );

  if (state.docked && !dragging) {
    // Portal into dock slot
    const slot = ctx.slotsRef.current.get(cfg.id);
    if (slot) return createPortal(button, slot);
    // slot not yet mounted — render nothing this tick; slotVersion bump will re-render
    return null;
  }

  if (state.docked && dragging) {
    // Still occupies its dock slot (invisible placeholder), but the visible
    // button is positioned at the pointer via fixed layout.
    const slot = ctx.slotsRef.current.get(cfg.id);
    if (slot) return createPortal(button, slot);
    return button;
  }

  return button;
}

/**
 * Backwards-compatible component wrapper. Existing call sites can keep using
 * `<FloatingActionButton storageKey=… onTap=… children=…/>` but everything
 * now flows through the shared dock.
 */
export interface FloatingActionButtonCompatProps {
  storageKey: string;
  defaultPosition?: Pos | ((v: { w: number; h: number; size: number }) => Pos);
  onTap: () => void;
  size?: number;
  title?: string;
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  zIndex?: number;
  defaultDocked?: boolean;
}

export function FloatingActionButtonCompat(props: FloatingActionButtonCompatProps) {
  const defPos = props.defaultPosition;
  useFloatingButton({
    id: props.storageKey,
    icon: props.children,
    onTap: props.onTap,
    ariaLabel: props.ariaLabel,
    title: props.title,
    className: props.className,
    size: props.size,
    zIndex: props.zIndex,
    defaultDocked: props.defaultDocked,
    defaultPosition:
      typeof defPos === 'function'
        ? defPos
        : defPos
        ? () => defPos
        : undefined,
  });
  return null;
}
