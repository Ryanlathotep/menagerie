// Keyboard shortcut legend shown beneath the overworld / dungeon maps.
// Presentational only — it reads the per-character move keybinds from the
// existing keybind store so the list stays in sync with the Character menu.

import { useEffect, useState } from 'react';
import { Monster } from './types';
import { getMonsterMoves } from './moves';
import { loadKeybinds, getMonsterKeybinds, getKeyLabel } from './keybinds';

interface KeybindLegendProps {
  context: 'overworld' | 'dungeon';
  monster?: Monster | null;
}

const SHARED: Array<[string, string]> = [
  ['W A S D / ↑ ↓ ← →', 'Move (double-tap to auto-run)'],
  ['Space', 'Stop all automation'],
  ['Shift + 1–9', 'Use inventory hotbar item'],
  ['Right-click / long-press', 'Tile menu (attack, harvest, build…)'],
];

const OVERWORLD_ONLY: Array<[string, string]> = [
  ['B', 'Build & Roads'],
  ['H', 'Auto-Hunt'],
  ['F', 'Auto-Search'],
  ['Esc', 'Cancel build / targeting'],
];

const DUNGEON_ONLY: Array<[string, string]> = [
  ['Esc', 'Cancel targeting'],
];

export function KeybindLegend({ context, monster }: KeybindLegendProps) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick(t => t + 1);
    window.addEventListener('menagerie:keybinds-changed', bump);
    window.addEventListener('storage', bump);
    return () => {
      window.removeEventListener('menagerie:keybinds-changed', bump);
      window.removeEventListener('storage', bump);
    };
  }, []);

  const rows = [...SHARED, ...(context === 'overworld' ? OVERWORLD_ONLY : DUNGEON_ONLY)];

  // Per-character move binds (voided by tick refresh above).
  const moveRows: Array<[string, string]> = [];
  if (monster) {
    void tick;
    const comboId = `${monster.species}_${monster.element}_${monster.class}`;
    const binds = getMonsterKeybinds(loadKeybinds(), comboId);
    if (Object.keys(binds).length > 0) {
      const moves = getMonsterMoves(monster.species, monster.element, monster.class, monster.level);
      for (const [moveId, key] of Object.entries(binds)) {
        const move = moves.find(m => m.id === moveId);
        if (move) moveRows.push([getKeyLabel(key), move.name]);
      }
    }
  }

  return (
    <details className="text-[10px] sm:text-xs text-muted-foreground">
      <summary className="cursor-pointer select-none font-semibold">⌨️ Keybindings</summary>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
        {[...rows, ...moveRows].map(([key, label], i) => (
          <span key={i} className="flex items-center gap-1 whitespace-nowrap">
            <kbd className="px-1 py-0.5 rounded border border-border bg-muted font-mono text-[9px] sm:text-[10px]">{key}</kbd>
            <span>{label}</span>
          </span>
        ))}
        {moveRows.length === 0 && monster && (
          <span className="italic">No move keybinds — set them in Character → Keys.</span>
        )}
      </div>
    </details>
  );
}
