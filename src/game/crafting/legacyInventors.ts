// Flavor "inventor" names credited on recipes that originated in the legacy
// fixed-recipe list (pre-grid crafting). Used when the player dismantles a
// legacy item and we retroactively record the recipe in their book — the
// credit line reads "Invented by Old Gwen the Smith" instead of an empty
// space or the dismantler's own name.

import type { EquipmentSlot } from '../equipment';

export interface LegacyInventor {
  username: string;
  blurb: string;
}

const INVENTORS_BY_SLOT: Record<EquipmentSlot, LegacyInventor> = {
  mainHand:  { username: 'Old Gwen the Smith',   blurb: 'A retired blacksmith famed for practical blades.' },
  offHand:   { username: 'Bram Ironwall',        blurb: 'A shield-maker whose bulwarks turned back three sieges.' },
  helmet:    { username: 'Cappa the Tinsmith',   blurb: 'Traveling helm-maker of the northern roads.' },
  armor:     { username: 'Vera Threadwright',    blurb: 'Master armorer of the old guild halls.' },
  gloves:    { username: 'Nib the Fingersmith',  blurb: 'Loved by rogues and gardeners alike.' },
  boots:     { username: 'Marl the Cobbler',     blurb: 'Boots that outlast their wearers.' },
  accessory: { username: 'Sable the Jeweler',    blurb: 'Set the first star-sapphire ring.' },
  back:      { username: 'Wren of the Cloak',    blurb: 'Stitched the traveling cloaks of pilgrims.' },
};

/** Consumable recipes (potions, scrolls, kits) get their own herbalist. */
export const CONSUMABLE_INVENTOR: LegacyInventor = {
  username: 'Meadowfoot the Herbalist',
  blurb: 'Kept the old apothecary at the crossroads.',
};

export function getLegacyInventor(slot: EquipmentSlot | 'consumable' | 'scroll'): LegacyInventor {
  if (slot === 'consumable' || slot === 'scroll') return CONSUMABLE_INVENTOR;
  return INVENTORS_BY_SLOT[slot];
}
