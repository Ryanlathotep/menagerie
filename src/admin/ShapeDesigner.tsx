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

export function ShapeDesigner() {
  const { saveOverride, deleteOverride, getOverride, loading } = useGameDataOverrides('moves');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Move | null>(null);
  const [mode, setMode] = useState<Mode>('shape');

  // Shape state
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

  const loadMove = (move: Move) => {
    setSelected(move);
    const override = (getOverride('moves', move.id) as Partial<Move> | null) || {};
    const merged: Move = { ...move, ...override };
    if (merged.movement) {
      setMode('movement');
      setCells(new Set(merged.movement.offsets.map((o) => `${o.dx},${o.dy}`)));
      setBlink(!!merged.movement.blink);
    } else if (merged.customShape) {
      const cs = merged.customShape;
      setMode('shape');
      setCells(new Set(cs.offsets.map((o) => `${o.dx},${o.dy}`)));
      setOriginType(cs.originType ?? (cs.origin === 'self' ? 'self' : 'target_tile'));
      setRange(cs.range ?? 5);
      setWallPenetrate(!!cs.wallPenetrate);
      setBlockedByWalls(cs.blockedByWalls ?? true);
      setBlockedByUnits(cs.blockedByUnits ?? false);
      setDamagesEnemies(cs.damagesEnemies ?? true);
      setDamagesAllies(cs.damagesAllies ?? false);
      setDamagesTraps(cs.damagesTraps ?? false);
      setHarvests(new Set(cs.harvestsResources ?? []));
      setPlacesTerrain(cs.placesTerrain ?? '');
    } else {
      setMode('shape');
      setCells(new Set());
      setOriginType(move.type === 'melee' ? 'self' : 'target_tile');
      setRange(move.type === 'melee' ? 1 : 5);
      setWallPenetrate(false);
      setBlockedByWalls(true);
      setBlockedByUnits(false);
      setDamagesEnemies(move.power > 0);
      setDamagesAllies(false);
      setDamagesTraps(false);
      setHarvests(new Set());
      setPlacesTerrain('');
      setBlink(false);
    }
  };

  const toggleCell = (dx: number, dy: number) => {
    // The anchor cell (0,0) is the origin marker — not toggleable in either mode.
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

  const handleSave = async () => {
    if (!selected) return;
    const offsets = [...cells].map((s) => {
      const [dx, dy] = s.split(',').map(Number);
      return { dx, dy };
    });
    if (offsets.length === 0) {
      toast.error('Select at least one cell.');
      return;
    }
    const existing = (getOverride('moves', selected.id) as Partial<Move> | null) || {};
    const patch: Partial<Move> = { ...existing };
    if (mode === 'shape') {
      const shape: CustomShape = {
        offsets,
        origin: isAnchorOnSelf ? 'self' : 'target', // legacy field
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
      patch.customShape = shape;
      patch.targeting = 'custom';
      delete patch.movement;
    } else {
      const movement: MovementPattern = { offsets, blink };
      patch.movement = movement;
      patch.type = 'movement';
      delete patch.customShape;
    }
    const ok = await saveOverride('moves', selected.id, patch as Record<string, unknown>);
    if (ok) toast.success(`Saved ${mode} for ${selected.name}`);
  };

  const handleClear = async () => {
    if (!selected) return;
    setCells(new Set());
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
            <div
              className="grid gap-1 mx-auto"
              style={{ gridTemplateColumns: `repeat(${GRID}, 1fr)`, maxWidth: 360 }}
            >
              {Array.from({ length: GRID * GRID }).map((_, i) => {
                const gx = i % GRID;
                const gy = Math.floor(i / GRID);
                const dx = gx - HALF;
                const dy = gy - HALF;
                const isAnchor = dx === 0 && dy === 0;
                const on = cells.has(`${dx},${dy}`);
                return (
                  <button
                    key={i}
                    onClick={() => toggleCell(dx, dy)}
                    className={`aspect-square rounded text-[10px] border transition-colors ${
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
