// Persisted sort/filter preferences for moves and equipment

import { MoveSortOption, MoveFilterOption } from './MoveSortFilter';

const MOVE_FILTERS_KEY = 'monster-roguelike-move-filters';
const EQUIP_SORT_KEY = 'monster-roguelike-equip-sort';

export interface PersistedMoveFilters {
  sortOption: MoveSortOption;
  filters: MoveFilterOption[];
  searchQuery: string;
}

const DEFAULT_MOVE_FILTERS: PersistedMoveFilters = {
  sortOption: 'custom',
  filters: ['all'],
  searchQuery: '',
};

export function loadMoveFilters(): PersistedMoveFilters {
  try {
    const saved = localStorage.getItem(MOVE_FILTERS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_MOVE_FILTERS, ...parsed };
    }
  } catch (e) {
    console.error('Failed to load move filters:', e);
  }
  return DEFAULT_MOVE_FILTERS;
}

export function saveMoveFilters(filters: PersistedMoveFilters) {
  try {
    localStorage.setItem(MOVE_FILTERS_KEY, JSON.stringify(filters));
  } catch (e) {
    console.error('Failed to save move filters:', e);
  }
}

export function loadEquipSort(): { option: string; direction: string; statFilter?: string } | null {
  try {
    const saved = localStorage.getItem(EQUIP_SORT_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error('Failed to load equip sort:', e);
  }
  return null;
}

export function saveEquipSort(config: { option: string; direction: string; statFilter?: string }) {
  try {
    localStorage.setItem(EQUIP_SORT_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save equip sort:', e);
  }
}
