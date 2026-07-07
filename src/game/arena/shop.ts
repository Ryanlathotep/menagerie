/**
 * Arena-exclusive equipment. Not craftable, not lootable — only buyable
 * with arena tokens from the Arena Hub shop.
 *
 * Uses the same EquipmentItem shape so it slots straight into existing
 * inventory / equip flows.
 */
import type { EquipmentItem } from '@/game/equipment';

export interface ArenaShopEntry {
  cost: number;         // arena tokens
  item: EquipmentItem;
  flavor: string;
}

export const ARENA_SHOP: ArenaShopEntry[] = [
  {
    cost: 40,
    flavor: '+crit chance',
    item: {
      id: 'arena_gladiators_edge',
      name: "Gladiator's Edge",
      slot: 'mainHand',
      rarity: 'epic',
      level: 20,
      stats: { attack: 18, special: 6 },
      description: '+15% critical hit chance in the arena and beyond.',
      icon: '⚔️',
      setId: 'arena_gladiator',
      bound: true,
    },
  },
  {
    cost: 40,
    flavor: '+dodge',
    item: {
      id: 'arena_duelists_cloak',
      name: "Duelist's Cloak",
      slot: 'back',
      rarity: 'epic',
      level: 20,
      stats: { defense: 8, dodge: 14 },
      description: '+10 flat dodge and a swirl of tournament dust.',
      icon: '🧣',
      setId: 'arena_gladiator',
      bound: true,
    },
  },
  {
    cost: 40,
    flavor: '+evasion',
    item: {
      id: 'arena_phantom_sash',
      name: 'Phantom Sash',
      slot: 'accessory',
      rarity: 'epic',
      level: 20,
      stats: { dodge: 10, speed: 8 },
      description: '+8 evasion and priority on the first turn.',
      icon: '🎗️',
      setId: 'arena_gladiator',
      bound: true,
    },
  },
  {
    cost: 30,
    flavor: '+fire DoT',
    item: {
      id: 'arena_emberheart_ring',
      name: 'Emberheart Ring',
      slot: 'accessory',
      rarity: 'rare',
      level: 20,
      stats: { special: 10, attack: 4 },
      element: 'fire',
      description: 'Burns tick for +30% damage.',
      icon: '💍',
      bound: true,
    },
  },
  {
    cost: 30,
    flavor: '+void DoT',
    item: {
      id: 'arena_venomtongue_ring',
      name: 'Venomtongue Ring',
      slot: 'accessory',
      rarity: 'rare',
      level: 20,
      stats: { special: 10, dodge: 4 },
      element: 'void',
      description: 'Poison ticks for +30% damage.',
      icon: '💍',
      bound: true,
    },
  },
  {
    cost: 30,
    flavor: '+water DoT',
    item: {
      id: 'arena_frostbite_ring',
      name: 'Frostbite Ring',
      slot: 'accessory',
      rarity: 'rare',
      level: 20,
      stats: { special: 10, defense: 4 },
      element: 'water',
      description: 'Freeze ticks and bleed both amplified +30%.',
      icon: '💍',
      bound: true,
    },
  },
];
