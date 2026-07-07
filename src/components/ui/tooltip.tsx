import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";
import { useIsTouchDevice } from "@/hooks/useIsTouchDevice";

const TooltipProvider = TooltipPrimitive.Provider;

// Context so TooltipTrigger can drive open state on touch devices.
type TouchCtx = { isTouch: boolean; setOpen: (v: boolean) => void } | null;
const TouchTooltipContext = React.createContext<TouchCtx>(null);

/**
 * Tooltip root. On touch devices we take over open/close so the tooltip can be
 * summoned by long-press (mobile equivalent of desktop hover) and dismissed by
 * tapping elsewhere (handled globally by useDismissTooltipsOnTap).
 */
const Tooltip = ({
  children,
  open: openProp,
  defaultOpen,
  onOpenChange,
  ...rootProps
}: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Root>) => {
  const isTouch = useIsTouchDevice();
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(!!defaultOpen);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : uncontrolledOpen;
  const setOpen = React.useCallback(
    (v: boolean) => {
      if (!isControlled) setUncontrolledOpen(v);
      onOpenChange?.(v);
    },
    [isControlled, onOpenChange],
  );

  if (!isTouch) {
    return (
      <TooltipPrimitive.Root
        {...rootProps}
        open={openProp}
        defaultOpen={defaultOpen}
        onOpenChange={onOpenChange}
      >
        {children}
      </TooltipPrimitive.Root>
    );
  }

  return (
    <TouchTooltipContext.Provider value={{ isTouch: true, setOpen }}>
      <TooltipPrimitive.Root {...rootProps} open={open} onOpenChange={setOpen}>
        {children}
      </TooltipPrimitive.Root>
    </TouchTooltipContext.Provider>
  );
};

const LONG_PRESS_MS = 400;

/**
 * TooltipTrigger — on touch devices, a ~400ms long-press opens the tooltip.
 * On desktop, delegates to the normal Radix hover/focus behavior.
 */
const TooltipTrigger = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Trigger>
>(({ onTouchStart, onTouchEnd, onTouchMove, onTouchCancel, onContextMenu, ...props }, ref) => {
  const ctx = React.useContext(TouchTooltipContext);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const openedRef = React.useRef(false);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleTouchStart: React.TouchEventHandler<HTMLButtonElement> = (e) => {
    onTouchStart?.(e);
    if (!ctx?.isTouch) return;
    openedRef.current = false;
    clearTimer();
    timerRef.current = setTimeout(() => {
      openedRef.current = true;
      ctx.setOpen(true);
    }, LONG_PRESS_MS);
  };
  const handleTouchEnd: React.TouchEventHandler<HTMLButtonElement> = (e) => {
    onTouchEnd?.(e);
    clearTimer();
    if (openedRef.current) e.preventDefault();
  };
  const handleTouchMove: React.TouchEventHandler<HTMLButtonElement> = (e) => {
    onTouchMove?.(e);
    clearTimer();
  };
  const handleTouchCancel: React.TouchEventHandler<HTMLButtonElement> = (e) => {
    onTouchCancel?.(e);
    clearTimer();
  };
  const handleContextMenu: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    if (ctx?.isTouch) e.preventDefault();
    onContextMenu?.(e);
  };

  return (
    <TooltipPrimitive.Trigger
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
TooltipTrigger.displayName = TooltipPrimitive.Trigger.displayName;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className,
    )}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
