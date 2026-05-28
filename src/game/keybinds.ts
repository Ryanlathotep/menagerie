// Keyboard Shortcut System
// Per-monster attack keybinds + Shift+1-9 inventory hotbar

// True when the event originated from an editable field (input, textarea,
// contentEditable, select). Used to suppress global game shortcuts so typing
// "d" in a bug-report textarea doesn't trigger the dungeon exit menu.
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  // shadcn Select / Radix combobox trigger
  if (target.getAttribute('role') === 'combobox') return true;
  return false;
}

const KEYBINDS_STORAGE_KEY = 'monster-roguelike-keybinds';

export interface MonsterKeybinds {
  // moveId -> key (e.g. "1", "q", "r")
  [moveId: string]: string;
}

export interface KeybindData {
  // monsterId -> { moveId: key }
  monsterKeybinds: Record<string, MonsterKeybinds>;
}

const DEFAULT_KEYBIND_DATA: KeybindData = {
  monsterKeybinds: {},
};

// Load keybinds from localStorage
export function loadKeybinds(): KeybindData {
  try {
    const saved = localStorage.getItem(KEYBINDS_STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_KEYBIND_DATA, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error('Failed to load keybinds:', e);
  }
  return DEFAULT_KEYBIND_DATA;
}

// Save keybinds to localStorage
export function saveKeybinds(data: KeybindData) {
  try {
    localStorage.setItem(KEYBINDS_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save keybinds:', e);
  }
}

// Get keybinds for a specific monster
export function getMonsterKeybinds(data: KeybindData, monsterId: string): MonsterKeybinds {
  return data.monsterKeybinds[monsterId] || {};
}

// Set a keybind for a move on a monster
export function setMoveKeybind(
  data: KeybindData,
  monsterId: string,
  moveId: string,
  key: string
): KeybindData {
  const monsterBinds = { ...getMonsterKeybinds(data, monsterId) };

  // Remove any existing bind for this key on this monster
  for (const [existingMoveId, existingKey] of Object.entries(monsterBinds)) {
    if (existingKey === key && existingMoveId !== moveId) {
      delete monsterBinds[existingMoveId];
    }
  }

  monsterBinds[moveId] = key;

  return {
    ...data,
    monsterKeybinds: {
      ...data.monsterKeybinds,
      [monsterId]: monsterBinds,
    },
  };
}

// Remove a keybind for a move
export function removeMoveKeybind(
  data: KeybindData,
  monsterId: string,
  moveId: string
): KeybindData {
  const monsterBinds = { ...getMonsterKeybinds(data, monsterId) };
  delete monsterBinds[moveId];

  return {
    ...data,
    monsterKeybinds: {
      ...data.monsterKeybinds,
      [monsterId]: monsterBinds,
    },
  };
}

// Find which move is bound to a key for a monster
export function getMoveForKey(
  data: KeybindData,
  monsterId: string,
  key: string
): string | null {
  const binds = getMonsterKeybinds(data, monsterId);
  for (const [moveId, boundKey] of Object.entries(binds)) {
    if (boundKey === key) return moveId;
  }
  return null;
}

// Get display label for a key
export function getKeyLabel(key: string): string {
  return key.length === 1 ? key.toUpperCase() : key;
}

// Valid keys for keybinding
export const VALID_KEYBIND_KEYS = [
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '0',
  'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p',
  'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l',
  'z', 'x', 'c', 'v', 'b', 'n', 'm',
];
