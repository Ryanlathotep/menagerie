// Scrolling list of all known dungeons grouped by category.
// Replaces the single Start Run button on the main menu.

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Trophy, ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react';
import { DungeonEntrance } from './types';
import { TowerLeaderboard } from './TowerLeaderboard';

interface DungeonListPanelProps {
  dungeonEntrances: Record<string, DungeonEntrance>;
  onLaunch: (entrance: DungeonEntrance) => void;
  /** Optional: when provided, each row shows a "Start" button that bypasses
   *  party-select + pre-run prep using the saved party + persisted gear.
   *  `startFloor` is honored when provided (clamped at call site). */
  onQuickStart?: (entrance: DungeonEntrance, startFloor?: number) => void;
  quickStartPartySize?: number;
  /** Highest level monster the player owns — used to compute the per-row
   *  max start floor (entrance.difficulty + floor(highestMonsterLevel/2)). */
  highestMonsterLevel?: number;
}

const ELEMENT_EMOJI: Record<string, string> = {
  fire: '🔥',
  water: '💧',
  earth: '🌿',
  air: '💨',
  void: '🌑',
  normal: '⚪',
};

const CLASS_EMOJI: Record<string, string> = {
  normal: '⚪',
  kinetic: '💥',
  energy: '⚡',
  biological: '🌱',
  chemical: '🧪',
  political: '👑',
};

const SPECIES_EMOJI: Record<string, string> = {
  slime: '🟢', skeleton: '💀', goblin: '👺', mushroom: '🍄', ghost: '👻',
  imp: '😈', golem: '🗿', wisp: '✨', chimera: '🦁', dragon: '🐉',
  rat: '🐀', spider: '🕷️', bat: '🦇', snake: '🐍', wolf: '🐺',
  beetle: '🪲', crow: '🐦‍⬛', shark: '🦈', frog: '🐸', jellyfish: '🪼',
};

function getThemeIcon(d: DungeonEntrance): string {
  if (d.isHome) return '🗼';
  if (d.theme?.kind === 'element' && d.theme.value) return ELEMENT_EMOJI[d.theme.value as string] || '✨';
  if (d.theme?.kind === 'class' && d.theme.value) return CLASS_EMOJI[d.theme.value as string] || '⚔️';
  if (d.theme?.kind === 'species' && d.theme.value) return SPECIES_EMOJI[d.theme.value as string] || '🐾';
  return '🏰';
}

function getThemeLabel(d: DungeonEntrance): string | null {
  if (d.isHome) return 'All species · All elements · All classes';
  if (d.theme?.kind === 'element' && d.theme.value) return `${String(d.theme.value)} element only`;
  if (d.theme?.kind === 'class' && d.theme.value) return `${String(d.theme.value)} class only`;
  if (d.theme?.kind === 'species' && d.theme.value) return `${String(d.theme.value)} species only`;
  return null;
}

function DungeonRow({ d, onLaunch, onQuickStart, quickStartPartySize, highestMonsterLevel }: {
  d: DungeonEntrance;
  onLaunch: (e: DungeonEntrance) => void;
  onQuickStart?: (e: DungeonEntrance, startFloor?: number) => void;
  quickStartPartySize?: number;
  highestMonsterLevel?: number;
}) {
  const cleared = d.deepestFloor > 0;
  const startingLevel = Math.max(1, d.difficulty || 1);
  const themeLabel = getThemeLabel(d);
  const icon = getThemeIcon(d);
  const [showBoard, setShowBoard] = useState(false);

  // Per-row start floor selection. Default to entrance.difficulty.
  // Max = entrance.difficulty + floor(highestMonsterLevel / 2), matching
  // the rule used in PreRunEquipment / CharacterSelect.
  const maxStartFloor = startingLevel + Math.floor(Math.max(1, highestMonsterLevel ?? 1) / 2);
  const canSkipFloors = maxStartFloor > startingLevel;
  const [startFloor, setStartFloor] = useState(startingLevel);
  const [showFloorPicker, setShowFloorPicker] = useState(false);
  // Clamp if highestMonsterLevel changes between renders.
  const effectiveStartFloor = Math.min(Math.max(startingLevel, startFloor), maxStartFloor);

  return (
    <div
      className={`border p-3 transition-colors ${
        d.isHome
          ? 'w-[calc(100%-10px)] border-primary/60 bg-gradient-to-r from-primary/10 to-secondary/10 mx-[5px] rounded-md shadow-none px-[10px]'
          : 'w-full rounded-md border-border bg-card'
      }`}
    >
      <button
        type="button"
        onClick={() => onLaunch(d)}
        className="w-full text-left hover:opacity-90"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-base">{icon}</span>
              <span className="font-semibold text-sm truncate">
                {d.name || `Dungeon at (${d.worldX}, ${d.worldY})`}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
              <span>Start Lv. <span className="text-foreground font-medium">{startingLevel}</span></span>
              <span>Floors <span className="text-foreground font-medium">∞</span></span>
              <span>
                Best floor:{' '}
                <span className={cleared ? 'text-foreground font-medium' : 'text-muted-foreground/60'}>
                  {cleared ? d.deepestFloor : '—'}
                </span>
              </span>
            </div>
            {themeLabel && (
              <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground/80 capitalize">
                {themeLabel}
              </div>
            )}
          </div>
          <div className="flex flex-col items-stretch gap-1 shrink-0">
            {onQuickStart ? (
              <>
                <Button
                  size="sm"
                  variant={d.isHome ? 'default' : 'secondary'}
                  className={d.isHome ? 'bg-gradient-to-r from-primary to-secondary' : ''}
                  title={`Skip prep — last saved party (${quickStartPartySize ?? 0})${
                    effectiveStartFloor !== startingLevel ? ` · Start at floor ${effectiveStartFloor}` : ''
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuickStart(d, effectiveStartFloor !== startingLevel ? effectiveStartFloor : undefined);
                  }}
                >
                  ▶️ Start{effectiveStartFloor !== startingLevel ? ` · F${effectiveStartFloor}` : ''}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-[11px]"
                  onClick={(e) => {
                    e.stopPropagation();
                    onLaunch(d);
                  }}
                >
                  Customize
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant={d.isHome ? 'default' : 'outline'}
                className={d.isHome ? 'bg-gradient-to-r from-primary to-secondary' : ''}
                onClick={(e) => {
                  e.stopPropagation();
                  onLaunch(d);
                }}
              >
                Enter
              </Button>
            )}
          </div>
        </div>
      </button>

      {/* Per-row "Start at floor" picker — only meaningful when quick-start
          is active AND the player has earned enough levels to skip floors. */}
      {onQuickStart && canSkipFloors && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowFloorPicker(s => !s)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <SlidersHorizontal className="w-3 h-3" />
            Start at floor: <span className="text-foreground font-medium">{effectiveStartFloor}</span>
            {showFloorPicker
              ? <ChevronUp className="w-3 h-3" />
              : <ChevronDown className="w-3 h-3" />}
          </button>
          {showFloorPicker && (
            <div className="mt-2 px-1 pb-1 space-y-1">
              <Slider
                min={startingLevel}
                max={maxStartFloor}
                step={1}
                value={[effectiveStartFloor]}
                onValueChange={(v) => setStartFloor(v[0] ?? startingLevel)}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>F{startingLevel} (entrance)</span>
                <span>F{maxStartFloor} (max)</span>
              </div>
              <p className="text-[10px] text-muted-foreground/80">
                Max skip = entrance + ½ of your highest monster level ({highestMonsterLevel ?? 1}).
              </p>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowBoard(s => !s)}
        className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <Trophy className="w-3 h-3 text-amber-500" />
        Leaderboard
        {showBoard
          ? <ChevronUp className="w-3 h-3" />
          : <ChevronDown className="w-3 h-3" />}
      </button>

      {showBoard && <TowerLeaderboard towerId={d.id} />}
    </div>
  );
}

function Section({ title, items, onLaunch, onQuickStart, quickStartPartySize, highestMonsterLevel }: {
  title: string;
  items: DungeonEntrance[];
  onLaunch: (e: DungeonEntrance) => void;
  onQuickStart?: (e: DungeonEntrance, startFloor?: number) => void;
  quickStartPartySize?: number;
  highestMonsterLevel?: number;
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80 px-1">{title}</div>
      {items.map(d => (
        <DungeonRow
          key={d.id}
          d={d}
          onLaunch={onLaunch}
          onQuickStart={onQuickStart}
          quickStartPartySize={quickStartPartySize}
          highestMonsterLevel={highestMonsterLevel}
        />
      ))}
    </div>
  );
}

export function DungeonListPanel({ dungeonEntrances, onLaunch, onQuickStart, quickStartPartySize, highestMonsterLevel }: DungeonListPanelProps) {
  const all = Object.values(dungeonEntrances || {});
  const isDiscovered = (d: DungeonEntrance) =>
    !!(d.isHome || d.discovered || d.deepestFloor > 0);

  const discovered = all.filter(isDiscovered);

  const sortByDifficulty = (a: DungeonEntrance, b: DungeonEntrance) => (a.difficulty || 1) - (b.difficulty || 1);

  const home = discovered.filter(d => d.isHome);
  const elementTowers = discovered.filter(d => d.category === 'element').sort(sortByDifficulty);
  const classTowers = discovered.filter(d => d.category === 'class').sort(sortByDifficulty);
  const speciesTowers = discovered.filter(d => d.category === 'species').sort(sortByDifficulty);
  const overworldDungeons = discovered.filter(d =>
    !d.isHome && (!d.category || d.category === 'procedural')
  ).sort(sortByDifficulty);

  const undiscoveredCount = all.length - discovered.length;

  const safeLaunch = (d: DungeonEntrance) => {
    if (!isDiscovered(d)) return;
    onLaunch(d);
  };
  const safeQuickStart = onQuickStart
    ? (d: DungeonEntrance, startFloor?: number) => { if (isDiscovered(d)) onQuickStart(d, startFloor); }
    : undefined;

  return (
    <Card className="p-3 w-full max-w-md mx-0 py-0">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <span>🗼</span> Known Dungeons
          <Badge variant="secondary" className="ml-1">{discovered.length}</Badge>
        </h3>
      </div>

      <ScrollArea className="h-[360px] pr-2">
        <div className="space-y-4">
          <Section title="Home" items={home} onLaunch={safeLaunch} onQuickStart={safeQuickStart} quickStartPartySize={quickStartPartySize} highestMonsterLevel={highestMonsterLevel} />
          <Section title="Elemental Towers" items={elementTowers} onLaunch={safeLaunch} onQuickStart={safeQuickStart} quickStartPartySize={quickStartPartySize} highestMonsterLevel={highestMonsterLevel} />
          <Section title="Class Towers" items={classTowers} onLaunch={safeLaunch} onQuickStart={safeQuickStart} quickStartPartySize={quickStartPartySize} highestMonsterLevel={highestMonsterLevel} />
          <Section title="Species Towers" items={speciesTowers} onLaunch={safeLaunch} onQuickStart={safeQuickStart} quickStartPartySize={quickStartPartySize} highestMonsterLevel={highestMonsterLevel} />
          <Section title="Overworld Dungeons" items={overworldDungeons} onLaunch={safeLaunch} onQuickStart={safeQuickStart} quickStartPartySize={quickStartPartySize} highestMonsterLevel={highestMonsterLevel} />

          {undiscoveredCount > 0 && (
            <div className="rounded-md border border-dashed border-muted-foreground/30 p-3 text-center text-xs text-muted-foreground">
              <span className="font-medium">🔍 {undiscoveredCount}</span> undiscovered{' '}
              {undiscoveredCount === 1 ? 'dungeon' : 'dungeons'} out in the world — explore the overworld to reveal them.
            </div>
          )}
        </div>
      </ScrollArea>

      <p className="mt-2 text-[10px] text-center text-muted-foreground/70">
        All towers have infinite floors. You can return here from any dungeon.
      </p>
    </Card>
  );
}
