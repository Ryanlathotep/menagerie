// Runtime registry of admin-defined Move overrides.
//
// `useGameDataOverrides` saves field patches to Supabase per move id. This
// module is loaded once at app start, mirrors the latest values in memory,
// and exposes `applyMoveOverride` so move lookups can transparently merge in
// designer changes (power tweaks, custom AoE shapes, movement patterns…).

import type { Move } from './moves';

const overrides = new Map<string, Partial<Move>>();
let loaded = false;

export function setMoveOverrides(rows: { data_key: string; data_value: Record<string, unknown> }[]) {
  overrides.clear();
  for (const row of rows) {
    overrides.set(row.data_key, row.data_value as Partial<Move>);
  }
  loaded = true;
}

export function setSingleMoveOverride(id: string, value: Partial<Move> | null) {
  if (!value) overrides.delete(id);
  else overrides.set(id, value);
}

export function getMoveOverride(id: string): Partial<Move> | undefined {
  return overrides.get(id);
}

export function applyMoveOverride<T extends Move>(move: T): T {
  const o = overrides.get(move.id);
  if (!o) return move;
  // Shallow merge — admin overrides win, but keep fields they didn't touch.
  return { ...move, ...o } as T;
}

export function areMoveOverridesLoaded() {
  return loaded;
}
