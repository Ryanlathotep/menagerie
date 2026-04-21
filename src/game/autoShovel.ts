// Session-only Auto-Shovel toggle.
// When ON (default), walking onto a rune tile in a dungeon with a sufficient
// shovel auto-digs the rune (existing behavior). When OFF, the player simply
// steps on the rune without harvesting it (mismatched diggers' backlash damage
// is unaffected — that's handled by the terrain branch in Index.tsx).
//
// Lives in module-level state so it resets on full reload, per user request.

type Listener = (enabled: boolean) => void;

let enabled = true;
const listeners = new Set<Listener>();

export function isAutoShovelEnabled(): boolean {
  return enabled;
}

export function setAutoShovelEnabled(next: boolean): void {
  if (enabled === next) return;
  enabled = next;
  listeners.forEach((l) => l(enabled));
}

export function toggleAutoShovel(): boolean {
  setAutoShovelEnabled(!enabled);
  return enabled;
}

export function onAutoShovelChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
