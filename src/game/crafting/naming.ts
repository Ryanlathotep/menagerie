// Deterministic naming — same grid always yields the same name.

import { CRAFTING_MATERIALS } from '../equipment';
import type { ResolvedCraft } from './types';

const RARITY_PREFIX: Record<string, string> = {
  common: '',
  uncommon: 'Fine ',
  rare: 'Superior ',
  epic: 'Masterwork ',
  legendary: 'Legendary ',
};

/** Build a name from the resolved craft. Same craft.hash → same name. */
export function buildCraftName(craft: ResolvedCraft): string {
  const bp = craft.blueprint;
  // Primary = the material used most.
  const sorted = [...craft.usedMaterials].sort((a, b) => b.quantity - a.quantity);
  const primary = sorted[0]
    ? CRAFTING_MATERIALS.find((m) => m.id === sorted[0].materialId)
    : null;
  // Secondary = a filler distinct from primary, if any.
  const filler = craft.fillerBreakdown.find((f) => f.materialId !== primary?.id);
  const fillerMat = filler ? CRAFTING_MATERIALS.find((m) => m.id === filler.materialId) : null;

  const primaryWord = primary
    ? primary.name.split(' ').slice(-1)[0].replace(/(Ore|Ingot|Log|Hide|Scrap|Fragment)$/i, '').trim() ||
      primary.name
    : '';
  const base = primaryWord ? `${primaryWord} ${bp.name}`.trim() : bp.name;
  const suffix = fillerMat ? ` of ${fillerMat.name.replace(/(Ore|Ingot|Log|Hide|Scrap|Fragment)$/i, '').trim() || fillerMat.name}` : '';
  return `${RARITY_PREFIX[craft.rarity] ?? ''}${base}${suffix}`.trim();
}
