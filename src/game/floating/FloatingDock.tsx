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
  register: (cfg: FabConfig) => void;
  unregister: (id: string) => void;
  configs: Record<string, FabConfig>;
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
  // stable ref of latest cfg so we don't re-register on every render
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;
  useEffect(() => {
    if (!ctx) return;
    ctx.register(cfgRef.current);
    return () => ctx.unregister(cfgRef.current.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.id]);
  // Update config on prop changes without re-registering (same id)
  useEffect(() => {
    if (!ctx) return;
    ctx.register(cfgRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.onTap, cfg.icon, cfg.title, cfg.className, cfg.ariaLabel]);
}

export function FloatingDockProvider({ children }: { children: ReactNode }) {
  const [configs, setConfigs] = useState<Record<string, FabConfig>>({});
  const [order, setOrder] = useState<string[]>([]);
  const [states, setStates] = useState<Record<string, FabState>>({});
  const dockRectRef = useRef<DOMRect | null>(null);
  const slotsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const [slotVersion, setSlotVersion] = useState(0);

  const register = useCallback((cfg: FabConfig) => {
    setConfigs((prev) => ({ ...prev, [cfg.id]: cfg }));
    setOrder((prev) => (prev.includes(cfg.id) ? prev : [...prev, cfg.id]));
    setStates((prev) =>
      prev[cfg.id] ? prev : { ...prev, [cfg.id]: loadState(cfg) },
    );
  }, []);

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

  const registerSlot = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) {
      const prev = slotsRef.current.get(id);
      if (prev !== el) {
        slotsRef.current.set(id, el);
        setSlotVersion((v) => v + 1);
      }
    } else {
      if (slotsRef.current.has(id)) {
        slotsRef.current.delete(id);
        setSlotVersion((v) => v + 1);
      }
    }
  }, []);

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

function FloatingDockRoot() {
  const ctx = useContext(Ctx)!;
  const dockRef = useRef<HTMLDivElement | null>(null);

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

  const dockedIds = ctx.order.filter((id) => ctx.states[id]?.docked);
  const floatIds = ctx.order.filter((id) => ctx.states[id] && !ctx.states[id].docked);

  return (
    <>
      {/* Dock strip */}
      <div
        ref={(el) => {
          dockRef.current = el;
          if (el) ctx.dockRectRef.current = el.getBoundingClientRect();
        }}
        className="fixed bottom-3 right-3 z-[9998] flex items-center gap-2 p-2 rounded-2xl border border-border bg-card/85 backdrop-blur shadow-md max-w-[75vw] overflow-x-auto overflow-y-hidden"
        aria-label="Floating action dock"
        style={{ scrollbarGutter: 'stable' }}
      >
        {dockedIds.length === 0 ? (
          <span className="text-[10px] text-muted-foreground px-2 py-1 select-none whitespace-nowrap">
            drop buttons here
          </span>
        ) : (
          dockedIds.map((id) => (
            <div
              key={id}
              ref={(el) => ctx.registerSlot(id, el)}
              className="shrink-0"
              style={{ width: ctx.configs[id]?.size ?? 40, height: ctx.configs[id]?.size ?? 40 }}
            />
          ))
        )}
      </div>

      {/* Render each button. Docked ones portal into their dock slot;
          floating ones render into document.body at their saved position. */}
      {ctx.order.map((id) => {
        const cfg = ctx.configs[id];
        const st = ctx.states[id];
        if (!cfg || !st) return null;
        return <FabInstance key={id} cfg={cfg} state={st} />;
      })}
    </>
  );
}

function FabInstance({ cfg, state }: { cfg: FabConfig; state: FabState }) {
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
      cfg.onTap();
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
