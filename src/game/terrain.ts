// Terrain System - Environmental hazards and bonuses based on element/class

import { ElementType, ClassType, Monster } from './types';

// Terrain types mapped to their associated element or class
export type TerrainType = 
  | 'water'     // Water element
  | 'lava'      // Fire element
  | 'rubble'    // Earth element
  | 'vents'     // Air element
  | 'shadows'   // Void element
  | 'spikes'    // Kinetic class
  | 'lasers'    // Energy class
  | 'acid'      // Chemical class
  | 'tendrils'  // Biological class
  | 'psychic';  // Political class

// Terrain configuration
export interface TerrainConfig {
  type: TerrainType;
  name: string;
  icon: string;
  description: string;
  favoredElement?: ElementType;
  favoredClass?: ClassType;
  color: { from: string; to: string }; // Gradient colors
  glowColor: string;
}

// All terrain configurations
export const TERRAIN_CONFIG: Record<TerrainType, TerrainConfig> = {
  water: {
    type: 'water',
    name: 'Water',
    icon: '🌊',
    description: 'Deep water. Water element creatures thrive here.',
    favoredElement: 'water',
    color: { from: 'from-blue-300', to: 'to-cyan-400' },
    glowColor: 'shadow-blue-400/40',
  },
  lava: {
    type: 'lava',
    name: 'Lava',
    icon: '🔥',
    description: 'Molten rock. Fire element creatures thrive here.',
    favoredElement: 'fire',
    color: { from: 'from-orange-500', to: 'to-red-600' },
    glowColor: 'shadow-orange-500/50',
  },
  rubble: {
    type: 'rubble',
    name: 'Rubble',
    icon: '🪨',
    description: 'Rocky debris. Earth element creatures thrive here.',
    favoredElement: 'earth',
    color: { from: 'from-amber-600', to: 'to-yellow-800' },
    glowColor: 'shadow-amber-600/40',
  },
  vents: {
    type: 'vents',
    name: 'Vents',
    icon: '💨',
    description: 'Steam vents. Air element creatures thrive here.',
    favoredElement: 'air',
    color: { from: 'from-sky-200', to: 'to-slate-300' },
    glowColor: 'shadow-sky-300/40',
  },
  shadows: {
    type: 'shadows',
    name: 'Shadows',
    icon: '👁️',
    description: 'Dark patches. Void element creatures thrive here.',
    favoredElement: 'void',
    color: { from: 'from-purple-800', to: 'to-slate-900' },
    glowColor: 'shadow-purple-600/50',
  },
  spikes: {
    type: 'spikes',
    name: 'Spikes',
    icon: '⚔️',
    description: 'Sharp protrusions. Kinetic class creatures thrive here.',
    favoredClass: 'kinetic',
    color: { from: 'from-slate-400', to: 'to-zinc-600' },
    glowColor: 'shadow-slate-500/40',
  },
  lasers: {
    type: 'lasers',
    name: 'Lasers',
    icon: '⚡',
    description: 'Energy beams. Energy class creatures thrive here.',
    favoredClass: 'energy',
    color: { from: 'from-yellow-300', to: 'to-amber-500' },
    glowColor: 'shadow-yellow-400/50',
  },
  acid: {
    type: 'acid',
    name: 'Acid',
    icon: '🧪',
    description: 'Corrosive pools. Chemical class creatures thrive here.',
    favoredClass: 'chemical',
    color: { from: 'from-lime-400', to: 'to-green-600' },
    glowColor: 'shadow-lime-500/50',
  },
  tendrils: {
    type: 'tendrils',
    name: 'Tendrils',
    icon: '🦑',
    description: 'Living vines. Biological class creatures thrive here.',
    favoredClass: 'biological',
    color: { from: 'from-pink-400', to: 'to-rose-600' },
    glowColor: 'shadow-pink-500/50',
  },
  psychic: {
    type: 'psychic',
    name: 'Psychic Terrain',
    icon: '🔮',
    description: 'Mental resonance field. Political class creatures thrive here.',
    favoredClass: 'political',
    color: { from: 'from-indigo-400', to: 'to-violet-600' },
    glowColor: 'shadow-indigo-500/50',
  },
};

// Base terrain damage (applied when ending turn on non-favored terrain)
export const TERRAIN_DAMAGE = 2;

// Damage bonus when on favored terrain (percentage)
export const TERRAIN_DAMAGE_BONUS = 0.15; // 15% extra damage

// Check if a monster is favored on a terrain type
export function isMonsterFavoredOnTerrain(monster: Monster, terrainType: TerrainType): boolean {
  const config = TERRAIN_CONFIG[terrainType];
  
  // Check element match
  if (config.favoredElement && monster.element === config.favoredElement) {
    return true;
  }
  
  // Check class match
  if (config.favoredClass && monster.class === config.favoredClass) {
    return true;
  }
  
  return false;
}

// Calculate terrain damage for a monster on a terrain tile
// Returns 0 if monster is favored, TERRAIN_DAMAGE otherwise
export function calculateTerrainDamage(monster: Monster, terrainType: TerrainType): number {
  if (isMonsterFavoredOnTerrain(monster, terrainType)) {
    return 0;
  }
  return TERRAIN_DAMAGE;
}

// Get terrain type from element (for element-based terrains)
export function getTerrainForElement(element: ElementType): TerrainType | null {
  const mapping: Partial<Record<ElementType, TerrainType>> = {
    water: 'water',
    fire: 'lava',
    earth: 'rubble',
    air: 'vents',
    void: 'shadows',
  };
  return mapping[element] || null;
}

// Get terrain type from class (for class-based terrains)
export function getTerrainForClass(classType: ClassType): TerrainType | null {
  const mapping: Partial<Record<ClassType, TerrainType>> = {
    kinetic: 'spikes',
    energy: 'lasers',
    chemical: 'acid',
    biological: 'tendrils',
    political: 'psychic',
  };
  return mapping[classType] || null;
}

// Get a random terrain type
export function getRandomTerrainType(): TerrainType {
  const allTypes: TerrainType[] = [
    'water', 'lava', 'rubble', 'vents', 'shadows',
    'spikes', 'lasers', 'acid', 'tendrils', 'psychic'
  ];
  return allTypes[Math.floor(Math.random() * allTypes.length)];
}

// Get terrain info for tooltip display
export function getTerrainInfo(terrainType: TerrainType): TerrainConfig {
  return TERRAIN_CONFIG[terrainType];
}
