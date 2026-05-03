// Admin "Always-On Dungeon Compass" toggle.
//
// When enabled, the dungeon view permanently highlights the floor's exit
// staircase as if a Dungeon Compass had been used — without consuming an item
// or writing to dungeon state. Stored in sessionStorage so it does not survive
// browser sessions, and surfaced only behind the admin role check in Settings.

const STORAGE_KEY = 'menagerie_admin_compass';
const EVENT_NAME = 'menagerie:admin-compass-changed';

export function isAdminCompass(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(STORAGE_KEY) === '1';
}

export function setAdminCompass(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  if (enabled) sessionStorage.setItem(STORAGE_KEY, '1');
  else sessionStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: enabled }));
}

export function onAdminCompassChange(cb: (enabled: boolean) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<boolean>).detail);
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
