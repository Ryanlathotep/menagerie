// Persist discovered recipes locally (+ optional cloud sync).
// Cloud table: crafting_recipes_discovered  (server-wide first-discovery credit)
//
// New in this iteration: the recipe row also freezes the inventor's crafting
// station snapshot (kind/tier/stats). Any future crafter of the same recipe
// hash inherits those station stats on top of whatever their own station adds.

import { supabase } from '@/integrations/supabase/client';
import type { CraftGrid, CraftingStationKindLite, DiscoveredRecipe, GridSize } from './types';
import type { EquipmentStats } from '../equipment';

const LS_KEY = 'menagerie:recipeBook';

interface CloudRow {
  hash: string;
  blueprint_id: string;
  item_name: string;
  grid_json: unknown;
  grid_size: number;
  discovered_by_username: string | null;
  discovered_at: string;
  world_seed: string | null;
  inventor_station_kind?: string | null;
  inventor_station_tier?: number | null;
  inventor_station_stats?: unknown;
}

function readLocal(): DiscoveredRecipe[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as DiscoveredRecipe[];
  } catch {
    return [];
  }
}

function writeLocal(list: DiscoveredRecipe[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  } catch { /* ignore quota */ }
}

export function getLocalRecipeBook(): DiscoveredRecipe[] {
  return readLocal();
}

/**
 * Insert or upgrade a local entry. Cloud sync is fire-and-forget.
 * Pass `opts.skipCloud` when recording synthetic/legacy discoveries so the
 * cloud leaderboard doesn't credit the live player as the inventor.
 */
export function recordDiscovery(
  rec: Omit<DiscoveredRecipe, 'local'>,
  opts: { skipCloud?: boolean } = {},
) {
  const list = readLocal();
  const existing = list.findIndex((r) => r.hash === rec.hash);
  if (existing >= 0) {
    list[existing] = { ...list[existing], ...rec };
  } else {
    list.unshift({ ...rec, local: true });
  }
  writeLocal(list);
  if (!opts.skipCloud) {
    void syncDiscoveryToCloud(rec).catch(() => { /* offline OK */ });
  }
}

async function syncDiscoveryToCloud(rec: Omit<DiscoveredRecipe, 'local'>) {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return;
  // Try to claim first-discovery. Only the first inserter wins (unique hash).
  await supabase.from('crafting_recipes_discovered').insert({
    hash: rec.hash,
    blueprint_id: rec.blueprintId,
    item_name: rec.itemName,
    grid_json: rec.grid,
    grid_size: rec.gridSize,
    world_seed: rec.worldSeed ?? null,
    inventor_station_kind: rec.inventorStationKind ?? null,
    inventor_station_tier: rec.inventorStationTier ?? null,
    inventor_station_stats: (rec.inventorStationStats as unknown) ?? null,
  } as never).select().maybeSingle();
}

function rowToRecipe(row: CloudRow): DiscoveredRecipe {
  return {
    hash: row.hash,
    blueprintId: row.blueprint_id,
    itemName: row.item_name,
    grid: row.grid_json as CraftGrid,
    gridSize: (row.grid_size as GridSize) ?? 3,
    discoveredBy: row.discovered_by_username,
    discoveredAt: row.discovered_at,
    worldSeed: row.world_seed,
    inventorStationKind: (row.inventor_station_kind as CraftingStationKindLite | null | undefined) ?? null,
    inventorStationTier: (row.inventor_station_tier as 1|2|3|4|5 | undefined) ?? undefined,
    inventorStationStats: (row.inventor_station_stats as EquipmentStats | undefined) ?? undefined,
  };
}

/** Pull all cloud discoveries newer than what we have locally. */
export async function syncCloudRecipeBook(): Promise<DiscoveredRecipe[]> {
  const local = readLocal();
  try {
    const { data, error } = await supabase
      .from('crafting_recipes_discovered')
      .select('hash, blueprint_id, item_name, grid_json, grid_size, discovered_by_username, discovered_at, world_seed, inventor_station_kind, inventor_station_tier, inventor_station_stats')
      .order('discovered_at', { ascending: false })
      .limit(500);
    if (error || !data) return local;
    const merged = new Map<string, DiscoveredRecipe>();
    for (const l of local) merged.set(l.hash, l);
    for (const row of data as unknown as CloudRow[]) {
      merged.set(row.hash, { ...rowToRecipe(row), local: false });
    }
    const list = Array.from(merged.values()).sort((a, b) =>
      (b.discoveredAt ?? '').localeCompare(a.discoveredAt ?? ''),
    );
    writeLocal(list);
    return list;
  } catch {
    return local;
  }
}

export async function lookupDiscovery(hash: string): Promise<DiscoveredRecipe | null> {
  const local = readLocal().find((r) => r.hash === hash);
  if (local) return local;
  try {
    const { data } = await supabase
      .from('crafting_recipes_discovered')
      .select('hash, blueprint_id, item_name, grid_json, grid_size, discovered_by_username, discovered_at, world_seed, inventor_station_kind, inventor_station_tier, inventor_station_stats')
      .eq('hash', hash)
      .maybeSingle();
    if (!data) return null;
    return rowToRecipe(data as unknown as CloudRow);
  } catch {
    return null;
  }
}
