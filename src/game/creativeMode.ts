// Creative Mode — admin-only toggle that skips resource / material costs.
//
// Stored in sessionStorage (NOT localStorage) so it never persists across browser
// sessions: we don't want a forgotten "creative" flag to silently corrupt a real
// playthrough. The toggle is also gated by `useAdminRole()` in the UI, so a
// non-admin who flips the storage key by hand still gets nothing because the
// only places that *call* `isCreativeMode()` short-circuit cost checks; on a
// non-admin account the toggle simply never appears in Settings.
//
// All gameplay sites that should respect this flag import `isCreativeMode()`
// directly — keeping the surface tiny so the bypass is easy to audit.

const STORAGE_KEY = 'menagerie_creative_mode';
const EVENT_NAME = 'menagerie:creative-mode-changed';

export function isCreativeMode(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(STORAGE_KEY) === '1';
}

export function setCreativeMode(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  if (enabled) sessionStorage.setItem(STORAGE_KEY, '1');
  else sessionStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: enabled }));
}

// Subscribe to changes (used by status badges / settings UI to re-render).
export function onCreativeModeChange(cb: (enabled: boolean) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<boolean>).detail);
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}

// Effective tool loadout for gameplay gating. In Creative Mode the player is
// treated as if they own every tool at its maximum tier — pickaxe, shovel,
// AND the Portable Workstation — so they can mine any wall, dig any rune,
// and open the workshop anywhere without crafting first. Outside Creative
// Mode this just returns whatever is actually persisted on saveData.
import type { PlayerTools } from './tools';
export function effectiveTools(tools: PlayerTools | undefined): PlayerTools {
  if (isCreativeMode()) {
    return { pickaxe: 'mithril', shovel: 'mithril', workstation: true };
  }
  return tools || {};
}
