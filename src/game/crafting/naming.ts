// Deterministic naming — same grid always yields the same name.
// Now always weaves in the primary material + a filler + optional station-tier prefix.

import { CRAFTING_MATERIALS } from '../equipment';
import type { ResolvedCraft } from './types';
import { getTierNamePrefix } from './stationTiers';
import { getMaterialNamePrefix } from './materialEffects';

const RARITY_PREFIX: Record<string, string> = {
  common: '',
  uncommon: 'Fine ',
  rare: 'Superior ',
  epic: 'Masterwork ',
  legendary: 'Legendary ',
};

const SUFFIX_STRIP = /(Ore|Ingot|Log|Hide|Scrap|Fragment|Shard|Bundle|Essence|Spore|Pepper|Mint|Root|Seed)$/i;

function shortMaterialWord(name: string): string {
  const last = name.split(' ').pop() ?? name;
  return last.replace(SUFFIX_STRIP, '').trim() || last;
}

/** Build a name from the resolved craft. Same craft.hash + station-tier → same name. */
export function buildCraftName(craft: ResolvedCraft, stationTier?: 1|2|3|4|5): string {
  const bp = craft.blueprint;
  // Primary = the material with the highest quantity in the whole grid.
  const sorted = [...craft.usedMaterials].sort((a, b) => b.quantity - a.quantity);
  const primary = sorted[0]
    ? CRAFTING_MATERIALS.find((m) => m.id === sorted[0].materialId)
    : null;
  // Secondary = first filler that isn't the primary.
  const filler = craft.fillerBreakdown.find((f) => f.materialId !== primary?.id);
  const fillerMat = filler ? CRAFTING_MATERIALS.find((m) => m.id === filler.materialId) : null;

  const primaryWord = primary ? shortMaterialWord(primary.name) : '';
  const base = primaryWord ? `${primaryWord} ${bp.name}`.trim() : bp.name;
  const suffix = fillerMat ? ` of ${shortMaterialWord(fillerMat.name)}` : '';
  // Station-tier prefix wins over rarity prefix once tier >= 3 (they'd read redundant).
  const tierPrefix = stationTier && stationTier >= 3 ? getTierNamePrefix(stationTier) : '';
  const rarityPrefix = tierPrefix ? '' : (RARITY_PREFIX[craft.rarity] ?? '');
  // Material-supplied prefix — comes from the dominant material or top filler.
  // Prefer filler's prefix (it's the "descriptor"), fall back to primary.
  const matPrefix =
    (fillerMat && getMaterialNamePrefix(fillerMat.id)) ||
    (primary && getMaterialNamePrefix(primary.id)) ||
    '';
  return `${tierPrefix}${rarityPrefix}${matPrefix}${base}${suffix}`.trim().replace(/\s+/g, ' ');
}
