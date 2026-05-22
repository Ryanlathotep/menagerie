// Runtime registry for admin-edited equipment icon overlays.
// Mirrors the moveOverrides pattern: hydrated on boot from `game_data_overrides`
// rows of type 'sprites', and consulted by `getEquipmentIcon`.

import type { EquipmentIconDef } from './equipmentUtils';

const overrides = new Map<string, EquipmentIconDef>();

export function setEquipmentIconOverrides(
  rows: { data_key: string; data_value: Record<string, unknown> }[],
) {
  overrides.clear();
  for (const row of rows) {
    const v = row.data_value as Partial<EquipmentIconDef>;
    if (v && typeof v.path === 'string' && typeof v.viewBox === 'string') {
      overrides.set(row.data_key, {
        path: v.path,
        viewBox: v.viewBox,
        strokeWidth: typeof v.strokeWidth === 'number' ? v.strokeWidth : undefined,
      });
    }
  }
}

export function setSingleEquipmentIconOverride(
  key: string,
  value: EquipmentIconDef | null,
) {
  if (value === null) overrides.delete(key);
  else overrides.set(key, value);
}

export function getEquipmentIconOverride(key: string): EquipmentIconDef | undefined {
  return overrides.get(key);
}

export function listEquipmentIconOverrideKeys(): string[] {
  return Array.from(overrides.keys());
}
