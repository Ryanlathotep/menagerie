// Convert a legacy fixed-recipe (from equipment.ts CRAFTING_RECIPES) into a
// canonical CraftGrid so that dismantling a legacy item can write a matching
// entry into the grid-based recipe book. The layout is deterministic: expand
// each material's `quantity` into individual cells, then pack row-by-row into
// the smallest grid that fits (3, 4, or 5).

import type { CraftGrid, GridSize } from './types';
import { makeEmptyGrid } from './grid';
import type { CraftingRecipe } from '../equipment';

/** Pick the smallest square grid that can hold `n` cells. */
function fitGrid(n: number): GridSize {
  if (n <= 9) return 3;
  if (n <= 16) return 4;
  return 5;
}

/**
 * Deterministic grid for a legacy recipe. Materials are placed in
 * insertion order, filling the grid left-to-right / top-to-bottom.
 * Same recipe → same grid → same hash across all players.
 */
export function legacyRecipeToGrid(recipe: CraftingRecipe): { grid: CraftGrid; size: GridSize } {
  const flat: string[] = [];
  for (const m of recipe.materials) {
    for (let i = 0; i < Math.max(1, m.quantity); i++) flat.push(m.materialId);
  }
  const size = fitGrid(flat.length);
  const grid = makeEmptyGrid(size);
  let idx = 0;
  for (let r = 0; r < size && idx < flat.length; r++) {
    for (let c = 0; c < size && idx < flat.length; c++) {
      grid[r][c] = { materialId: flat[idx++], count: 1 };
    }
  }
  return { grid, size };
}
