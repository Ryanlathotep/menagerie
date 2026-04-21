// Rune Tile System — magical surface inscriptions that buff matching monsters
// and lash out at mismatched ones. Formerly called "terrains"; the underlying
// data shape is preserved for compatibility but the player-facing language is
// now "Rune" everywhere.
//
// Mining: each rune type can be harvested with a Shovel of sufficient tier,
// dropping a placeable Rune Stone material. Mismatched diggers still take the
// 1 tick of rune backlash damage when they shovel it.

import { ElementType, ClassType, Monster } from './types';
import { SHOVEL_TIERS, type ShovelTier } from './tools';

// Rune types — keep the same string keys so existing save data stays valid.
export type TerrainType =
  | 'water'     // Water element rune
  | 'lava'      // Fire element rune
  | 'rubble'    // Earth element rune
  | 'vents'     // Air element rune
  | 'shadows'   // Void element rune
  | 'spikes'    // Kinetic class rune
  | 'lasers'    // Energy class rune
  | 'acid'      // Chemical class rune
  | 'tendrils'  // Biological class rune
  | 'psychic';  // Political class rune

export interface TerrainConfig {
  type: TerrainType;
  name: string;          // player-facing rune name
  icon: string;
  description: string;
  favoredElement?: ElementType;
  favoredClass?: ClassType;
  color: { from: string; to: string };
  glowColor: string;
  // ---- Shovel mining metadata ----
  shovelTier: 1 | 2 | 3 | 4 | 5;          // min shovel power required
  baseHits: number;                        // base hits at speed 1
  materialId: string;                      // dropped Rune Stone material id
  // Drop count range — tiered: t1 = 2-3, t2 = 1-2, t3+ = 1
  dropMin: number;
  dropMax: number;
}

// All rune configurations (formerly TERRAIN_CONFIG).
export const TERRAIN_CONFIG: Record<TerrainType, TerrainConfig> = {
  rubble: {
    type: 'rubble',
    name: 'Earthen Rune',
    icon: '🪨',
    description: 'A sigil of broken stone. Earth creatures draw strength from its grit.',
    favoredElement: 'earth',
    color: { from: 'from-amber-600', to: 'to-yellow-800' },
    glowColor: 'shadow-amber-600/40',
    shovelTier: 1,
    baseHits: 2,
    materialId: 'rune_earth',
    dropMin: 2,
    dropMax: 3,
  },
  water: {
    type: 'water',
    name: 'Tidal Rune',
    icon: '🌊',
    description: 'A pool of inscribed water. Water creatures thrive in its current.',
    favoredElement: 'water',
    color: { from: 'from-blue-300', to: 'to-cyan-400' },
    glowColor: 'shadow-blue-400/40',
    shovelTier: 2,
    baseHits: 3,
    materialId: 'rune_water',
    dropMin: 1,
    dropMax: 2,
  },
  lava: {
    type: 'lava',
    name: 'Pyric Rune',
    icon: '🔥',
    description: 'Glyphs etched in molten rock. Fire creatures roar to life atop it.',
    favoredElement: 'fire',
    color: { from: 'from-orange-500', to: 'to-red-600' },
    glowColor: 'shadow-orange-500/50',
    shovelTier: 2,
    baseHits: 3,
    materialId: 'rune_fire',
    dropMin: 1,
    dropMax: 2,
  },
  vents: {
    type: 'vents',
    name: 'Zephyr Rune',
    icon: '💨',
    description: 'A sigil that breathes steam. Air creatures float lighter on it.',
    favoredElement: 'air',
    color: { from: 'from-sky-200', to: 'to-slate-300' },
    glowColor: 'shadow-sky-300/40',
    shovelTier: 2,
    baseHits: 3,
    materialId: 'rune_air',
    dropMin: 1,
    dropMax: 2,
  },
  spikes: {
    type: 'spikes',
    name: 'Kinetic Rune',
    icon: '⚔️',
    description: 'Edges of resonant force. Kinetic creatures channel its momentum.',
    favoredClass: 'kinetic',
    color: { from: 'from-slate-400', to: 'to-zinc-600' },
    glowColor: 'shadow-slate-500/40',
    shovelTier: 3,
    baseHits: 4,
    materialId: 'rune_kinetic',
    dropMin: 1,
    dropMax: 1,
  },
  lasers: {
    type: 'lasers',
    name: 'Energy Rune',
    icon: '⚡',
    description: 'Crackling lines of pure energy. Energy creatures hum in tune.',
    favoredClass: 'energy',
    color: { from: 'from-yellow-300', to: 'to-amber-500' },
    glowColor: 'shadow-yellow-400/50',
    shovelTier: 3,
    baseHits: 4,
    materialId: 'rune_energy',
    dropMin: 1,
    dropMax: 1,
  },
  acid: {
    type: 'acid',
    name: 'Chemical Rune',
    icon: '🧪',
    description: 'A pool of glowing reagent. Chemical creatures ride its reactions.',
    favoredClass: 'chemical',
    color: { from: 'from-lime-400', to: 'to-green-600' },
    glowColor: 'shadow-lime-500/50',
    shovelTier: 3,
    baseHits: 4,
    materialId: 'rune_chemical',
    dropMin: 1,
    dropMax: 1,
  },
  tendrils: {
    type: 'tendrils',
    name: 'Bio Rune',
    icon: '🦑',
    description: 'A living glyph of vines. Biological creatures grow with it.',
    favoredClass: 'biological',
    color: { from: 'from-pink-400', to: 'to-rose-600' },
    glowColor: 'shadow-pink-500/50',
    shovelTier: 4,
    baseHits: 5,
    materialId: 'rune_biological',
    dropMin: 1,
    dropMax: 1,
  },
  psychic: {
    type: 'psychic',
    name: 'Psychic Rune',
    icon: '🔮',
    description: 'A field of focused thought. Political creatures wield its presence.',
    favoredClass: 'political',
    color: { from: 'from-indigo-400', to: 'to-violet-600' },
    glowColor: 'shadow-indigo-500/50',
    shovelTier: 4,
    baseHits: 5,
    materialId: 'rune_political',
    dropMin: 1,
    dropMax: 1,
  },
  shadows: {
    type: 'shadows',
    name: 'Void Rune',
    icon: '👁️',
    description: 'A glyph of swallowed light. Void creatures slip into its depths.',
    favoredElement: 'void',
    color: { from: 'from-purple-800', to: 'to-slate-900' },
    glowColor: 'shadow-purple-600/50',
    shovelTier: 4,
    baseHits: 5,
    materialId: 'rune_void',
    dropMin: 1,
    dropMax: 1,
  },
};

// Backlash damage applied when a non-favored monster steps on (or shovels) a rune.
export const TERRAIN_DAMAGE = 2;

// Bonus damage multiplier when a favored monster fights atop its rune.
export const TERRAIN_DAMAGE_BONUS = 0.15;

// Is this monster favored on this rune?
export function isMonsterFavoredOnTerrain(monster: Monster, terrainType: TerrainType): boolean {
  const config = TERRAIN_CONFIG[terrainType];
  if (config.favoredElement && monster.element === config.favoredElement) return true;
  if (config.favoredClass && monster.class === config.favoredClass) return true;
  return false;
}

// Calculate rune backlash damage: 0 if favored, TERRAIN_DAMAGE otherwise.
export function calculateTerrainDamage(monster: Monster, terrainType: TerrainType): number {
  if (isMonsterFavoredOnTerrain(monster, terrainType)) return 0;
  return TERRAIN_DAMAGE;
}

export function getTerrainForElement(element: ElementType): TerrainType | null {
  const mapping: Partial<Record<ElementType, TerrainType>> = {
    water: 'water', fire: 'lava', earth: 'rubble', air: 'vents', void: 'shadows',
  };
  return mapping[element] || null;
}

export function getTerrainForClass(classType: ClassType): TerrainType | null {
  const mapping: Partial<Record<ClassType, TerrainType>> = {
    kinetic: 'spikes', energy: 'lasers', chemical: 'acid',
    biological: 'tendrils', political: 'psychic',
  };
  return mapping[classType] || null;
}

export function getRandomTerrainType(): TerrainType {
  const allTypes: TerrainType[] = [
    'water', 'lava', 'rubble', 'vents', 'shadows',
    'spikes', 'lasers', 'acid', 'tendrils', 'psychic',
  ];
  return allTypes[Math.floor(Math.random() * allTypes.length)];
}

export function getTerrainInfo(terrainType: TerrainType): TerrainConfig {
  return TERRAIN_CONFIG[terrainType];
}

// ---- Shovel mining helpers ----

// Hits required to dig up a rune with the given shovel tier.
// Returns Infinity if shovel is too weak (or absent).
export function shovelHitsToBreak(
  terrainType: TerrainType,
  shovelTier: ShovelTier | undefined,
): number {
  if (!shovelTier) return Infinity;
  const data = TERRAIN_CONFIG[terrainType];
  const power = SHOVEL_TIERS[shovelTier].power;
  if (power < data.shovelTier) return Infinity;
  const speed = SHOVEL_TIERS[shovelTier].speed;
  return Math.max(1, Math.ceil(data.baseHits / speed));
}

// Roll the drop quantity when a rune is fully dug up.
export function rollRuneDrop(terrainType: TerrainType): { materialId: string; quantity: number } {
  const data = TERRAIN_CONFIG[terrainType];
  const range = data.dropMax - data.dropMin + 1;
  const qty = data.dropMin + Math.floor(Math.random() * range);
  return { materialId: data.materialId, quantity: qty };
}
