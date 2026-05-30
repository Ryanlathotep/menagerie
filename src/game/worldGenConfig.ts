// World generation tuning. All numbers here are non-engine-breaking knobs the
// admin panel can edit live; defaults reflect the original hard-coded values.
//
// Shape is intentionally nested by domain ({ overworld: {...} }) so future
// dungeon-gen settings can drop in next to it, and so a future per-player
// "World Settings" pre-run screen can read the same defaults and write a
// per-save override using the same merge helper.

export interface WorldGenOverworld {
  spawn: {
    /** Radius around (0,0) where elevation is pulled toward `targetElev`. */
    homeBiasRadius: number;
    /** Mid-elevation to pull toward (between water and stone cutoffs). */
    targetElev: number;
    /** How strongly to pull (0 = none, 1 = fully replaced at center). */
    biasStrength: number;
  };
  elevation: {
    /** Default cutoffs used when biome doesn't override. */
    waterCutoff: number;
    stoneCutoff: number;
    /** Per-biome overrides (omit to use defaults). */
    biome: Partial<Record<'water' | 'earth' | 'fire' | 'air' | 'void', { waterCutoff?: number; stoneCutoff?: number }>>;
  };
  trees: {
    /** Base tree-spawn chance by biome (random 0-1 < chance => tree). */
    baseChance: Record<'grass' | 'water' | 'earth' | 'fire' | 'air' | 'void', number>;
    /** Forest noise threshold above which trees cluster, and gain per unit above. */
    forestThreshold: number;
    forestGain: number;
  };
  stoneTierRolls: {
    /** Distance from origin and probability for each tier (further = better). */
    copper: { minDist: number; chance: number };
    iron: { minDist: number; chance: number };
    gold: { minDist: number; chance: number };
    mithril: { minDist: number; chance: number };
  };
  treeTierRolls: {
    maple: { minDist: number; chance: number };
    elderOak: { minDist: number; chance: number };
  };
  enemies: {
    /** Base enemy spawn chance added on top of trees (per tile). */
    baseChance: number;
    /** Added chance per difficulty level above 1. */
    perDifficulty: number;
    /** Hard cap on enemy chance. */
    maxChance: number;
  };
  difficulty: {
    /** Tiles of Manhattan distance per +1 difficulty. */
    tilesPerLevel: number;
    /** Difficulty at spawn (0,0). */
    starting: number;
  };
}

export interface WorldGenConfig {
  overworld: WorldGenOverworld;
}

export const DEFAULT_WORLD_GEN: WorldGenConfig = {
  overworld: {
    spawn: {
      homeBiasRadius: 6,
      targetElev: 0.55,
      biasStrength: 0.7,
    },
    elevation: {
      waterCutoff: 0.30,
      stoneCutoff: 0.80,
      biome: {
        water: { waterCutoff: 0.38, stoneCutoff: 0.84 },
        earth: { waterCutoff: 0.22, stoneCutoff: 0.72 },
        fire: { waterCutoff: 0.18, stoneCutoff: 0.76 },
        air: { waterCutoff: 0.26, stoneCutoff: 0.82 },
        void: { waterCutoff: 0.26, stoneCutoff: 0.78 },
      },
    },
    trees: {
      baseChance: { grass: 0.06, water: 0.03, earth: 0.04, fire: 0.02, air: 0.025, void: 0.06 },
      forestThreshold: 0.6,
      forestGain: 0.6,
    },
    stoneTierRolls: {
      copper: { minDist: 15, chance: 0.30 },
      iron: { minDist: 30, chance: 0.20 },
      gold: { minDist: 45, chance: 0.12 },
      mithril: { minDist: 60, chance: 0.08 },
    },
    treeTierRolls: {
      maple: { minDist: 20, chance: 0.25 },
      elderOak: { minDist: 40, chance: 0.15 },
    },
    enemies: {
      baseChance: 0,
      perDifficulty: 0.012,
      maxChance: 0.06,
    },
    difficulty: {
      tilesPerLevel: 10,
      starting: 1,
    },
  },
};

// ──────────────── runtime state ────────────────

let _active: WorldGenConfig = DEFAULT_WORLD_GEN;

function deepMerge<T>(base: T, patch: Partial<T> | undefined): T {
  if (!patch) return base;
  const out: any = Array.isArray(base) ? [...(base as any)] : { ...base };
  for (const k of Object.keys(patch as any)) {
    const v = (patch as any)[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && (base as any)[k] && typeof (base as any)[k] === 'object') {
      out[k] = deepMerge((base as any)[k], v);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

/** Replace the active config with a deep merge of defaults + override rows. */
export function setWorldGenOverrides(
  rows: { data_key: string; data_value: Record<string, unknown> }[],
): void {
  const overworldPatch = rows.find((r) => r.data_key === 'overworld')?.data_value as
    | Partial<WorldGenOverworld>
    | undefined;
  _active = {
    overworld: deepMerge(DEFAULT_WORLD_GEN.overworld, overworldPatch),
  };
}

export function getWorldGenConfig(): WorldGenConfig {
  return _active;
}

export function getOverworldGen(): WorldGenOverworld {
  return _active.overworld;
}
