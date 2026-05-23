// Admin-only designer for custom AoE shapes and chess-like movement patterns.
//
// Pick a move, toggle cells on a 9x9 grid (center = origin), choose:
//   - Where the shape originates (self, target enemy/ally/tile/resource/trap/terrain)
//   - Propagation rules (blocked by walls? blocked by units? wall-penetrating?)
//   - What the shape does to each cell (damage enemies/allies/traps,
//     harvest resources, place a terrain rune)

import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useGameDataOverrides } from '@/hooks/useGameDataOverrides';
import {
  SPECIES_MOVES,
  ELEMENT_MOVES,
  CLASS_MOVES,
  Move,
  CustomShape,
  MovementPattern,
  ShapeOriginType,
  HarvestableKind,
} from '@/game/moves';
import { getCustomMoves } from '@/game/moveOverrides';
import { MoveSortFilter, sortMoves, filterMoves, MoveSortOption, MoveFilterOption } from '@/game/MoveSortFilter';
import type { Monster } from '@/game/types';
import { TERRAIN_CONFIG, TerrainType } from '@/game/terrain';
import { Search, Save, RotateCcw, Crosshair, Footprints, BookmarkPlus, Bookmark, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const GRID_SIZE_OPTIONS = [9, 13, 17, 21];
type TierKey = 'lesser' | 'minor' | 'base' | 'greater' | 'omega';
const TIER_KEYS: TierKey[] = ['lesser', 'minor', 'base', 'greater', 'omega'];
const TIER_LABELS: Record<TierKey, string> = {
  lesser: 'Lesser', minor: 'Minor', base: 'Base', greater: 'Greater', omega: 'Omega',
};

type Mode = 'shape' | 'movement';

const ORIGIN_OPTIONS: { value: ShapeOriginType; label: string; hint: string }[] = [
  { value: 'self',            label: 'Self',            hint: 'Centered on caster (melee burst).' },
  { value: 'target_tile',     label: 'Target tile',     hint: 'Pick any tile in range.' },
  { value: 'target_enemy',    label: 'Target enemy',    hint: 'Must click an enemy.' },
  { value: 'target_ally',     label: 'Target ally',     hint: 'Must click a party member.' },
  { value: 'target_resource', label: 'Target resource', hint: 'Must click a tree / rock / plant.' },
  { value: 'target_trap',     label: 'Target trap',     hint: 'Must click a trap tile.' },
  { value: 'target_terrain',  label: 'Target terrain',  hint: 'Must click a terrain rune tile.' },
];

const HARVEST_KINDS: { value: HarvestableKind; label: string }[] = [
  { value: 'tree',    label: '🌳 Trees' },
  { value: 'stone',   label: '⛏️ Stone / Ore' },
  { value: 'plant',   label: '🌿 Plants / Herbs' },
  { value: 'trap',    label: '🪤 Traps (disarm)' },
  { value: 'terrain', label: '🌀 Terrain runes' },
];

const TERRAIN_OPTIONS: { value: TerrainType; label: string }[] = (
  Object.keys(TERRAIN_CONFIG) as TerrainType[]
).map((t) => ({ value: t, label: `${TERRAIN_CONFIG[t].icon} ${TERRAIN_CONFIG[t].name}` }));

type TierStats = {
  power?: number | '';
  accuracy?: number | '';
  staminaCost?: number | '';
  speedMod?: number | '';
};

// Convert a built-in move's `targeting` + `aoeRadius` into a concrete
// grid shape, so existing (non-custom-shape) moves populate the editor
// with their implied affected cells. Facing is treated as "up" (-y forward).
function synthesizeShapeFromTargeting(m: Move): {
  offsets: { dx: number; dy: number }[];
  originType: ShapeOriginType;
  range: number;
  rotateToFacing: boolean;
} {
  const targeting = m.targeting ?? (m.type === 'melee' ? 'single' : 'single');
  const aoe = Math.max(0, m.aoeRadius ?? 0);
  const baseRange = m.type === 'melee' ? 1 : 5;
  const offsets: { dx: number; dy: number }[] = [];
  let originType: ShapeOriginType = m.type === 'melee' ? 'self' : 'target_tile';
  let range = baseRange;
  let rotateToFacing = false;

  const disc = (r: number, cx = 0, cy = 0) => {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx === 0 && dy === 0 && cx === 0 && cy === 0) continue;
        if (dx * dx + dy * dy <= r * r) offsets.push({ dx: cx + dx, dy: cy + dy });
      }
    }
  };

  switch (targeting) {
    case 'self':
      originType = 'self';
      // self-only — leave offsets empty (anchor is implicit).
      break;
    case 'single':
      originType = m.type === 'melee' ? 'self' : 'self';
      offsets.push({ dx: 0, dy: -1 });
      rotateToFacing = true;
      break;
    case 'piercing': {
      originType = 'self';
      const len = Math.max(2, baseRange);
      for (let i = 1; i <= len; i++) offsets.push({ dx: 0, dy: -i });
      rotateToFacing = true;
      break;
    }
    case 'cone': {
      originType = 'self';
      const depth = Math.max(2, aoe || 3);
      for (let d = 1; d <= depth; d++) {
        for (let x = -d + 1; x <= d - 1; x++) offsets.push({ dx: x, dy: -d });
      }
      rotateToFacing = true;
      break;
    }
    case 'aura': {
      originType = 'self';
      disc(Math.max(1, aoe || 1));
      break;
    }
    case 'area': {
      originType = 'target_tile';
      disc(Math.max(0, aoe || 1));
      offsets.push({ dx: 0, dy: 0 }); // include the targeted center tile
      break;
    }
    case 'arc': {
      originType = 'self';
      const r = Math.max(2, aoe || 3);
      for (let dy = -r; dy <= 0; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (dx * dx + dy * dy <= r * r) offsets.push({ dx, dy });
        }
      }
      rotateToFacing = true;
      break;
    }
    case 'custom':
      // Already handled by the customShape branch — fall through with empty.
      break;
  }

  // Dedupe.
  const seen = new Set<string>();
  const unique = offsets.filter((o) => {
    const k = `${o.dx},${o.dy}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return !(o.dx === 0 && o.dy === 0);
  });

  return { offsets: unique, originType, range, rotateToFacing };
}



export function ShapeDesigner() {
  const { saveOverride, deleteOverride, getOverride, loading } = useGameDataOverrides('moves');
  const {
    overrides: templateRows,
    saveOverride: saveTemplate,
    deleteOverride: deleteTemplate,
    loading: templatesLoading,
  } = useGameDataOverrides('shape_templates');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Move | null>(null);
  const [mode, setMode] = useState<Mode>('shape');
  const [gridSize, setGridSize] = useState<number>(13);
  const [tier, setTier] = useState<TierKey>('base');
  const [sortOption, setSortOption] = useState<MoveSortOption>('custom');
  const [moveFilters, setMoveFilters] = useState<MoveFilterOption[]>(['all']);

  // Shape state (for currently selected tier)
  const [originType, setOriginType] = useState<ShapeOriginType>('self');
  const [cells, setCells] = useState<Set<string>>(new Set());
  const [range, setRange] = useState(5);
  const [wallPenetrate, setWallPenetrate] = useState(false);
  const [blockedByWalls, setBlockedByWalls] = useState(true);
  const [blockedByUnits, setBlockedByUnits] = useState(false);
  const [damagesEnemies, setDamagesEnemies] = useState(true);
  const [damagesAllies, setDamagesAllies] = useState(false);
  const [damagesTraps, setDamagesTraps] = useState(false);
  const [harvests, setHarvests] = useState<Set<HarvestableKind>>(new Set());
  const [placesTerrain, setPlacesTerrain] = useState<TerrainType | ''>('');
  const [rotateShape, setRotateShape] = useState(false);
  const [tierStats, setTierStats] = useState<TierStats>({});

  // Movement state (mirrors AoE shape options, plus movement-specific flags)
  const [blink, setBlink] = useState(false);
  const [rotateMovement, setRotateMovement] = useState(false);
  const [moveRange, setMoveRange] = useState(5);
  const [moveBlockedByWalls, setMoveBlockedByWalls] = useState(true);
  const [moveBlockedByUnits, setMoveBlockedByUnits] = useState(false);
  const [movePassEnemies, setMovePassEnemies] = useState(false);
  const [movePassTraps, setMovePassTraps] = useState(false);
  const [movePassTerrain, setMovePassTerrain] = useState(false);
  const [moveClimbCliffs, setMoveClimbCliffs] = useState(false);
  const [moveCrossWater, setMoveCrossWater] = useState(false);
  const [moveTriggersTrapsOnPath, setMoveTriggersTrapsOnPath] = useState(false);
  const [moveHarvests, setMoveHarvests] = useState<Set<HarvestableKind>>(new Set());



  const allMoves = useMemo(() => {
    const out: Move[] = [];
    Object.values(SPECIES_MOVES).forEach((arr) => out.push(...arr));
    Object.values(ELEMENT_MOVES).forEach((arr) => out.push(...arr));
    Object.values(CLASS_MOVES).forEach((arr) => out.push(...arr));
    // Include any fully custom (admin-created) moves
    out.push(...getCustomMoves());
    return out;
  }, []);

  const filtered = useMemo(() => {
    let list = allMoves;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q));
    }
    list = filterMoves(list, moveFilters);
    // sortMoves needs a monster for usage sorts; pass a stub with empty mastery.
    const stub = { moveMastery: {} } as unknown as Monster;
    list = sortMoves(list, sortOption, stub, list.map((m) => m.id));
    return list;
  }, [allMoves, search, moveFilters, sortOption]);

  const isAnchorOnSelf = originType === 'self';

  // Resolve which shape & stats are stored for a given tier on the merged move.
  const readTier = (merged: Move, t: TierKey): { shape?: CustomShape; stats: TierStats } => {
    if (t === 'base') {
      return {
        shape: merged.customShape,
        stats: {
          power: merged.power,
          accuracy: merged.accuracy,
          staminaCost: merged.staminaCost,
          speedMod: merged.speedMod,
        },
      };
    }
    const ov = merged.tierOverrides?.[t];
    return {
      shape: ov?.customShape,
      stats: {
        power: ov?.power ?? '',
        accuracy: ov?.accuracy ?? '',
        staminaCost: ov?.staminaCost ?? '',
        speedMod: ov?.speedMod ?? '',
      },
    };
  };

  const applyTierToUI = (merged: Move, t: TierKey) => {
    const { shape, stats } = readTier(merged, t);
    setTierStats(stats);
    if (shape) {
      setCells(new Set(shape.offsets.map((o) => `${o.dx},${o.dy}`)));
      setOriginType(shape.originType ?? (shape.origin === 'self' ? 'self' : 'target_tile'));
      setRange(shape.range ?? 5);
      setWallPenetrate(!!shape.wallPenetrate);
      setBlockedByWalls(shape.blockedByWalls ?? true);
      setBlockedByUnits(shape.blockedByUnits ?? false);
      setDamagesEnemies(shape.damagesEnemies ?? true);
      setDamagesAllies(shape.damagesAllies ?? false);
      setDamagesTraps(shape.damagesTraps ?? false);
      setHarvests(new Set(shape.harvestsResources ?? []));
      setPlacesTerrain(shape.placesTerrain ?? '');
      setRotateShape(!!shape.rotateToFacing);
    } else {
      // No custom shape stored — synthesize one from the move's built-in
      // targeting pattern so existing moves populate the grid for editing.
      const synth = synthesizeShapeFromTargeting(merged);
      setCells(new Set(synth.offsets.map((o) => `${o.dx},${o.dy}`)));
      setOriginType(synth.originType);
      setRange(synth.range);
      setWallPenetrate(!!merged.wallPenetrate);
      setBlockedByWalls(true);
      setBlockedByUnits(false);
      setDamagesEnemies((merged.power ?? 0) > 0);
      setDamagesAllies(false);
      setDamagesTraps(false);
      setHarvests(new Set());
      setPlacesTerrain('');
      setRotateShape(synth.rotateToFacing);
    }
  };

  // Resolve which MovementPattern + stat tweaks are stored for a given tier.
  const readMovementTier = (merged: Move, t: TierKey): { movement?: import('@/game/moves').MovementPattern; stats: TierStats } => {
    if (t === 'base') {
      return {
        movement: merged.movement,
        stats: {
          power: merged.power, accuracy: merged.accuracy,
          staminaCost: merged.staminaCost, speedMod: merged.speedMod,
        },
      };
    }
    const ov = merged.tierOverrides?.[t];
    return {
      movement: ov?.movement,
      stats: {
        power: ov?.power ?? '', accuracy: ov?.accuracy ?? '',
        staminaCost: ov?.staminaCost ?? '', speedMod: ov?.speedMod ?? '',
      },
    };
  };

  const applyMovementTierToUI = (merged: Move, t: TierKey) => {
    const { movement, stats } = readMovementTier(merged, t);
    setTierStats(stats);
    if (movement) {
      setCells(new Set(movement.offsets.map((o) => `${o.dx},${o.dy}`)));
      setBlink(!!movement.blink);
      setRotateMovement(!!movement.rotateToFacing);
      setMoveRange(movement.range ?? 5);
      setMoveBlockedByWalls(movement.blockedByWalls ?? true);
      setMoveBlockedByUnits(movement.blockedByUnits ?? false);
      setMovePassEnemies(!!movement.passThroughEnemies);
      setMovePassTraps(!!movement.passThroughTraps);
      setMovePassTerrain(!!movement.passThroughTerrain);
      setMoveClimbCliffs(!!movement.canClimbCliffs);
      setMoveCrossWater(!!movement.canCrossWater);
      setMoveTriggersTrapsOnPath(!!movement.triggersTrapsOnPath);
      setMoveHarvests(new Set(movement.harvestsResources ?? []));
    } else {
      setCells(new Set());
      setBlink(false);
      setRotateMovement(false);
      setMoveRange(5);
      setMoveBlockedByWalls(true);
      setMoveBlockedByUnits(false);
      setMovePassEnemies(false);
      setMovePassTraps(false);
      setMovePassTerrain(false);
      setMoveClimbCliffs(false);
      setMoveCrossWater(false);
      setMoveTriggersTrapsOnPath(false);
      setMoveHarvests(new Set());
    }
  };

  // Templates: { name, mode, shape?, movement? } stored in shape_templates.
  type ShapeTemplate = {
    name: string;
    mode: Mode;
    shape?: CustomShape;
    movement?: MovementPattern;
  };
  const templates = templateRows.map((r) => ({
    key: r.data_key,
    tpl: r.data_value as unknown as ShapeTemplate,
  }));

  const applyTemplateData = (tpl: ShapeTemplate) => {
    // Stuff a synthetic merged Move so the existing apply helpers do the work.
    if (tpl.mode === 'movement' && tpl.movement) {
      setMode('movement');
      const fake = { movement: tpl.movement, type: 'movement' } as unknown as Move;
      applyMovementTierToUI(fake, 'base');
    } else if (tpl.shape) {
      setMode('shape');
      const fake = { customShape: tpl.shape, type: 'ranged' } as unknown as Move;
      applyTierToUI(fake, 'base');
    }
    toast.success(`Applied template: ${tpl.name}`);
  };

  const loadMove = (move: Move) => {
    setSelected(move);
    const override = (getOverride('moves', move.id) as Partial<Move> | null) || {};
    const merged: Move = { ...move, ...override };

    // Auto-link: if no override and a template's name matches the move's
    // name (case-insensitive), prefer the template so name-matched pairs
    // are always used together.
    const hasOverride = !!(override.customShape || override.movement);
    const nameMatch = !hasOverride
      ? templates.find((t) => t.tpl.name.toLowerCase() === move.name.toLowerCase())
      : null;

    if (nameMatch) {
      setTier('base');
      applyTemplateData(nameMatch.tpl);
      return;
    }

    if (merged.movement) {
      setMode('movement');
      setTier('base');
      applyMovementTierToUI(merged, 'base');
    } else {
      setMode('shape');
      setTier('base');
      applyTierToUI(merged, 'base');
      setBlink(false);
      setRotateMovement(false);
    }
  };

  const handleSaveAsTemplate = async () => {
    const name = window.prompt(
      mode === 'movement'
        ? 'Template name (movement):'
        : 'Template name (AoE shape):',
      selected?.name ?? '',
    );
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const tpl: ShapeTemplate = { name: trimmed, mode };
    if (mode === 'movement') {
      const movement = buildMovement();
      if (!movement) { toast.error('Add at least one movement cell first.'); return; }
      tpl.movement = movement;
    } else {
      const shape = buildShape();
      if (!shape) { toast.error('Add at least one shape cell first.'); return; }
      tpl.shape = shape;
    }
    await saveTemplate('shape_templates', key, tpl as unknown as Record<string, unknown>);
  };

  // When the user switches tier tabs, persist current edits into the move
  // (in memory) then load the new tier's data.
  const switchTier = (next: TierKey) => {
    if (!selected) { setTier(next); return; }
    const override = (getOverride('moves', selected.id) as Partial<Move> | null) || {};
    const merged: Move = { ...selected, ...override };
    setTier(next);
    if (mode === 'movement') applyMovementTierToUI(merged, next);
    else applyTierToUI(merged, next);
  };


  const toggleCell = (dx: number, dy: number) => {
    if (dx === 0 && dy === 0) return;
    const key = `${dx},${dy}`;
    const next = new Set(cells);
    next.has(key) ? next.delete(key) : next.add(key);
    setCells(next);
  };

  const toggleHarvest = (k: HarvestableKind) => {
    const next = new Set(harvests);
    next.has(k) ? next.delete(k) : next.add(k);
    setHarvests(next);
  };

  const toggleMoveHarvest = (k: HarvestableKind) => {
    const next = new Set(moveHarvests);
    next.has(k) ? next.delete(k) : next.add(k);
    setMoveHarvests(next);
  };

  const buildShape = (): CustomShape | null => {
    const offsets = [...cells].map((s) => {
      const [dx, dy] = s.split(',').map(Number);
      return { dx, dy };
    });
    if (offsets.length === 0) return null;
    return {
      offsets,
      origin: isAnchorOnSelf ? 'self' : 'target',
      originType,
      range,
      wallPenetrate,
      blockedByWalls,
      blockedByUnits,
      damagesEnemies,
      damagesAllies,
      damagesTraps,
      harvestsResources: [...harvests],
      ...(placesTerrain ? { placesTerrain } : {}),
      ...(rotateShape ? { rotateToFacing: true } : {}),
    };
  };

  const buildMovement = (): import('@/game/moves').MovementPattern | null => {
    const offsets = [...cells].map((s) => {
      const [dx, dy] = s.split(',').map(Number);
      return { dx, dy };
    });
    if (offsets.length === 0) return null;
    return {
      offsets,
      blink,
      ...(rotateMovement ? { rotateToFacing: true } : {}),
      range: moveRange,
      blockedByWalls: moveBlockedByWalls,
      blockedByUnits: moveBlockedByUnits,
      passThroughEnemies: movePassEnemies,
      passThroughTraps: movePassTraps,
      passThroughTerrain: movePassTerrain,
      canClimbCliffs: moveClimbCliffs,
      canCrossWater: moveCrossWater,
      triggersTrapsOnPath: moveTriggersTrapsOnPath,
      harvestsResources: [...moveHarvests],
    };
  };

  const handleSave = async () => {
    if (!selected) return;
    const existing = (getOverride('moves', selected.id) as Partial<Move> | null) || {};
    const patch: Partial<Move> = { ...existing };

    if (mode === 'movement') {
      const movement = buildMovement();
      if (!movement) { toast.error('Select at least one cell.'); return; }
      if (tier === 'base') {
        patch.movement = movement;
        patch.type = 'movement';
        if (tierStats.power !== '' && tierStats.power !== undefined) patch.power = Number(tierStats.power);
        if (tierStats.accuracy !== '' && tierStats.accuracy !== undefined) patch.accuracy = Number(tierStats.accuracy);
        if (tierStats.staminaCost !== '' && tierStats.staminaCost !== undefined) patch.staminaCost = Number(tierStats.staminaCost);
        if (tierStats.speedMod !== '' && tierStats.speedMod !== undefined) patch.speedMod = Number(tierStats.speedMod);
      } else {
        const nextOverrides = { ...(patch.tierOverrides ?? {}) };
        const tierPatch: NonNullable<Move['tierOverrides']>[string] = { movement };
        if (tierStats.power !== '' && tierStats.power !== undefined) tierPatch.power = Number(tierStats.power);
        if (tierStats.accuracy !== '' && tierStats.accuracy !== undefined) tierPatch.accuracy = Number(tierStats.accuracy);
        if (tierStats.staminaCost !== '' && tierStats.staminaCost !== undefined) tierPatch.staminaCost = Number(tierStats.staminaCost);
        if (tierStats.speedMod !== '' && tierStats.speedMod !== undefined) tierPatch.speedMod = Number(tierStats.speedMod);
        nextOverrides[tier] = tierPatch;
        patch.tierOverrides = nextOverrides;
      }
      delete patch.customShape;
    } else {
      const shape = buildShape();
      if (!shape) { toast.error('Select at least one cell.'); return; }
      if (tier === 'base') {
        patch.customShape = shape;
        patch.targeting = 'custom';
        if (tierStats.power !== '' && tierStats.power !== undefined) patch.power = Number(tierStats.power);
        if (tierStats.accuracy !== '' && tierStats.accuracy !== undefined) patch.accuracy = Number(tierStats.accuracy);
        if (tierStats.staminaCost !== '' && tierStats.staminaCost !== undefined) patch.staminaCost = Number(tierStats.staminaCost);
        if (tierStats.speedMod !== '' && tierStats.speedMod !== undefined) patch.speedMod = Number(tierStats.speedMod);
      } else {
        const nextOverrides = { ...(patch.tierOverrides ?? {}) };
        const tierPatch: NonNullable<Move['tierOverrides']>[string] = { customShape: shape };
        if (tierStats.power !== '' && tierStats.power !== undefined) tierPatch.power = Number(tierStats.power);
        if (tierStats.accuracy !== '' && tierStats.accuracy !== undefined) tierPatch.accuracy = Number(tierStats.accuracy);
        if (tierStats.staminaCost !== '' && tierStats.staminaCost !== undefined) tierPatch.staminaCost = Number(tierStats.staminaCost);
        if (tierStats.speedMod !== '' && tierStats.speedMod !== undefined) tierPatch.speedMod = Number(tierStats.speedMod);
        nextOverrides[tier] = tierPatch;
        patch.tierOverrides = nextOverrides;
      }
      delete patch.movement;
    }

    const ok = await saveOverride('moves', selected.id, patch as Record<string, unknown>);
    if (ok) toast.success(`Saved ${tier} ${mode} for ${selected.name}`);
  };


  const handleClear = async () => {
    if (!selected) return;
    setCells(new Set());
    setTierStats({});
    await deleteOverride('moves', selected.id);
    toast.success(`Cleared override for ${selected.name}`);
  };

  if (loading) return <div className="p-4 text-muted-foreground">Loading…</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Move picker */}
      <Card className="p-3 order-2 lg:order-1">

        <div className="flex items-center gap-2 mb-2">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <Input
            placeholder="Search moves…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="mb-2">
          <MoveSortFilter
            sortOption={sortOption}
            filters={moveFilters}
            onSortChange={setSortOption}
            onFilterChange={setMoveFilters}
          />
        </div>
        <ScrollArea className="h-[300px] lg:h-[460px]">
          <div className="space-y-0.5">
            {filtered.map((m) => {
              const ovr = getOverride('moves', m.id) as Partial<Move> | null;
              const tag = ovr?.movement ? 'Move' : ovr?.customShape ? 'Shape' : (m as Move & { custom?: boolean }).custom ? 'New' : null;
              return (
                <button
                  key={m.id}
                  onClick={() => loadMove(m)}
                  className={`w-full text-left px-2 py-1 rounded text-xs hover:bg-muted transition-colors flex justify-between items-center gap-2 ${
                    selected?.id === m.id ? 'bg-primary/20' : ''
                  }`}
                >
                  <span className="truncate">
                    <span className="font-medium">{m.name}</span>
                    <span className="text-muted-foreground ml-1.5 text-[10px]">{m.type}</span>
                  </span>
                  {tag && (
                    <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0 rounded shrink-0">{tag}</span>
                  )}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-xs text-muted-foreground italic p-2">No moves match.</div>
            )}
          </div>
        </ScrollArea>
      </Card>


      {/* Designer */}
      <Card className="p-4 order-1 lg:order-2">
        {!selected ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Select a move to design a shape.
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <h3 className="font-bold text-lg">{selected.name}</h3>
              <p className="text-xs text-muted-foreground">{selected.description}</p>
            </div>

            {/* Mode toggle */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={mode === 'shape' ? 'default' : 'outline'}
                onClick={() => setMode('shape')}
                className="flex-1 gap-1"
              >
                <Crosshair className="w-4 h-4" /> AoE Shape
              </Button>
              <Button
                size="sm"
                variant={mode === 'movement' ? 'default' : 'outline'}
                onClick={() => setMode('movement')}
                className="flex-1 gap-1"
              >
                <Footprints className="w-4 h-4" /> Movement
              </Button>
            </div>

            {/* Tier selector (both modes) */}
            <div className="space-y-1">
              <Label className="text-xs uppercase text-muted-foreground">Editing tier</Label>
              <div className="flex flex-wrap gap-1">
                {TIER_KEYS.map((t) => {
                  const merged: Move = { ...selected, ...((getOverride('moves', selected.id) as Partial<Move>) || {}) };
                  const has = mode === 'movement'
                    ? (readMovementTier(merged, t).movement !== undefined
                       || (t !== 'base' && merged.tierOverrides?.[t]?.movement !== undefined))
                    : (readTier(merged, t).shape !== undefined
                       || (t !== 'base' && merged.tierOverrides?.[t] !== undefined));
                  return (
                    <Button
                      key={t}
                      size="sm"
                      variant={tier === t ? 'default' : 'outline'}
                      onClick={() => switchTier(t)}
                      className="text-xs h-7 gap-1"
                    >
                      {TIER_LABELS[t]}
                      {has && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                    </Button>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Each tier can have its own {mode === 'movement' ? 'movement pattern' : 'shape'} + stat tweaks. Base writes to the move itself; higher tiers write to <code>tierOverrides[{tier}]</code>. Switching tiers discards unsaved edits.
              </p>
            </div>

            {/* Per-tier stat overrides (both modes) */}
            <div className="grid grid-cols-2 gap-2 border-t border-border pt-2">
              <TierStatField label="Power" value={tierStats.power} placeholder={String(selected.power)}
                onChange={(v) => setTierStats({ ...tierStats, power: v })} />
              <TierStatField label="Accuracy" value={tierStats.accuracy} placeholder={String(selected.accuracy)}
                onChange={(v) => setTierStats({ ...tierStats, accuracy: v })} />
              <TierStatField label="Stamina" value={tierStats.staminaCost} placeholder={String(selected.staminaCost)}
                onChange={(v) => setTierStats({ ...tierStats, staminaCost: v })} />
              <TierStatField label="Speed Mod" value={tierStats.speedMod} placeholder={String(selected.speedMod)}
                onChange={(v) => setTierStats({ ...tierStats, speedMod: v })} />
            </div>


            {/* Grid size selector */}
            <div className="flex items-center gap-2 border-t border-border pt-2">
              <Label className="text-xs">Grid size</Label>
              {GRID_SIZE_OPTIONS.map((n) => (
                <Button
                  key={n}
                  size="sm"
                  variant={gridSize === n ? 'default' : 'outline'}
                  onClick={() => setGridSize(n)}
                  className="h-7 text-xs"
                >
                  {n}×{n}
                </Button>
              ))}
            </div>

            {/* Mode-specific options */}
            {mode === 'shape' ? (
              <div className="space-y-3">
                {/* Origin */}
                <div>
                  <Label className="text-xs">Origin</Label>
                  <div className="grid grid-cols-2 gap-1 mt-1">
                    {ORIGIN_OPTIONS.map((opt) => (
                      <Button
                        key={opt.value}
                        size="sm"
                        variant={originType === opt.value ? 'default' : 'outline'}
                        onClick={() => setOriginType(opt.value)}
                        className="justify-start text-xs h-auto py-1.5"
                        title={opt.hint}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {ORIGIN_OPTIONS.find((o) => o.value === originType)?.hint}
                  </p>
                </div>

                {/* Range (for any non-self origin) */}
                {originType !== 'self' && (
                  <div>
                    <Label className="text-xs">Max target range (tiles)</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={20}
                      value={range}
                      onChange={(e) => setRange(parseInt(e.target.value) || 1)}
                    />
                  </div>
                )}

                {/* Propagation rules */}
                <div className="space-y-1.5 border-t border-border pt-2">
                  <Label className="text-xs uppercase text-muted-foreground">Propagation</Label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={wallPenetrate}
                      onChange={(e) => setWallPenetrate(e.target.checked)}
                    />
                    Ignores walls entirely (overrides everything below)
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={blockedByWalls}
                      disabled={wallPenetrate}
                      onChange={(e) => setBlockedByWalls(e.target.checked)}
                    />
                    Walls block cells past them
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={blockedByUnits}
                      onChange={(e) => setBlockedByUnits(e.target.checked)}
                    />
                    Units block cells past them
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={rotateShape}
                      onChange={(e) => setRotateShape(e.target.checked)}
                    />
                    Rotate shape to aimed direction (N/E/S/W)
                  </label>
                </div>

                {/* Effects */}
                <div className="space-y-1.5 border-t border-border pt-2">
                  <Label className="text-xs uppercase text-muted-foreground">Effects per cell</Label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={damagesEnemies}
                      onChange={(e) => setDamagesEnemies(e.target.checked)}
                    />
                    Damages enemies
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={damagesAllies}
                      onChange={(e) => setDamagesAllies(e.target.checked)}
                    />
                    Damages allies (friendly fire)
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={damagesTraps}
                      onChange={(e) => setDamagesTraps(e.target.checked)}
                    />
                    Destroys traps
                  </label>
                </div>

                {/* Harvest */}
                <div className="space-y-1.5 border-t border-border pt-2">
                  <Label className="text-xs uppercase text-muted-foreground">Harvests</Label>
                  <div className="grid grid-cols-2 gap-1">
                    {HARVEST_KINDS.map((h) => (
                      <label key={h.value} className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={harvests.has(h.value)}
                          onChange={() => toggleHarvest(h.value)}
                        />
                        {h.label}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Place terrain */}
                <div className="space-y-1.5 border-t border-border pt-2">
                  <Label className="text-xs uppercase text-muted-foreground">Places terrain rune</Label>
                  <select
                    value={placesTerrain}
                    onChange={(e) => setPlacesTerrain(e.target.value as TerrainType | '')}
                    className="w-full bg-background border border-border rounded px-2 py-1 text-xs"
                  >
                    <option value="">— None —</option>
                    {TERRAIN_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-muted-foreground">
                    Applied to empty / air tiles inside the shape.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Click cells where the caster may move/teleport to. Anchor (center) is the caster.
                </p>

                {/* Range */}
                <div>
                  <Label className="text-xs">Max destination range (tiles)</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={20}
                    value={moveRange}
                    onChange={(e) => setMoveRange(parseInt(e.target.value) || 1)}
                  />
                </div>

                {/* Propagation */}
                <div className="space-y-1.5 border-t border-border pt-2">
                  <Label className="text-xs uppercase text-muted-foreground">Path propagation</Label>
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={blink} onChange={(e) => setBlink(e.target.checked)} />
                    Blink (teleport — ignore walls / line-of-sight)
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={moveBlockedByWalls}
                      disabled={blink}
                      onChange={(e) => setMoveBlockedByWalls(e.target.checked)}
                    />
                    Walls block the path
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={moveBlockedByUnits}
                      disabled={blink}
                      onChange={(e) => setMoveBlockedByUnits(e.target.checked)}
                    />
                    Units block the path
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={rotateMovement}
                      onChange={(e) => setRotateMovement(e.target.checked)}
                    />
                    Rotate destinations to aimed direction (N/E/S/W)
                  </label>
                </div>

                {/* Pass-through rules */}
                <div className="space-y-1.5 border-t border-border pt-2">
                  <Label className="text-xs uppercase text-muted-foreground">Pass-through</Label>
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={movePassEnemies} onChange={(e) => setMovePassEnemies(e.target.checked)} />
                    Can pass through enemies
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={movePassTraps} onChange={(e) => setMovePassTraps(e.target.checked)} />
                    Can pass over traps (without triggering)
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={movePassTerrain} onChange={(e) => setMovePassTerrain(e.target.checked)} />
                    Can pass over terrain runes (without triggering)
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={moveClimbCliffs} onChange={(e) => setMoveClimbCliffs(e.target.checked)} />
                    Can climb up cliffs (elevation jumps)
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={moveCrossWater} onChange={(e) => setMoveCrossWater(e.target.checked)} />
                    Can cross water tiles
                  </label>
                </div>

                {/* Triggers + harvest along path */}
                <div className="space-y-1.5 border-t border-border pt-2">
                  <Label className="text-xs uppercase text-muted-foreground">Effects along path</Label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={moveTriggersTrapsOnPath}
                      onChange={(e) => setMoveTriggersTrapsOnPath(e.target.checked)}
                    />
                    Triggers traps &amp; terrain rune effects the path overlaps
                  </label>
                </div>

                {/* Harvest */}
                <div className="space-y-1.5 border-t border-border pt-2">
                  <Label className="text-xs uppercase text-muted-foreground">Harvests along path</Label>
                  <div className="grid grid-cols-2 gap-1">
                    {HARVEST_KINDS.map((h) => (
                      <label key={h.value} className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={moveHarvests.has(h.value)}
                          onChange={() => toggleMoveHarvest(h.value)}
                        />
                        {h.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}


            {/* Grid */}
            {(() => {
              const half = Math.floor(gridSize / 2);
              // Build per-tier offset sets so each cell can show which tiers it
              // belongs to (L/M/B/G/O). The currently-editing tier uses the
              // unsaved in-memory `cells`; other tiers read from the saved move.
              const TIER_LETTERS: Record<TierKey, string> = {
                lesser: 'L', minor: 'M', base: 'B', greater: 'G', omega: 'O',
              };
              const mergedForGrid: Move | null = selected
                ? { ...selected, ...((getOverride('moves', selected.id) as Partial<Move>) || {}) }
                : null;
              const tierSets: Record<TierKey, Set<string>> = {
                lesser: new Set(), minor: new Set(), base: new Set(),
                greater: new Set(), omega: new Set(),
              };
              if (mergedForGrid) {
                for (const t of TIER_KEYS) {
                  if (t === tier) {
                    tierSets[t] = new Set(cells);
                  } else if (mode === 'shape') {
                    const { shape } = readTier(mergedForGrid, t);
                    if (shape?.offsets) {
                      tierSets[t] = new Set(shape.offsets.map((o) => `${o.dx},${o.dy}`));
                    }
                  } else {
                    const { movement } = readMovementTier(mergedForGrid, t);
                    if (movement?.offsets) {
                      tierSets[t] = new Set(movement.offsets.map((o) => `${o.dx},${o.dy}`));
                    }
                  }
                }
              }

              return (
                <div
                  className="grid gap-1 mx-auto w-full overflow-x-auto"
                  style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0,1fr))`, maxWidth: 480 }}
                >
                  {Array.from({ length: gridSize * gridSize }).map((_, i) => {
                    const gx = i % gridSize;
                    const gy = Math.floor(i / gridSize);
                    const dx = gx - half;
                    const dy = gy - half;
                    const isAnchor = dx === 0 && dy === 0;
                    const key = `${dx},${dy}`;
                    const on = cells.has(key);
                    const letters = TIER_KEYS.filter((t) => tierSets[t].has(key)).map((t) => TIER_LETTERS[t]);

                    return (
                      <button
                        key={i}
                        onClick={() => toggleCell(dx, dy)}
                        className={`aspect-square rounded text-[9px] font-bold leading-none border transition-colors flex items-center justify-center ${
                          isAnchor
                            ? 'bg-foreground text-background border-foreground'
                            : on
                              ? mode === 'shape'
                                ? 'bg-destructive/70 border-destructive text-destructive-foreground'
                                : 'bg-sky-500/70 border-sky-500 text-white'
                              : letters.length > 0
                                ? 'bg-muted/70 border-primary/40 text-foreground/80'
                                : 'bg-muted hover:bg-muted-foreground/20 border-border'
                        }`}
                        title={`(${dx}, ${dy})${letters.length ? ` — tiers: ${letters.join('')}` : ''}`}
                      >
                        {isAnchor ? '⦿' : letters.length > 0 ? letters.join('') : ''}
                      </button>
                    );
                  })}
                </div>
              );
            })()}

            <p className="text-[10px] text-muted-foreground text-center">
              Cell letters mark which tier(s) include that offset: <b>L</b>esser · <b>M</b>inor · <b>B</b>ase · <b>G</b>reater · <b>O</b>mega.
            </p>



            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} className="flex-1 gap-2">
                <Save className="w-4 h-4" /> Save Override
              </Button>
              <Button variant="outline" onClick={handleClear} className="gap-2">
                <RotateCcw className="w-4 h-4" /> Clear
              </Button>
            </div>

            <p className="text-[10px] text-muted-foreground italic">
              Overrides are saved to the database. Origin / propagation / effect flags
              are stored on the move; combat resolution will honor them as the engine
              wires up each toggle (damage flags are already respected; harvest +
              place-terrain pipelines land next).
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}

function TierStatField({
  label, value, onChange, placeholder,
}: {
  label: string;
  value: number | '' | undefined;
  onChange: (v: number | '') => void;
  placeholder?: string;
}) {
  const [text, setText] = useState<string>(value === '' || value === undefined ? '' : String(value));
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        type="text"
        inputMode="numeric"
        pattern="-?[0-9]*"
        value={text}
        placeholder={placeholder ? `base: ${placeholder}` : ''}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          if (v === '') onChange('');
          else if (/^-?\d+$/.test(v)) onChange(parseInt(v, 10));
        }}
        onBlur={() => {
          if (text === '') { onChange(''); return; }
          const n = parseInt(text, 10);
          if (Number.isFinite(n)) { onChange(n); setText(String(n)); }
          else { onChange(''); setText(''); }
        }}
        className="h-8"
      />
    </div>
  );
}
