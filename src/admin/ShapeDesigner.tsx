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
import { Search, Save, RotateCcw, Crosshair, Footprints } from 'lucide-react';
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

export function ShapeDesigner() {
  const { saveOverride, deleteOverride, getOverride, loading } = useGameDataOverrides('moves');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Move | null>(null);
  const [mode, setMode] = useState<Mode>('shape');
  const [gridSize, setGridSize] = useState<number>(13);
  const [tier, setTier] = useState<TierKey>('base');

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
  const [tierStats, setTierStats] = useState<TierStats>({});

  // Movement state
  const [blink, setBlink] = useState(false);

  const allMoves = useMemo(() => {
    const out: Move[] = [];
    Object.values(SPECIES_MOVES).forEach((arr) => out.push(...arr));
    Object.values(ELEMENT_MOVES).forEach((arr) => out.push(...arr));
    Object.values(CLASS_MOVES).forEach((arr) => out.push(...arr));
    return out;
  }, []);

  const filtered = useMemo(() => {
    if (!search) return allMoves;
    const q = search.toLowerCase();
    return allMoves.filter((m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q));
  }, [allMoves, search]);

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
    } else {
      setCells(new Set());
      setOriginType(merged.type === 'melee' ? 'self' : 'target_tile');
      setRange(merged.type === 'melee' ? 1 : 5);
      setWallPenetrate(false);
      setBlockedByWalls(true);
      setBlockedByUnits(false);
      setDamagesEnemies((merged.power ?? 0) > 0);
      setDamagesAllies(false);
      setDamagesTraps(false);
      setHarvests(new Set());
      setPlacesTerrain('');
    }
  };

  const loadMove = (move: Move) => {
    setSelected(move);
    const override = (getOverride('moves', move.id) as Partial<Move> | null) || {};
    const merged: Move = { ...move, ...override };
    if (merged.movement) {
      setMode('movement');
      setCells(new Set(merged.movement.offsets.map((o) => `${o.dx},${o.dy}`)));
      setBlink(!!merged.movement.blink);
      setTier('base');
    } else {
      setMode('shape');
      setTier('base');
      applyTierToUI(merged, 'base');
      setBlink(false);
    }
  };

  // When the user switches tier tabs, persist current edits into the move
  // (in memory) then load the new tier's data.
  const switchTier = (next: TierKey) => {
    if (!selected || mode !== 'shape') { setTier(next); return; }
    // Snapshot current edits into a merged Move so the next tier sees them.
    const override = (getOverride('moves', selected.id) as Partial<Move> | null) || {};
    const merged: Move = { ...selected, ...override };
    // Don't actually mutate here — just re-read what's persisted. Edits not yet
    // saved to a tier are intentionally tier-local; admin must hit Save to keep.
    setTier(next);
    applyTierToUI(merged, next);
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
    };
  };

  const handleSave = async () => {
    if (!selected) return;
    const existing = (getOverride('moves', selected.id) as Partial<Move> | null) || {};
    const patch: Partial<Move> = { ...existing };

    if (mode === 'movement') {
      const offsets = [...cells].map((s) => {
        const [dx, dy] = s.split(',').map(Number);
        return { dx, dy };
      });
      if (offsets.length === 0) { toast.error('Select at least one cell.'); return; }
      patch.movement = { offsets, blink };
      patch.type = 'movement';
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
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search moves…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <ScrollArea className="h-[460px]">
          <div className="space-y-1">
            {filtered.map((m) => {
              const ovr = getOverride('moves', m.id) as Partial<Move> | null;
              const tag = ovr?.movement ? 'Move' : ovr?.customShape ? 'Shape' : null;
              return (
                <button
                  key={m.id}
                  onClick={() => loadMove(m)}
                  className={`w-full text-left p-2 rounded text-sm hover:bg-muted transition-colors flex justify-between items-center ${
                    selected?.id === m.id ? 'bg-primary/20' : ''
                  }`}
                >
                  <span>
                    <span className="font-medium">{m.name}</span>
                    <span className="text-muted-foreground ml-2 text-xs">{m.type}</span>
                  </span>
                  {tag && (
                    <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">{tag}</span>
                  )}
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </Card>

      {/* Designer */}
      <Card className="p-4">
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

            {/* Tier selector (shape mode only) */}
            {mode === 'shape' && (
              <div className="space-y-1">
                <Label className="text-xs uppercase text-muted-foreground">Editing tier</Label>
                <div className="flex flex-wrap gap-1">
                  {TIER_KEYS.map((t) => {
                    const merged: Move = { ...selected, ...((getOverride('moves', selected.id) as Partial<Move>) || {}) };
                    const has = readTier(merged, t).shape !== undefined ||
                      (t !== 'base' && merged.tierOverrides?.[t] !== undefined);
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
                  Each tier can have its own shape + stat tweaks. Base tier writes to the move itself; higher tiers write to <code>tierOverrides[{tier}]</code>. Switching tiers loads saved data — unsaved edits in the previous tier are discarded.
                </p>
              </div>
            )}

            {/* Per-tier stat overrides (shape mode only) */}
            {mode === 'shape' && (
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
            )}

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
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Click cells where the caster may teleport. Anchor (center) is the caster.
                </p>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={blink} onChange={(e) => setBlink(e.target.checked)} />
                  Blink (ignore walls / line-of-sight)
                </label>
              </div>
            )}

            {/* Grid */}
            {(() => {
              const half = Math.floor(gridSize / 2);
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
                    const on = cells.has(`${dx},${dy}`);
                    return (
                      <button
                        key={i}
                        onClick={() => toggleCell(dx, dy)}
                        className={`aspect-square rounded text-[9px] border transition-colors ${
                          isAnchor
                            ? 'bg-foreground text-background border-foreground'
                            : on
                              ? mode === 'shape'
                                ? 'bg-destructive/70 border-destructive'
                                : 'bg-sky-500/70 border-sky-500'
                              : 'bg-muted hover:bg-muted-foreground/20 border-border'
                        }`}
                        title={`(${dx}, ${dy})`}
                      >
                        {isAnchor ? '⦿' : ''}
                      </button>
                    );
                  })}
                </div>
              );
            })()}

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
