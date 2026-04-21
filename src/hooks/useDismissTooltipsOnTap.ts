// Global helper: when the user taps/clicks anywhere, close any open Radix
// HoverCards and Tooltips. They tend to overlay important UI on mobile and
// linger after the touch that opened them — this gives the user a quick
// "tap-anywhere to dismiss" gesture without disturbing dialogs/popovers/sheets.
//
// Implementation: on every `pointerdown` we look for visible hover-card /
// tooltip content nodes (Radix gives them `data-state="open"`) and dispatch
// an Escape keydown, which Radix's dismissable layer interprets as "close".
// Dialogs/sheets/popovers also listen for Escape, so we only fire it when
// none of those are open — otherwise tapping the map would close the user's
// active modal.

import { useEffect } from 'react';

const DISMISSABLE_SELECTORS = [
  '[data-radix-hover-card-content][data-state="open"]',
  '[data-radix-tooltip-content][data-state="open"]',
  // Fallback for older Radix builds:
  '[role="tooltip"][data-state="open"]',
];

const BLOCKING_SELECTORS = [
  '[role="dialog"][data-state="open"]',
  '[role="alertdialog"][data-state="open"]',
  '[data-radix-popper-content-wrapper] [role="menu"][data-state="open"]',
  '[data-radix-popover-content][data-state="open"]',
];

export function useDismissTooltipsOnTap() {
  useEffect(() => {
    const handler = (e: PointerEvent) => {
      // Find any open hover-card / tooltip.
      const hasOpenTip = DISMISSABLE_SELECTORS.some(sel => document.querySelector(sel));
      if (!hasOpenTip) return;

      // Don't fire Escape if a dialog/popover/menu is open — those use Escape too.
      const hasBlocker = BLOCKING_SELECTORS.some(sel => document.querySelector(sel));
      if (hasBlocker) return;

      // If the tap is *inside* the tooltip content itself, leave it alone (e.g.
      // user is interacting with a clickable item inside a hover-card).
      const target = e.target as Element | null;
      if (target?.closest('[data-radix-hover-card-content], [data-radix-tooltip-content], [role="tooltip"]')) {
        return;
      }

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    };

    document.addEventListener('pointerdown', handler, { capture: true });
    return () => document.removeEventListener('pointerdown', handler, { capture: true });
  }, []);
}
