/**
 * Room prefab types — shared by arena AND future dungeon stamping.
 * Persisted in Supabase `game_data_overrides` under data_type='room'.
 */
import type { SpeciesType, ClassType, ElementType } from '@/game/types';

export type RoomCellKind =
  | 'floor'
  | 'wall'
  | 'door'
  | 'stairs_up'
  | 'stairs_down'
  | 'lever'
  | 'box'
  | 'trap_spike'
  | 'trap_dart'
  | 'entry'
  | 'exit'
  | 'chest';

export interface RoomCell {
  x: number;
  y: number;
  kind: RoomCellKind;
  tileKey?: string;
  enemySpawn?: {
    species?: SpeciesType;
    element?: ElementType;
    classType?: ClassType;
    levelBias?: number;
  };
  itemDrop?: { itemId: string; chance: number };
}

export interface RoomArenaMeta {
  floorColor: string;
  rimColor: string;
  crowdDensity: number;
  crowdSpecies?: SpeciesType[];
}

export interface Room {
  id: string;
  name: string;
  width: number;   // 4..48
  height: number;  // 4..48
  cells: RoomCell[];
  tags: string[];         // e.g. ['arena'], ['dungeon','boss']
  towerIds: string[];     // [] = all towers whose tag matches
  arena?: RoomArenaMeta;
  createdAt: number;
  updatedAt: number;
}

export const ROOM_TAGS = ['arena', 'dungeon', 'boss', 'treasure', 'puzzle', 'starter'] as const;
export type RoomTag = typeof ROOM_TAGS[number];

// Curated tower list for the editor's checkbox picker.
// Free-text custom IDs are also supported via the editor UI.
export const KNOWN_TOWER_IDS: Array<{ id: string; label: string; category: string }> = [
  { id: 'tower_of_the_infinite', label: 'Tower of the Infinite', category: 'Main' },
  { id: 'tower_prototyping',     label: 'Prototyping Tower',     category: 'Item-World' },
  { id: 'tower_training',        label: 'Training Tower',        category: 'Item-World' },
  { id: 'tower_skill_creation',  label: 'Skill Forge Tower',     category: 'Item-World' },
  // Elemental towers
  { id: 'tower_fire',    label: 'Fire Tower',    category: 'Elemental' },
  { id: 'tower_water',   label: 'Water Tower',   category: 'Elemental' },
  { id: 'tower_earth',   label: 'Earth Tower',   category: 'Elemental' },
  { id: 'tower_air',     label: 'Air Tower',     category: 'Elemental' },
  { id: 'tower_void',    label: 'Void Tower',    category: 'Elemental' },
  { id: 'tower_normal',  label: 'Normal Tower',  category: 'Elemental' },
  // Class towers
  { id: 'tower_tank',      label: 'Tank Tower',      category: 'Class' },
  { id: 'tower_bruiser',   label: 'Bruiser Tower',   category: 'Class' },
  { id: 'tower_assassin',  label: 'Assassin Tower',  category: 'Class' },
  { id: 'tower_mage',      label: 'Mage Tower',      category: 'Class' },
  { id: 'tower_ranger',    label: 'Ranger Tower',    category: 'Class' },
  { id: 'tower_support',   label: 'Support Tower',   category: 'Class' },
];
