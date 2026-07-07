// Deterministic seed hash for a crafted item. Used later by Item World /
// themed dungeon generation so a station-modified sword produces a different
// dungeon than a plain one.

import type { EquipmentItem } from '../equipment';

function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function craftSeedHash(item: EquipmentItem): number {
  const parts: string[] = [
    item.name,
    item.slot,
    item.rarity,
    JSON.stringify(item.stats ?? {}),
    JSON.stringify(item.stationStats ?? {}),
    item.provenance?.stationKind ?? '',
    String(item.provenance?.stationTier ?? 1),
    JSON.stringify(item.provenance?.stationModifiers ?? []),
    item.provenance?.inventor?.username ?? '',
    JSON.stringify(item.provenance?.inventor?.stationStats ?? {}),
  ];
  return hashString(parts.join('|'));
}
