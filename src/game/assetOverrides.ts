// Runtime registry for admin-uploaded image assets that replace hand-drawn
// SVG layers (monster species/element/class, equipment icons, etc.).
//
// Boot loader in App.tsx pulls all rows of `game_data_overrides` where
// data_type='asset_image' and calls setAssetOverrides() with them.
//
// Row shape:
//   data_key   = `${category}:${key}`  e.g. "species:wolf", "equipment:Iron Sword"
//   data_value = { url: string; path: string }

export type AssetCategory =
  | 'species'
  | 'element'
  | 'class'
  | 'equipment'
  | 'monsterEquipment'; // overlay drawn ON monster when equipped

const overrides = new Map<string, string>(); // `${category}:${key}` -> url

function makeKey(category: AssetCategory, key: string): string {
  return `${category}:${key}`;
}

export function setAssetOverrides(
  rows: { data_key: string; data_value: Record<string, unknown> }[],
): void {
  overrides.clear();
  for (const row of rows) {
    const v = row.data_value as { url?: unknown };
    if (typeof v?.url === 'string' && v.url.length > 0) {
      overrides.set(row.data_key, v.url);
    }
  }
}

export function setSingleAssetOverride(
  category: AssetCategory,
  key: string,
  url: string | null,
): void {
  const k = makeKey(category, key);
  if (url === null || url === '') overrides.delete(k);
  else overrides.set(k, url);
}

export function getAssetOverride(
  category: AssetCategory,
  key: string,
): string | undefined {
  return overrides.get(makeKey(category, key));
}

export function listAssetOverrideKeys(): string[] {
  return Array.from(overrides.keys());
}
