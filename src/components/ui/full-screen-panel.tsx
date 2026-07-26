// Shared full-screen modal shell.
//
// Every full-screen panel in the game must satisfy two rules so players can
// never get trapped on a phone:
//   1. The panel body scrolls (and the backdrop itself scrolls as a fallback).
//   2. There is always a visible close affordance at the TOP of the panel,
//      reachable without scrolling to the bottom of a long list.
//
// New full-screen panels should use <FullScreenPanel>. Existing bespoke
// overlays can adopt just <PanelCloseButton> plus the `panelBodyClass`
// height/scroll recipe below.

import { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Height + scroll recipe: uses dvh so mobile browser chrome can't clip the panel. */
export const panelBodyClass =
  'max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain';

/** Top-right close button used by every full-screen panel. */
export function PanelCloseButton({
  onClose,
  label = 'Close',
  className,
}: {
  onClose: () => void;
  label?: string;
  className?: string;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClose}
      aria-label={label}
      className={cn('h-7 w-7 flex-shrink-0', className)}
    >
      <X className="h-4 w-4" />
    </Button>
  );
}

interface FullScreenPanelProps {
  onClose: () => void;
  title?: ReactNode;
  /** Extra controls rendered to the left of the close button. */
  headerExtra?: ReactNode;
  children: ReactNode;
  /** Footer pinned below the scrolling body. */
  footer?: ReactNode;
  className?: string;
  /** Tailwind max-width for the card. Default `max-w-lg`. */
  maxWidth?: string;
  /** Clicking the backdrop closes the panel. Default true. */
  dismissOnBackdrop?: boolean;
  zIndexClass?: string;
}

export function FullScreenPanel({
  onClose,
  title,
  headerExtra,
  children,
  footer,
  className,
  maxWidth = 'max-w-lg',
  dismissOnBackdrop = true,
  zIndexClass = 'z-50',
}: FullScreenPanelProps) {
  return (
    <div
      className={cn(
        'fixed inset-0 bg-background/80 backdrop-blur-sm flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto',
        zIndexClass,
      )}
      style={{
        paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
      }}
      onClick={dismissOnBackdrop ? onClose : undefined}
    >
      <Card
        className={cn(
          'w-full flex flex-col min-h-0 max-h-[calc(100dvh-1.5rem)]',
          maxWidth,
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 p-3 sm:p-4 pb-2 flex-shrink-0 border-b">
          <div className="min-w-0 font-bold text-base sm:text-lg truncate">{title}</div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {headerExtra}
            <PanelCloseButton onClose={onClose} />
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-4">
          {children}
        </div>

        {footer && <div className="p-3 sm:p-4 pt-2 border-t flex-shrink-0">{footer}</div>}
      </Card>
    </div>
  );
}
