import * as React from "react";
import * as HoverCardPrimitive from "@radix-ui/react-hover-card";

import { cn } from "@/lib/utils";
import { useIsTouchDevice } from "@/hooks/useIsTouchDevice";

type TouchCtx = { isTouch: boolean; setOpen: (v: boolean) => void } | null;
const TouchHoverCtx = React.createContext<TouchCtx>(null);

/**
 * HoverCard root. On touch devices, hover doesn't exist — we drive open state
 * from a long-press on the trigger and close via global tap-anywhere handler.
 */
const HoverCard = ({
  children,
  open: openProp,
  defaultOpen,
  onOpenChange,
  ...rootProps
}: React.ComponentPropsWithoutRef<typeof HoverCardPrimitive.Root>) => {
  const isTouch = useIsTouchDevice();
  const [uncontrolled, setUncontrolled] = React.useState(!!defaultOpen);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : uncontrolled;
  const setOpen = React.useCallback(
    (v: boolean) => {
      if (!isControlled) setUncontrolled(v);
      onOpenChange?.(v);
    },
    [isControlled, onOpenChange],
  );

  if (!isTouch) {
    return (
      <HoverCardPrimitive.Root
        {...rootProps}
        open={openProp}
        defaultOpen={defaultOpen}
        onOpenChange={onOpenChange}
      >
        {children}
      </HoverCardPrimitive.Root>
    );
  }

  return (
    <TouchHoverCtx.Provider value={{ isTouch: true, setOpen }}>
      <HoverCardPrimitive.Root {...rootProps} open={open} onOpenChange={setOpen}>
        {children}
      </HoverCardPrimitive.Root>
    </TouchHoverCtx.Provider>
  );
};

const LONG_PRESS_MS = 400;

const HoverCardTrigger = React.forwardRef<
  React.ElementRef<typeof HoverCardPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof HoverCardPrimitive.Trigger>
>(({ onTouchStart, onTouchEnd, onTouchMove, onTouchCancel, onContextMenu, ...props }, ref) => {
  const ctx = React.useContext(TouchHoverCtx);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const openedRef = React.useRef(false);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleTouchStart: React.TouchEventHandler<HTMLAnchorElement> = (e) => {
    onTouchStart?.(e);
    if (!ctx?.isTouch) return;
    openedRef.current = false;
    clearTimer();
    timerRef.current = setTimeout(() => {
      openedRef.current = true;
      ctx.setOpen(true);
    }, LONG_PRESS_MS);
  };
  const handleTouchEnd: React.TouchEventHandler<HTMLAnchorElement> = (e) => {
    onTouchEnd?.(e);
    clearTimer();
    if (openedRef.current) e.preventDefault();
  };
  const handleTouchMove: React.TouchEventHandler<HTMLAnchorElement> = (e) => {
    onTouchMove?.(e);
    clearTimer();
  };
  const handleTouchCancel: React.TouchEventHandler<HTMLAnchorElement> = (e) => {
    onTouchCancel?.(e);
    clearTimer();
  };
  const handleContextMenu: React.MouseEventHandler<HTMLAnchorElement> = (e) => {
    if (ctx?.isTouch) e.preventDefault();
    onContextMenu?.(e);
  };

  return (
    <HoverCardPrimitive.Trigger
      ref={ref}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onTouchCancel={handleTouchCancel}
      onContextMenu={handleContextMenu}
      {...props}
    />
  );
});
HoverCardTrigger.displayName = HoverCardPrimitive.Trigger.displayName;

const HoverCardContent = React.forwardRef<
  React.ElementRef<typeof HoverCardPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof HoverCardPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <HoverCardPrimitive.Content
    ref={ref}
    align={align}
    sideOffset={sideOffset}
    className={cn(
      "z-50 w-64 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className,
    )}
    {...props}
  />
));
HoverCardContent.displayName = HoverCardPrimitive.Content.displayName;

export { HoverCard, HoverCardTrigger, HoverCardContent };
