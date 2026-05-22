// Dowsing Rod buff: highlights the nearest 5 enemies for 5 minutes.
// Persists across dungeon floors AND the overworld via localStorage
// (timestamp-based, real-time minutes). Admin "always-on" mirrors the
// adminCompass pattern via sessionStorage.

const EXPIRY_KEY = 'menagerie_dowsing_expiry';
const ADMIN_KEY = 'menagerie_admin_dowsing';
const EVENT_NAME = 'menagerie:dowsing-changed';

export const DOWSING_DURATION_MS = 5 * 60 * 1000; // 5 minutes
export const DOWSING_HIGHLIGHT_COUNT = 5;

// ─── Player-activated dowsing (consumable) ─────────────────────────────────
export function getDowsingExpiry(): number {
  if (typeof window === 'undefined') return 0;
  const raw = localStorage.getItem(EXPIRY_KEY);
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function isDowsingActive(): boolean {
  return getDowsingExpiry() > Date.now();
}

export function dowsingRemainingMs(): number {
  return Math.max(0, getDowsingExpiry() - Date.now());
}

export function activateDowsing(durationMs: number = DOWSING_DURATION_MS): void {
  if (typeof window === 'undefined') return;
  // Refresh: always set to now+duration (doesn't stack, just refreshes).
  localStorage.setItem(EXPIRY_KEY, String(Date.now() + durationMs));
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function clearDowsing(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(EXPIRY_KEY);
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

// ─── Admin always-on dowsing ───────────────────────────────────────────────
export function isAdminDowsing(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(ADMIN_KEY) === '1';
}

export function setAdminDowsing(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  if (enabled) sessionStorage.setItem(ADMIN_KEY, '1');
  else sessionStorage.removeItem(ADMIN_KEY);
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

// Effective: dowsing is "on" if the consumable buff is active OR admin toggle.
export function isDowsingEffective(): boolean {
  return isAdminDowsing() || isDowsingActive();
}

export function onDowsingChange(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
