// Scrolling list of all known dungeons grouped by category.
// Replaces the single Start Run button on the main menu.

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trophy, ChevronDown, ChevronUp } from 'lucide-react';
import { DungeonEntrance } from './types';
import { TowerLeaderboard } from './TowerLeaderboard';

interface DungeonListPanelProps {
  dungeonEntrances: Record<string, DungeonEntrance>;
  onLaunch: (entrance: DungeonEntrance) => void;
  /** Optional: when provided, each row shows a "Start" button that bypasses
   *  party-select + pre-run prep using the saved party + persisted gear. */
  onQuickStart?: (entrance: DungeonEntrance) => void;
  quickStartPartySize?: number;
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

function DungeonRow({ d, onLaunch, onQuickStart, quickStartPartySize }: {
  d: DungeonEntrance;
  onLaunch: (e: DungeonEntrance) => void;
  onQuickStart?: (e: DungeonEntrance) => void;
  quickStartPartySize?: number;
}) {
  const cleared = d.deepestFloor > 0;
  const startingLevel = Math.max(1, d.difficulty || 1);
  const themeLabel = getThemeLabel(d);
  const icon = getThemeIcon(d);
  const [showBoard, setShowBoard] = useState(false);

  return (
    <div
      className={`w-full rounded-md border p-3 transition-colors ${
        d.isHome
          ? 'border-primary/60 bg-gradient-to-r from-primary/10 to-secondary/10'
          : 'border-border bg-card'
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
            {onQuickStart && (
              <Button
                size="sm"
                variant="secondary"
                className="text-[11px]"
                title={`Skip prep — last saved party (${quickStartPartySize ?? 0})`}
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickStart(d);
                }}
              >
                ▶️ Start
              </Button>
            )}
          </div>
        </div>
      </button>


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

function Section({ title, items, onLaunch, onQuickStart, quickStartPartySize }: {
  title: string;
  items: DungeonEntrance[];
  onLaunch: (e: DungeonEntrance) => void;
  onQuickStart?: (e: DungeonEntrance) => void;
  quickStartPartySize?: number;
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
        />
      ))}
    </div>
  );
}

export function DungeonListPanel({ dungeonEntrances, onLaunch }: DungeonListPanelProps) {
  const all = Object.values(dungeonEntrances || {});
  // A dungeon counts as discovered once the player has physically seen it on
  // the overworld (or already cleared a floor in it). Home is always visible.
  // Themed towers no longer auto-reveal — the player must explore to them.
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

  // Defense in depth: never let an undiscovered dungeon be launched, even if
  // somehow surfaced through stale UI.
  const safeLaunch = (d: DungeonEntrance) => {
    if (!isDiscovered(d)) return;
    onLaunch(d);
  };


  return (
    <Card className="p-3 w-full max-w-md mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <span>🗼</span> Known Dungeons
          <Badge variant="secondary" className="ml-1">{discovered.length}</Badge>
        </h3>
      </div>

      <ScrollArea className="h-[360px] pr-2">
        <div className="space-y-4">
          <Section title="Home" items={home} onLaunch={safeLaunch} />
          <Section title="Elemental Towers" items={elementTowers} onLaunch={safeLaunch} />
          <Section title="Class Towers" items={classTowers} onLaunch={safeLaunch} />
          <Section title="Species Towers" items={speciesTowers} onLaunch={safeLaunch} />
          <Section title="Overworld Dungeons" items={overworldDungeons} onLaunch={safeLaunch} />

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
