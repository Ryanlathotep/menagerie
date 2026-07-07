// Tool system — singleton, upgradeable in place.
//
// Players never own more than one of a given tool. Crafting the base tier
// (e.g. Wooden Pickaxe) "creates" it; subsequent crafts of higher tiers
// upgrade the existing tool by spending the tier's materials.
//
// Tools are auto-applied — they don't occupy an equipment slot. Owning a
// Pickaxe lets you mine matching wall tiers anywhere in any dungeon.

export type ToolKind = 'pickaxe' | 'shovel' | 'hoe';

// Pickaxe tiers, lowest → highest. The numeric `power` is what matters for
// gating: a Pickaxe of power N can mine any wall whose `tier <= N`.
export type PickaxeTier =
  | 'wooden'   // power 1
  | 'stone'    // power 2
  | 'copper'   // power 3
  | 'iron'     // power 4
  | 'mithril'; // power 5

export const PICKAXE_TIER_ORDER: PickaxeTier[] = [
  'wooden', 'stone', 'copper', 'iron', 'mithril',
];

export interface PickaxeTierData {
  tier: PickaxeTier;
  power: number;            // wall tier this can mine (also next tier = power)
  name: string;
  icon: string;
  description: string;
  // Hits-to-break multiplier — higher tier = fewer hits on the same wall.
  // Hits = ceil(BASE_HITS_PER_WALL_TIER[wallTier] / speed).
  speed: number;
  // Materials needed to craft (if base tier) or upgrade to this tier.
  materials: { materialId: string; quantity: number }[];
}

export const PICKAXE_TIERS: Record<PickaxeTier, PickaxeTierData> = {
  wooden: {
    tier: 'wooden',
    power: 1,
    name: 'Wooden Pickaxe',
    icon: '⛏️',
    description: 'A crude pick. Can chip away at soft Cavestone walls.',
    speed: 1,
    materials: [
      { materialId: 'wood_log', quantity: 5 },
    ],
  },
  stone: {
    tier: 'stone',
    power: 2,
    name: 'Stone Pickaxe',
    icon: '⛏️',
    description: 'Sturdier head. Mines Cavestone faster and breaks Deepstone.',
    speed: 2,
    materials: [
      { materialId: 'wood_log', quantity: 3 },
      { materialId: 'cavestone', quantity: 8 },
    ],
  },
  copper: {
    tier: 'copper',
    power: 3,
    name: 'Copper Pickaxe',
    icon: '⛏️',
    description: 'Metal-tipped. Bites through Coreshard.',
    speed: 3,
    materials: [
      { materialId: 'copper_ore', quantity: 4 },
      { materialId: 'deepstone', quantity: 6 },
    ],
  },
  iron: {
    tier: 'iron',
    power: 4,
    name: 'Iron Pickaxe',
    icon: '⛏️',
    description: 'Heavy iron head. Cleaves rock with ease.',
    speed: 4,
    materials: [
      { materialId: 'iron_ore', quantity: 5 },
      { materialId: 'coreshard', quantity: 4 },
    ],
  },
  mithril: {
    tier: 'mithril',
    power: 5,
    name: 'Mithril Pickaxe',
    icon: '⛏️',
    description: 'Legendary. Reserved for the dungeon\'s deepest minerals.',
    speed: 6,
    materials: [
      { materialId: 'mythril_ore', quantity: 3 },
      { materialId: 'coreshard', quantity: 8 },
      { materialId: 'iron_ore', quantity: 6 },
    ],
  },
};

// ----- Mineable wall tiers -----
// Tier 1 = Cavestone (soft), 2 = Deepstone, 3 = Coreshard (deep ore).
export type MineableWallTier = 1 | 2 | 3;

export interface MineableWallTierData {
  tier: MineableWallTier;
  name: string;
  // Material dropped when broken
  materialId: string;
  // Color tint for the wall sprite (HSL, used by TileGraphics)
  fill: string;
  ore: string;     // ore-vein highlight color
  // Base hits required with a power-1 pickaxe. Real cost = ceil(base / speed).
  baseHits: number;
  // Quantity dropped per break (random 1..maxDrop)
  maxDrop: number;
}

export const MINEABLE_WALL_TIERS: Record<MineableWallTier, MineableWallTierData> = {
  1: {
    tier: 1,
    name: 'Cavestone',
    materialId: 'cavestone',
    fill: 'hsl(28 25% 38%)',
    ore: 'hsl(35 45% 55%)',
    baseHits: 3,
    maxDrop: 2,
  },
  2: {
    tier: 2,
    name: 'Deepstone',
    materialId: 'deepstone',
    fill: 'hsl(220 18% 32%)',
    ore: 'hsl(200 50% 55%)',
    baseHits: 5,
    maxDrop: 2,
  },
  3: {
    tier: 3,
    name: 'Coreshard',
    materialId: 'coreshard',
    fill: 'hsl(280 25% 28%)',
    ore: 'hsl(290 70% 65%)',
    baseHits: 8,
    maxDrop: 3,
  },
};

// ----- Shovel tier ladder -----
// Shovels harvest *surface* tiles (rune terrains, grass, dirt, plants) —
// the complement to pickaxes (which mine walls). Tier gates which surface
// tiles can be dug; speed reduces hits-to-break.
export type ShovelTier =
  | 'wooden'   // power 1: dirt, grass, basic rubble runes
  | 'stone'    // power 2: water/lava/vents runes
  | 'copper'   // power 3: spikes/lasers/acid runes
  | 'iron'     // power 4: tendrils/psychic/shadow runes
  | 'mithril'; // power 5: legendary runes (future)

export const SHOVEL_TIER_ORDER: ShovelTier[] = [
  'wooden', 'stone', 'copper', 'iron', 'mithril',
];

export interface ShovelTierData {
  tier: ShovelTier;
  power: number;
  name: string;
  icon: string;
  description: string;
  speed: number;
  materials: { materialId: string; quantity: number }[];
}

export const SHOVEL_TIERS: Record<ShovelTier, ShovelTierData> = {
  wooden: {
    tier: 'wooden',
    power: 1,
    name: 'Wooden Shovel',
    icon: '🪏',
    description: 'A simple spade. Digs grass, dirt, and basic earth runes.',
    speed: 1,
    materials: [
      { materialId: 'wood_log', quantity: 5 },
    ],
  },
  stone: {
    tier: 'stone',
    power: 2,
    name: 'Stone Shovel',
    icon: '🪏',
    description: 'Wedge-tipped. Pries up elemental runes (water, fire, air).',
    speed: 2,
    materials: [
      { materialId: 'wood_log', quantity: 3 },
      { materialId: 'cavestone', quantity: 6 },
    ],
  },
  copper: {
    tier: 'copper',
    power: 3,
    name: 'Copper Shovel',
    icon: '🪏',
    description: 'Sharper edge. Carves out kinetic, energy, and chemical runes.',
    speed: 3,
    materials: [
      { materialId: 'copper_ore', quantity: 4 },
      { materialId: 'deepstone', quantity: 5 },
    ],
  },
  iron: {
    tier: 'iron',
    power: 4,
    name: 'Iron Shovel',
    icon: '🪏',
    description: 'Heavy-duty. Uproots biological, political, and void runes.',
    speed: 4,
    materials: [
      { materialId: 'iron_ore', quantity: 5 },
      { materialId: 'coreshard', quantity: 3 },
    ],
  },
  mithril: {
    tier: 'mithril',
    power: 5,
    name: 'Mithril Shovel',
    icon: '🪏',
    description: 'Legendary. Reserved for the rarest sigils yet to be discovered.',
    speed: 6,
    materials: [
      { materialId: 'mythril_ore', quantity: 3 },
      { materialId: 'coreshard', quantity: 6 },
      { materialId: 'iron_ore', quantity: 4 },
    ],
  },
};

export function nextShovelTier(current: ShovelTier | undefined): ShovelTier | null {
  if (!current) return 'wooden';
  const idx = SHOVEL_TIER_ORDER.indexOf(current);
  if (idx === -1 || idx === SHOVEL_TIER_ORDER.length - 1) return null;
  return SHOVEL_TIER_ORDER[idx + 1];
}

// Player's tool collection: at most one of each kind, with a current tier.
// Persisted on SaveData under `tools`.
export interface PlayerTools {
  pickaxe?: PickaxeTier; // undefined = not yet crafted
  shovel?: ShovelTier;   // undefined = not yet crafted
  workstation?: boolean; // true = owns Portable Workstation (singleton, no tiers)
}

// ----- Workstation -----
// Singleton tool with no tier ladder. Once crafted, the player can open the
// crafting workshop anywhere (dungeon or overworld) via a sidebar button.
export interface WorkstationData {
  name: string;
  icon: string;
  description: string;
  materials: { materialId: string; quantity: number }[];
}

export const WORKSTATION: WorkstationData = {
  name: 'Portable Workstation',
  icon: '🛠️',
  description: 'A folding bench, anvil, and alchemy kit. Lets you open the crafting workshop anywhere.',
  materials: [
    { materialId: 'iron_ore', quantity: 4 },
    { materialId: 'wood_log', quantity: 4 },
    { materialId: 'silk', quantity: 2 },
  ],
};

// What tier of mineable wall does this dungeon floor produce?
// Floors 1-3 = tier 1, 4-7 = mix of 1 & 2, 8+ = mix of all three.
export function getWallTierForFloor(floor: number): MineableWallTier {
  const r = Math.random();
  if (floor <= 3) return 1;
  if (floor <= 7) return r < 0.7 ? 1 : 2;
  if (floor <= 12) return r < 0.4 ? 1 : r < 0.85 ? 2 : 3;
  return r < 0.2 ? 1 : r < 0.6 ? 2 : 3;
}

// Number of hits needed to break a wall of `wallTier` with `pickaxeTier`.
// Returns Infinity if the pickaxe is too weak.
export function hitsToBreak(wallTier: MineableWallTier, pickaxeTier: PickaxeTier | undefined): number {
  if (!pickaxeTier) return Infinity;
  const pickPower = PICKAXE_TIERS[pickaxeTier].power;
  if (pickPower < wallTier) return Infinity;
  const speed = PICKAXE_TIERS[pickaxeTier].speed;
  const base = MINEABLE_WALL_TIERS[wallTier].baseHits;
  return Math.max(1, Math.ceil(base / speed));
}

// Random drop quantity when a wall breaks.
export function rollWallDrop(wallTier: MineableWallTier): { materialId: string; quantity: number } {
  const data = MINEABLE_WALL_TIERS[wallTier];
  return {
    materialId: data.materialId,
    quantity: 1 + Math.floor(Math.random() * data.maxDrop),
  };
}

// What's the next tier the player can craft / upgrade to?
// Returns null if they already own the max tier.
export function nextPickaxeTier(current: PickaxeTier | undefined): PickaxeTier | null {
  if (!current) return 'wooden';
  const idx = PICKAXE_TIER_ORDER.indexOf(current);
  if (idx === -1 || idx === PICKAXE_TIER_ORDER.length - 1) return null;
  return PICKAXE_TIER_ORDER[idx + 1];
}
