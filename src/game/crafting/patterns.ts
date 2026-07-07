// Default item blueprints and their required-slot patterns.
// Admins can override any of these via the Craft Patterns editor.

import type { ItemBlueprint } from './types';

export const DEFAULT_BLUEPRINTS: ItemBlueprint[] = [
  // ---------------- BLADED WEAPONS ----------------
  {
    id: 'dagger',
    name: 'Dagger',
    icon: '🗡️',
    slot: 'mainHand',
    category: 'weapon_blade',
    minGrid: 3,
    baseStats: { attack: 4, speed: 2 },
    pattern: [
      { dx: 0, dy: 0, role: 'blade',  acceptTypes: ['metal', 'ore', 'bone'] },
      { dx: 0, dy: 1, role: 'handle', acceptTypes: ['wood', 'bone', 'hide'] },
    ],
  },
  {
    id: 'sword',
    name: 'Sword',
    icon: '⚔️',
    slot: 'mainHand',
    category: 'weapon_blade',
    minGrid: 3,
    baseStats: { attack: 7 },
    pattern: [
      { dx: 0, dy: 0, role: 'blade',  acceptTypes: ['metal', 'ore'] },
      { dx: 0, dy: 1, role: 'blade',  acceptTypes: ['metal', 'ore'] },
      { dx: 0, dy: 2, role: 'handle', acceptTypes: ['wood', 'bone', 'hide'] },
    ],
  },
  {
    id: 'axe',
    name: 'Axe',
    icon: '🪓',
    slot: 'mainHand',
    category: 'weapon_blade',
    minGrid: 3,
    baseStats: { attack: 9 },
    pattern: [
      { dx: 0, dy: 0, role: 'blade',  acceptTypes: ['metal', 'ore'] },
      { dx: 1, dy: 0, role: 'blade',  acceptTypes: ['metal', 'ore'] },
      { dx: 1, dy: 1, role: 'handle', acceptTypes: ['wood'] },
      { dx: 1, dy: 2, role: 'handle', acceptTypes: ['wood'] },
    ],
  },
  // ---------------- RANGED / MAGIC ----------------
  {
    id: 'bow',
    name: 'Bow',
    icon: '🏹',
    slot: 'mainHand',
    category: 'weapon_ranged',
    minGrid: 3,
    baseStats: { attack: 5, speed: 3 },
    pattern: [
      { dx: 0, dy: 0, role: 'handle', acceptTypes: ['wood'] },
      { dx: 0, dy: 1, role: 'handle', acceptTypes: ['wood'] },
      { dx: 0, dy: 2, role: 'binder', acceptTypes: ['fabric', 'hide'] },
    ],
  },
  {
    id: 'staff',
    name: 'Staff',
    icon: '🪄',
    slot: 'mainHand',
    category: 'weapon_ranged',
    minGrid: 3,
    baseStats: { attack: 3, special: 6 },
    pattern: [
      { dx: 0, dy: 0, role: 'catalyst', acceptTypes: ['gem', 'essence', 'element', 'mote'] },
      { dx: 0, dy: 1, role: 'handle',   acceptTypes: ['wood'] },
      { dx: 0, dy: 2, role: 'handle',   acceptTypes: ['wood'] },
    ],
  },
  // ---------------- OFFHAND ----------------
  {
    id: 'shield',
    name: 'Shield',
    icon: '🛡️',
    slot: 'offHand',
    category: 'armor_heavy',
    minGrid: 3,
    baseStats: { defense: 6 },
    pattern: [
      { dx: 0, dy: 0, role: 'guard', acceptTypes: ['metal', 'ore'] },
      { dx: 1, dy: 0, role: 'guard', acceptTypes: ['metal', 'ore'] },
      { dx: 0, dy: 1, role: 'binder', acceptTypes: ['wood', 'hide'] },
      { dx: 1, dy: 1, role: 'binder', acceptTypes: ['wood', 'hide'] },
    ],
  },
  // ---------------- ARMOR ----------------
  {
    id: 'helm',
    name: 'Helm',
    icon: '⛑️',
    slot: 'helmet',
    category: 'armor_heavy',
    minGrid: 3,
    baseStats: { defense: 3, maxHp: 5 },
    pattern: [
      { dx: 0, dy: 0, role: 'guard', acceptTypes: ['metal', 'ore'] },
      { dx: 1, dy: 0, role: 'guard', acceptTypes: ['metal', 'ore'] },
      { dx: 0, dy: 1, role: 'binder', acceptTypes: ['hide', 'fabric'] },
    ],
  },
  {
    id: 'chestplate',
    name: 'Chestplate',
    icon: '🦺',
    slot: 'armor',
    category: 'armor_heavy',
    minGrid: 3,
    baseStats: { defense: 8, maxHp: 10 },
    pattern: [
      { dx: 0, dy: 0, role: 'guard', acceptTypes: ['metal', 'ore'] },
      { dx: 1, dy: 0, role: 'guard', acceptTypes: ['metal', 'ore'] },
      { dx: 0, dy: 1, role: 'guard', acceptTypes: ['metal', 'ore'] },
      { dx: 1, dy: 1, role: 'guard', acceptTypes: ['metal', 'ore'] },
      { dx: 0, dy: 2, role: 'binder', acceptTypes: ['hide', 'fabric'] },
    ],
  },
  {
    id: 'leather_tunic',
    name: 'Leather Tunic',
    icon: '🥋',
    slot: 'armor',
    category: 'armor_light',
    minGrid: 3,
    baseStats: { defense: 4, dodge: 3 },
    pattern: [
      { dx: 0, dy: 0, role: 'binder', acceptTypes: ['hide'] },
      { dx: 1, dy: 0, role: 'binder', acceptTypes: ['hide'] },
      { dx: 0, dy: 1, role: 'binder', acceptTypes: ['hide', 'fabric'] },
    ],
  },
  {
    id: 'gloves',
    name: 'Gloves',
    icon: '🧤',
    slot: 'gloves',
    category: 'armor_light',
    minGrid: 3,
    baseStats: { defense: 1, dodge: 1 },
    pattern: [
      { dx: 0, dy: 0, role: 'binder', acceptTypes: ['hide', 'fabric'] },
      { dx: 0, dy: 1, role: 'binder', acceptTypes: ['hide', 'fabric'] },
    ],
  },
  {
    id: 'boots',
    name: 'Boots',
    icon: '🥾',
    slot: 'boots',
    category: 'armor_light',
    minGrid: 3,
    baseStats: { defense: 2, speed: 2 },
    pattern: [
      { dx: 0, dy: 0, role: 'binder', acceptTypes: ['hide'] },
      { dx: 1, dy: 0, role: 'binder', acceptTypes: ['hide'] },
    ],
  },
  // ---------------- ACCESSORY ----------------
  {
    id: 'ring',
    name: 'Ring',
    icon: '💍',
    slot: 'accessory',
    category: 'accessory',
    minGrid: 3,
    baseStats: { special: 2 },
    pattern: [
      { dx: 0, dy: 0, role: 'guard',    acceptTypes: ['metal', 'ore'] },
      { dx: 0, dy: 1, role: 'catalyst', acceptTypes: ['gem'] },
    ],
  },
  {
    id: 'amulet',
    name: 'Amulet',
    icon: '📿',
    slot: 'accessory',
    category: 'accessory',
    minGrid: 3,
    baseStats: { special: 3, maxHp: 5 },
    pattern: [
      { dx: 0, dy: 0, role: 'binder',   acceptTypes: ['fabric', 'hide'] },
      { dx: 0, dy: 1, role: 'catalyst', acceptTypes: ['gem', 'essence'] },
    ],
  },
  // ---------------- CONSUMABLE ----------------
  {
    id: 'potion',
    name: 'Potion',
    icon: '🧪',
    slot: 'consumable',
    category: 'consumable',
    minGrid: 3,
    baseStats: {},
    effectId: 'heal_hp',
    pattern: [
      { dx: 0, dy: 0, role: 'base', acceptTypes: ['essence', 'mote'] },
      { dx: 0, dy: 1, role: 'base', acceptTypes: ['herb'] },
    ],
  },
  // ---------------- SCROLL ----------------
  {
    id: 'scroll',
    name: 'Scroll',
    icon: '📜',
    slot: 'scroll',
    category: 'scroll',
    minGrid: 3,
    baseStats: {},
    effectId: 'recipe',
    pattern: [
      { dx: 0, dy: 0, role: 'seal',     acceptTypes: ['fabric', 'hide'] },
      { dx: 0, dy: 1, role: 'catalyst', acceptTypes: ['essence', 'gem', 'rune'] },
    ],
  },
];

export function getBlueprint(id: string): ItemBlueprint | undefined {
  return DEFAULT_BLUEPRINTS.find((b) => b.id === id);
}
