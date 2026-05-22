// Admin-only designer for custom AoE shapes and chess-like movement patterns.
// Pick a move, toggle cells on a 9x9 grid (center = origin), choose whether
// the shape anchors on the caster ('self', melee burst) or the target tile
// ('target', ranged strike), then save as an override.

import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useGameDataOverrides } from '@/hooks/useGameDataOverrides';
import { SPECIES_MOVES, ELEMENT_MOVES, CLASS_MOVES, Move, CustomShape, MovementPattern } from '@/game/moves';
import { Search, Save, RotateCcw, Crosshair, Footprints } from 'lucide-react';
import { toast } from 'sonner';

const GRID = 9; // 9x9 grid, center at (4,4)
const HALF = Math.floor(GRID / 2);

type Mode = 'shape' | 'movement';

export function ShapeDesigner() {
  const { saveOverride, deleteOverride, getOverride, loading } = useGameDataOverrides('moves');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Move | null>(null);
  const [mode, setMode] = useState<Mode>('shape');
  const [origin, setOrigin] = useState<'self' | 'target'>('self');
  const [cells, setCells] = useState<Set<string>>(new Set());
  const [range, setRange] = useState(5);
  const [wallPenetrate, setWallPenetrate] = useState(false);
  const [blink, setBlink] = useState(false);

  const allMoves = useMemo(() => {
    const out: Move[] = [];
    Object.values(SPECIES_MOVES).forEach(arr => out.push(...arr));
    Object.values(ELEMENT_MOVES).forEach(arr => out.push(...arr));
    Object.values(CLASS_MOVES).forEach(arr => out.push(...arr));
    return out;
  }, []);

  const filtered = useMemo(() => {
    if (!search) return allMoves;
    const q = search.toLowerCase();
    return allMoves.filter(m => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q));
  }, [allMoves, search]);

  const loadMove = (move: Move) => {
    setSelected(move);
    const override = (getOverride('moves', move.id) as Partial<Move> | null) || {};
    const merged: Move = { ...move, ...override };
    if (merged.movement) {
      setMode('movement');
      setCells(new Set(merged.movement.offsets.map(o => `${o.dx},${o.dy}`)));
      setBlink(!!merged.movement.blink);
      setOrigin('self');
    } else if (merged.customShape) {
      setMode('shape');
      setCells(new Set(merged.customShape.offsets.map(o => `${o.dx},${o.dy}`)));
      setOrigin(merged.customShape.origin);
      setRange(merged.customShape.range ?? 5);
      setWallPenetrate(!!merged.customShape.wallPenetrate);
    } else {
      setMode('shape');
      setCells(new Set());
      setOrigin(move.type === 'melee' ? 'self' : 'target');
      setRange(move.type === 'melee' ? 1 : 5);
      setWallPenetrate(false);
      setBlink(false);
    }
  };

  const toggleCell = (dx: number, dy: number) => {
    if (dx === 0 && dy === 0 && mode === 'shape' && origin === 'self') return; // anchor cell
    if (dx === 0 && dy === 0 && mode === 'movement') return; // can't move to self
    const key = `${dx},${dy}`;
    const next = new Set(cells);
    next.has(key) ? next.delete(key) : next.add(key);
    setCells(next);
  };

  const handleSave = async () => {
    if (!selected) return;
    const offsets = [...cells].map(s => {
      const [dx, dy] = s.split(',').map(Number);
      return { dx, dy };
    });
    if (offsets.length === 0) {
      toast.error('Select at least one cell.');
      return;
    }
    // Preserve other override fields by reading then merging.
    const existing = (getOverride('moves', selected.id) as Partial<Move> | null) || {};
    const patch: Partial<Move> = { ...existing };
    if (mode === 'shape') {
      const shape: CustomShape = { offsets, origin, range, wallPenetrate };
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
          <Input placeholder="Search moves…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <ScrollArea className="h-[460px]">
          <div className="space-y-1">
            {filtered.map(m => {
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
              <div className="space-y-2">
                <Label className="text-xs">Origin</Label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={origin === 'self' ? 'default' : 'outline'}
                    onClick={() => setOrigin('self')}
                    className="flex-1"
                  >
                    Caster (melee burst)
                  </Button>
                  <Button
                    size="sm"
                    variant={origin === 'target' ? 'default' : 'outline'}
                    onClick={() => setOrigin('target')}
                    className="flex-1"
                  >
                    Target square (ranged)
                  </Button>
                </div>
                {origin === 'target' && (
                  <div>
                    <Label className="text-xs">Max throw range (tiles)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={12}
                      value={range}
                      onChange={e => setRange(parseInt(e.target.value) || 1)}
                    />
                  </div>
                )}
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={wallPenetrate} onChange={e => setWallPenetrate(e.target.checked)} />
                  Ignores walls
                </label>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Click cells where the caster may teleport. Anchor (center) is the caster.
                </p>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={blink} onChange={e => setBlink(e.target.checked)} />
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
                const anchorActive =
                  isAnchor && (mode === 'shape' ? origin === 'self' : true);
                return (
                  <button
                    key={i}
                    onClick={() => toggleCell(dx, dy)}
                    className={`aspect-square rounded text-[10px] border transition-colors ${
                      anchorActive
                        ? 'bg-primary text-primary-foreground border-primary'
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
              Note: overrides are stored to the database now. A small runtime loader
              still needs to be wired up so getMoveById applies them in-game
              (follow-up). Static moves with `customShape` / `movement` set directly
              in moves.ts already work end-to-end.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
