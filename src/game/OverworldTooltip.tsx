// Overworld tile tooltip content — gives the player at-a-glance info about
// any tile they hover (resources, dungeons, base, water, roads, fog, enemies, nests).

import { OverworldTile } from './overworld';
import { BUILDING_UPGRADES } from './overworld';
import { TREE_TIER_DATA, STONE_TIER_DATA } from './resourceHierarchy';
import { DungeonEntrance, Monster, ElementType } from './types';
import { PlayerBuilding } from './buildings';
import { NestState } from './nests';

interface Props {
  tile: OverworldTile;
  worldX: number;
  worldY: number;
  dungeonEntrance?: DungeonEntrance;
  enemy?: Monster | null;
  nest?: NestState;
  playerBuilding?: PlayerBuilding;
}

const ELEMENT_EMOJI: Record<string, string> = {
  fire: '🔥', water: '💧', earth: '🌿', air: '💨', void: '🌑',
  grass: '🍃', electric: '⚡', ice: '❄️', metal: '⚙️', normal: '⚪',
};

export function OverworldTooltipContent({
  tile, worldX, worldY, dungeonEntrance, enemy, nest, playerBuilding,
}: Props) {
  const coords = (
    <span className="text-[10px] text-muted-foreground">({worldX}, {worldY})</span>
  );

  // Unexplored fog
  if (!tile.explored && !tile.visible) {
    return (
      <div className="space-y-1 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-sm">🌫️ Unexplored</span>
          {coords}
        </div>
        <p className="text-muted-foreground italic">
          Move closer to reveal what's here.
        </p>
      </div>
    );
  }

  // Out-of-sight but previously explored
  const dim = tile.explored && !tile.visible;

  switch (tile.type) {
    case 'tree': {
      const tier = tile.treeTier || 'oak';
      const data = TREE_TIER_DATA[tier];
      const remaining = tile.resourceAmount ?? data.totalHits;
      return (
        <div className="space-y-1 text-xs">
          <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-1">
            <span className="font-bold text-sm">{data.emoji} {data.name} Tree</span>
            {coords}
          </div>
          <p className="text-muted-foreground italic">
            Walk into it to chop wood with your equipped axe.
          </p>
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
            <span className="text-muted-foreground">Yield/hit:</span>
            <span>🪵 +{data.harvestYield}</span>
            <span className="text-muted-foreground">Hits left:</span>
            <span>{remaining}/{data.totalHits}</span>
            {data.materialId && data.materialChance && (
              <>
                <span className="text-muted-foreground">Bonus drop:</span>
                <span className="text-amber-600 dark:text-amber-400">
                  {Math.round(data.materialChance * 100)}% rare material
                </span>
              </>
            )}
            {data.upgradeSteps != null && (
              <>
                <span className="text-muted-foreground">Upgrades in:</span>
                <span>~{data.upgradeSteps} steps</span>
              </>
            )}
          </div>
          {dim && <p className="text-[10px] text-muted-foreground italic">Last seen — info may be stale.</p>}
        </div>
      );
    }

    case 'rock': {
      const tier = tile.stoneTier || 'stone';
      const data = STONE_TIER_DATA[tier];
      const remaining = tile.resourceAmount ?? data.totalHits;
      return (
        <div className="space-y-1 text-xs">
          <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-1">
            <span className="font-bold text-sm">{data.emoji} {data.name}</span>
            {coords}
          </div>
          <p className="text-muted-foreground italic">
            Walk into it to mine with your equipped pickaxe.
          </p>
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
            <span className="text-muted-foreground">Yield/hit:</span>
            <span>🪨 +{data.harvestYield}</span>
            <span className="text-muted-foreground">Hits left:</span>
            <span>{remaining}/{data.totalHits}</span>
            {data.materialId && data.materialChance && (
              <>
                <span className="text-muted-foreground">Bonus drop:</span>
                <span className="text-amber-600 dark:text-amber-400">
                  {Math.round(data.materialChance * 100)}% ore
                </span>
              </>
            )}
            {data.upgradeSteps != null && (
              <>
                <span className="text-muted-foreground">Upgrades in:</span>
                <span>~{data.upgradeSteps} steps</span>
              </>
            )}
          </div>
          {dim && <p className="text-[10px] text-muted-foreground italic">Last seen — info may be stale.</p>}
        </div>
      );
    }

    case 'water':
      return (
        <div className="space-y-1 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-sm">💧 Water</span>
            {coords}
          </div>
          <p className="text-muted-foreground italic">Impassable — find another way around.</p>
        </div>
      );

    case 'grass':
      return (
        <div className="space-y-1 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-sm">
              {tile.harvested ? '🌾 Cleared Grass' : '🍃 Grass'}
            </span>
            {coords}
          </div>
          <p className="text-muted-foreground italic">
            {tile.harvested
              ? 'A harvested patch — safe to walk on.'
              : 'Open ground — safe to walk on. Build or place items here.'}
          </p>
        </div>
      );

    case 'dirt_road':
      return (
        <div className="space-y-1 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-sm">🛤️ Dirt Road</span>
            {coords}
          </div>
          <p className="text-muted-foreground italic">
            A worn path. Slightly reduces enemy spawns.
          </p>
        </div>
      );

    case 'stone_road':
      return (
        <div className="space-y-1 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-sm">🟫 Stone Road</span>
            {coords}
          </div>
          <p className="text-muted-foreground italic">
            Paved road — grants a bonus step when walking along it and reduces enemy spawns.
          </p>
        </div>
      );

    case 'building': {
      const info = tile.buildingType ? BUILDING_UPGRADES[tile.buildingType] : null;
      return (
        <div className="space-y-1 text-xs">
          <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-1">
            <span className="font-bold text-sm">
              {info?.emoji ?? '🏠'} {info?.label ?? 'Home Base'}
            </span>
            {coords}
          </div>
          <p className="text-muted-foreground italic">
            Your home base. Walk into it to open the menu.
          </p>
          {info && (
            <div>
              <p className="text-[10px] text-muted-foreground mb-0.5">Features:</p>
              <ul className="text-[11px] list-disc list-inside space-y-0.5">
                {info.features.map((f) => <li key={f}>{f}</li>)}
              </ul>
              {info.next && info.upgradeCost && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                  ⬆ Upgrades to {BUILDING_UPGRADES[info.next].label} (🪵 {info.upgradeCost.wood} • 🪨 {info.upgradeCost.stone})
                </p>
              )}
            </div>
          )}
        </div>
      );
    }

    case 'dungeon_entrance': {
      const d = dungeonEntrance;
      // Fallback chain: explicit name → element-based wilderness name → coordinate-based name.
      const elemForName = d?.element as ElementType | undefined;
      const fallbackElem = elemForName
        ? `${elemForName.charAt(0).toUpperCase()}${elemForName.slice(1)} Wilderness Dungeon`
        : null;
      const name = d?.name || fallbackElem || `Dungeon at (${worldX}, ${worldY})`;
      const startFloor = d?.difficulty ?? 1;
      const deepest = d?.deepestFloor ?? 0;
      const elem = d?.element as ElementType | undefined;
      const elemEmoji = elem ? (ELEMENT_EMOJI[elem] ?? '') : '';
      const themeKind = d?.theme?.kind;
      const theme = d?.theme as any;
      const themeLabel =
        themeKind === 'all' ? 'All monsters' :
        themeKind === 'element' && theme ? `${theme.element} element` :
        themeKind === 'class' && theme ? `${theme.classType} class` :
        themeKind === 'species' && theme ? `${theme.species} species` :
        elem ? `${elem} biome` : null;
      return (
        <div className="space-y-1 text-xs">
          <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-1">
            <span className="font-bold text-sm">🏰 {name}</span>
            {coords}
          </div>
          <p className="text-muted-foreground italic">
            Walk in to start a run. Floors are infinite — flee any time to keep loot.
          </p>
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
            <span className="text-muted-foreground">Starting floor:</span>
            <span className="font-semibold">F{startFloor}</span>
            <span className="text-muted-foreground">Deepest reached:</span>
            <span>{deepest > 0 ? `F${deepest}` : '—'}</span>
            {themeLabel && (
              <>
                <span className="text-muted-foreground">Theme:</span>
                <span className="capitalize">{elemEmoji} {themeLabel}</span>
              </>
            )}
          </div>
          {d?.isHome && (
            <p className="text-[10px] text-primary">⭐ Home tower — always available.</p>
          )}
        </div>
      );
    }

    case 'nest': {
      if (!nest) return <div className="text-xs">🪺 Monster Nest</div>;
      const hpPct = Math.max(0, Math.min(100, Math.floor((nest.hp / nest.maxHp) * 100)));
      const elemEmoji = ELEMENT_EMOJI[nest.element] ?? '';
      return (
        <div className="space-y-1 text-xs">
          <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-1">
            <span className="font-bold text-sm">
              🪺 {elemEmoji} <span className="capitalize">{nest.element}</span> Nest
            </span>
            {coords}
          </div>
          <p className="text-muted-foreground italic">
            Spawns wild monsters periodically. Attack to destroy for bonus loot.
          </p>
          <div>
            <div className="flex items-center justify-between text-[10px] mb-0.5">
              <span className="text-muted-foreground">HP</span>
              <span className={hpPct < 50 ? 'text-destructive font-semibold' : ''}>
                {nest.hp}/{nest.maxHp}
              </span>
            </div>
            <div className="w-full h-1.5 bg-muted rounded overflow-hidden">
              <div
                className={`h-full ${hpPct > 60 ? 'bg-green-500' : hpPct > 30 ? 'bg-yellow-500' : 'bg-destructive'}`}
                style={{ width: `${hpPct}%` }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
            <span className="text-muted-foreground">Level:</span>
            <span>Lv.{nest.level}</span>
            <span className="text-muted-foreground">Total spawned:</span>
            <span>{nest.totalSpawned}</span>
          </div>
        </div>
      );
    }

    case 'enemy': {
      if (!enemy) return <div className="text-xs">👹 Enemy</div>;
      const hpPct = Math.max(0, Math.min(100, Math.floor((enemy.stats.currentHp / enemy.stats.maxHp) * 100)));
      const elemEmoji = ELEMENT_EMOJI[enemy.element] ?? '';
      return (
        <div className="space-y-1 text-xs">
          <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-1">
            <span className="font-bold text-sm capitalize">
              {elemEmoji} {enemy.name}
            </span>
            {coords}
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
            <span className="text-muted-foreground">Level:</span>
            <span>Lv.{enemy.level}</span>
            <span className="text-muted-foreground">Element:</span>
            <span className="capitalize">{enemy.element}</span>
            <span className="text-muted-foreground">Class:</span>
            <span className="capitalize">{enemy.class}</span>
            <span className="text-muted-foreground">HP:</span>
            <span>{enemy.stats.currentHp}/{enemy.stats.maxHp} ({hpPct}%)</span>
          </div>
          <p className="text-[10px] text-muted-foreground italic pt-1 border-t border-border/50">
            Use a move from your hotbar to attack.
          </p>
        </div>
      );
    }

    case 'player_building':
      // Player buildings already use BuildingTooltipContent in OverworldRenderer.
      return playerBuilding ? null : <div className="text-xs">Building</div>;

    case 'player':
      return (
        <div className="space-y-1 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-sm">📍 You</span>
            {coords}
          </div>
        </div>
      );

    default:
      return (
        <div className="space-y-1 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-sm">Tile</span>
            {coords}
          </div>
        </div>
      );
  }
}
