import { ReactNode, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDock, useFabIsHome, useFloatingButton } from './FloatingDock';

/**
 * HUD ↔ dock bridging.
 *
 * The in-game bottom bar (Character Sheet, Moves, Inventory, Party, Return to
 * town, Save & main menu, …) wraps each of its buttons in `DockableHudButton`.
 * Every wrapped button registers with the shared FloatingDock so the player can
 * drag it out of the HUD into the dock (or loose onto the screen) and drag it
 * back into the HUD row later. Placement persists per button in localStorage.
 */

/** Marks the HUD bar as the drop zone that returns buttons to their home row. */
export function HudDockZone({
  children,
  className,
  style,
  innerRef,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  innerRef?: (el: HTMLDivElement | null) => void;
}) {
  const ctx = useDock();
  return (
    <div
      ref={(el) => {
        ctx?.setHomeZone(el);
        innerRef?.(el);
      }}
      className={className}
      style={style}
    >
      {children}
    </div>
  );
}

interface DockableHudButtonProps {
  /** Stable id — also the localStorage key suffix (`fab:<id>`). */
  id: string;
  /** Icon shown when the button lives in the dock or floats free. */
  icon: ReactNode;
  ariaLabel: string;
  title?: string;
  /** Action fired by a tap, both in the HUD and from the dock. */
  onTap: () => void;
  /** The real HUD button, rendered as-is while the button is "home". */
  children: ReactNode;
  size?: number;
  className?: string;
  /** Set false to make the button start in the dock instead of the HUD. */
  defaultHome?: boolean;
}

export function DockableHudButton({
  id,
  icon,
  ariaLabel,
  title,
  onTap,
  children,
  size = 40,
  className,
  defaultHome = true,
}: DockableHudButtonProps) {
  useFloatingButton({
    id,
    icon,
    onTap,
    ariaLabel,
    title,
    size,
    className,
    hasHome: true,
    defaultHome,
    defaultDocked: false,
  });

  const ctx = useDock();
  const isHome = useFabIsHome(id, defaultHome);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const st = useRef<{ pointerId: number; sx: number; sy: number; moved: boolean } | null>(null);

  if (!isHome) return null;

  const onPointerDown = (e: React.PointerEvent<HTMLSpanElement>) => {
    st.current = { pointerId: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLSpanElement>) => {
    const d = st.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 12) {
      d.moved = true;
      try {
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    if (d.moved) setDrag({ x: e.clientX, y: e.clientY });
  };

  const finish = (e: React.PointerEvent<HTMLSpanElement>) => {
    const d = st.current;
    setDrag(null);
    if (!d || d.pointerId !== e.pointerId) return;
    st.current = null;
    if (!d.moved || !ctx) return;

    const dockRect = ctx.dockRectRef.current;
    const inDock =
      dockRect &&
      e.clientX >= dockRect.left &&
      e.clientX <= dockRect.right &&
      e.clientY >= dockRect.top &&
      e.clientY <= dockRect.bottom;
    const homeRect = ctx.homeZoneRef.current?.getBoundingClientRect() ?? null;
    const inHome =
      !inDock &&
      homeRect &&
      e.clientX >= homeRect.left &&
      e.clientX <= homeRect.right &&
      e.clientY >= homeRect.top &&
      e.clientY <= homeRect.bottom;

    if (inDock) {
      ctx.setDocked(id, true);
    } else if (!inHome) {
      // Dropped loose on the play area — float it there.
      ctx.setDocked(id, false, { x: e.clientX - size / 2, y: e.clientY - size / 2 });
    }
    // Dropped back inside the HUD row: nothing to do, it stays home.
  };

  return (
    <span
      className="contents"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
      onClickCapture={(e) => {
        // A drag must never fire the button's action.
        if (st.current?.moved || drag) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      {children}
      {drag &&
        createPortal(
          <div
            className="fixed pointer-events-none z-[10000] flex items-center justify-center rounded-full border border-primary bg-card/90 shadow-lg text-foreground"
            style={{ left: drag.x - size / 2, top: drag.y - size / 2, width: size, height: size }}
          >
            {icon}
          </div>,
          document.body,
        )}
    </span>
  );
}
