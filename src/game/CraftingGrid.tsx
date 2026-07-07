// Grid-based crafting UI — Minecraft-style pattern crafting.
// Drop materials into cells; the required-pattern determines the item type,
// and extra fillers grant per-material stat bonuses.

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  CRAFTING_MATERIALS,
  RARITY_COLORS,
  type EquipmentItem,
  type Rarity,
} from './equipment';
import { DEFAULT_BLUEPRINTS } from './crafting/patterns';
import { makeEmptyGrid, resolveGrid, hashGrid } from './crafting/grid';
import { buildCraftName } from './crafting/naming';
import {
  getLocalRecipeBook,
  lookupDiscovery,
  recordDiscovery,
  syncCloudRecipeBook,
} from './crafting/recipeBook';
import type { CraftCell, CraftGrid, DiscoveredRecipe, GridSize } from './crafting/types';

interface CraftingGridPanelProps {
  materials: Record<string, number>;
  playerLevel: number;
  gridSize?: GridSize; // depends on station tier — default 3
  worldSeed?: string | null;
  onCraft: (
    item: EquipmentItem | null,
    usedMaterials: { materialId: string; quantity: number }[],
    consumable?: { name: string; icon: string; effectId: string; rarity: Rarity },
  ) => void;
}

export function CraftingGridPanel({
  materials,
  playerLevel,
  gridSize = 3,
  worldSeed,
  onCraft,
}: CraftingGridPanelProps) {
  const [grid, setGrid] = useState<CraftGrid>(() => makeEmptyGrid(gridSize));
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number } | null>(null);
  const [search, setSearch] = useState('');
  const [book, setBook] = useState<DiscoveredRecipe[]>(() => getLocalRecipeBook());
  const [cloudDiscovery, setCloudDiscovery] = useState<DiscoveredRecipe | null>(null);
  const [view, setView] = useState<'grid' | 'book'>('grid');

  useEffect(() => {
    void syncCloudRecipeBook().then(setBook);
  }, []);

  const resolved = useMemo(() => {
    const r = resolveGrid(grid);
    if (!r) return null;
    return { ...r, name: buildCraftName(r) };
  }, [grid]);

  // On grid change, look up discoverer.
  useEffect(() => {
    setCloudDiscovery(null);
    if (!resolved) return;
    let cancel = false;
    void lookupDiscovery(resolved.hash).then((d) => { if (!cancel) setCloudDiscovery(d); });
    return () => { cancel = true; };
  }, [resolved?.hash]);

  const filteredMats = useMemo(() => {
    const list = Object.entries(materials).filter(([, n]) => n > 0);
    const q = search.trim().toLowerCase();
    return list
      .map(([id, count]) => {
        const mat = CRAFTING_MATERIALS.find((m) => m.id === id);
        return mat ? { mat, count } : null;
      })
      .filter((x): x is { mat: (typeof CRAFTING_MATERIALS)[number]; count: number } => !!x)
      .filter(({ mat }) => !q || mat.name.toLowerCase().includes(q) || mat.type.includes(q));
  }, [materials, search]);

  const placeInFirstEmpty = (materialId: string) => {
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        if (!grid[r][c]) {
          setCell(r, c, materialId);
          return;
        }
      }
    }
    toast.error('Grid is full');
  };

  const setCell = (r: number, c: number, materialId: string | null) => {
    setGrid((prev) => {
      const g = prev.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
      g[r][c] = materialId ? { materialId, count: 1 } : null;
      return g;
    });
  };

  const clickCell = (r: number, c: number) => {
    if (grid[r][c]) { setCell(r, c, null); return; }
    setSelectedCell({ r, c });
  };

  const pickMaterial = (materialId: string) => {
    if (selectedCell) {
      setCell(selectedCell.r, selectedCell.c, materialId);
      setSelectedCell(null);
    } else {
      placeInFirstEmpty(materialId);
    }
  };

  const clearGrid = () => setGrid(makeEmptyGrid(gridSize));

  const canCraft = !!resolved && resolved.usedMaterials.every(
    (u) => (materials[u.materialId] || 0) >= u.quantity,
  );

  const handleCraft = () => {
    if (!resolved || !canCraft) return;
    const bp = resolved.blueprint;
    const level = Math.max(1, playerLevel + resolved.levelBonus);
    if (bp.slot === 'consumable' || bp.slot === 'scroll') {
      onCraft(null, resolved.usedMaterials, {
        name: resolved.name,
        icon: bp.icon,
        effectId: bp.effectId ?? 'heal_hp',
        rarity: resolved.rarity,
      });
    } else {
      const item: EquipmentItem = {
        id: `craft_${resolved.hash.slice(0, 12)}_${Date.now()}`,
        name: resolved.name,
        slot: bp.slot,
        rarity: resolved.rarity,
        level,
        stats: resolved.stats,
        icon: bp.icon,
        description: `${bp.name} forged from ${resolved.usedMaterials.length} materials.`,
      };
      onCraft(item, resolved.usedMaterials);
    }
    // Record discovery (local + cloud).
    recordDiscovery({
      hash: resolved.hash,
      blueprintId: bp.id,
      gridSize: grid.length as GridSize,
      grid,
      itemName: resolved.name,
      worldSeed: worldSeed ?? null,
    });
    setBook(getLocalRecipeBook());
    toast.success(`Crafted ${resolved.name}!`);
    clearGrid();
  };

  const loadFromBook = (rec: DiscoveredRecipe) => {
    // Only load if the grid sizes match.
    const size = grid.length;
    if (rec.gridSize !== size) {
      toast.error(`Needs a ${rec.gridSize}×${rec.gridSize} station.`);
      return;
    }
    setGrid(rec.grid.map((row) => row.map((c) => (c ? { ...c } : null))));
    setView('grid');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-3 p-3 flex-1 overflow-hidden">
      {/* LEFT: grid + preview */}
      <div className="flex flex-col gap-3 min-h-0 overflow-auto">
        <div className="flex items-center gap-2">
          <Button size="sm" variant={view === 'grid' ? 'default' : 'ghost'} onClick={() => setView('grid')}>Grid</Button>
          <Button size="sm" variant={view === 'book' ? 'default' : 'ghost'} onClick={() => setView('book')}>
            📖 Recipe Book <span className="ml-1 text-xs opacity-70">({book.length})</span>
          </Button>
          <div className="flex-1" />
          <Button size="sm" variant="ghost" onClick={clearGrid}>Clear</Button>
        </div>

        {view === 'grid' ? (
          <>
            <Card className="p-3 bg-muted/30">
              <div
                className="grid gap-1.5 mx-auto"
                style={{
                  gridTemplateColumns: `repeat(${grid.length}, minmax(0, 1fr))`,
                  maxWidth: grid.length * 76,
                }}
              >
                {grid.flatMap((row, r) =>
                  row.map((cell, c) => (
                    <GridSlot
                      key={`${r}-${c}`}
                      cell={cell}
                      selected={selectedCell?.r === r && selectedCell?.c === c}
                      onClick={() => clickCell(r, c)}
                    />
                  )),
                )}
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Click empty cell then a material — or click material to auto-place. Click a filled cell to remove.
              </p>
            </Card>

            <PreviewPanel
              resolved={resolved}
              canCraft={canCraft}
              discovery={cloudDiscovery}
              worldSeed={worldSeed}
              onCraft={handleCraft}
            />
          </>
        ) : (
          <RecipeBookView book={book} onLoad={loadFromBook} />
        )}
      </div>

      {/* RIGHT: material palette */}
      <Card className="p-3 flex flex-col min-h-0">
        <Input
          placeholder="Filter materials…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2 h-8"
        />
        <div className="text-xs text-muted-foreground mb-1">
          {selectedCell ? `Placing in [${selectedCell.r + 1},${selectedCell.c + 1}]` : 'Click to auto-place'}
        </div>
        <ScrollArea className="flex-1 -mx-1 px-1">
          <div className="grid grid-cols-2 gap-1">
            {filteredMats.map(({ mat, count }) => (
              <button
                key={mat.id}
                onClick={() => pickMaterial(mat.id)}
                className={`text-left p-1.5 rounded border hover:bg-primary/10 transition text-xs flex items-center gap-1.5 ${RARITY_COLORS[mat.rarity].border}`}
                title={`${mat.name} (${mat.type}, ${mat.rarity})`}
              >
                <span className="text-base">{mat.icon}</span>
                <span className="truncate flex-1">{mat.name}</span>
                <span className="text-muted-foreground">×{count}</span>
              </button>
            ))}
            {filteredMats.length === 0 && (
              <div className="col-span-2 text-xs text-muted-foreground p-4 text-center">
                No materials.
              </div>
            )}
          </div>
        </ScrollArea>
      </Card>
    </div>
  );
}

// ---------------- subcomponents ----------------

function GridSlot({
  cell, selected, onClick,
}: { cell: CraftCell | null; selected: boolean; onClick: () => void }) {
  const mat = cell ? CRAFTING_MATERIALS.find((m) => m.id === cell.materialId) : null;
  return (
    <button
      onClick={onClick}
      className={`aspect-square rounded border-2 flex items-center justify-center transition-colors text-2xl
        ${selected ? 'border-primary bg-primary/15' : 'border-muted-foreground/25 bg-background/60 hover:border-primary/50'}`}
      title={mat ? mat.name : 'Empty'}
    >
      {mat ? mat.icon : <span className="text-muted-foreground/40 text-lg">+</span>}
    </button>
  );
}

function PreviewPanel({
  resolved, canCraft, discovery, worldSeed, onCraft,
}: {
  resolved: ReturnType<typeof resolveGrid> extends infer R ? (R extends null ? null : { name: string } & NonNullable<R>) : never;
  canCraft: boolean;
  discovery: DiscoveredRecipe | null;
  worldSeed?: string | null;
  onCraft: () => void;
}) {
  if (!resolved) {
    return (
      <Card className="p-4 text-center text-sm text-muted-foreground">
        Place materials matching a valid pattern to see the result.
        <div className="mt-2 text-xs">
          Try: 🗡️ Dagger = metal on top of wood.
        </div>
        <div className="mt-2 text-xs">
          {DEFAULT_BLUEPRINTS.length} blueprints available.
        </div>
      </Card>
    );
  }
  const bp = resolved.blueprint;
  const isCrossSeed = discovery?.worldSeed && worldSeed && discovery.worldSeed !== worldSeed;
  return (
    <Card className={`p-3 border-2 ${RARITY_COLORS[resolved.rarity].border}`}>
      <div className="flex items-start gap-3">
        <div className="text-4xl">{bp.icon}</div>
        <div className="flex-1 min-w-0">
          <div className={`font-bold ${RARITY_COLORS[resolved.rarity].text}`}>{resolved.name}</div>
          <div className="text-xs text-muted-foreground capitalize">
            {bp.name} • {resolved.rarity}{resolved.levelBonus > 0 ? ` • Lv +${resolved.levelBonus}` : ''}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs mt-1">
            {Object.entries(resolved.stats).map(([k, v]) => (
              <span key={k} className="text-primary">
                +{v} <span className="text-muted-foreground">{k}</span>
              </span>
            ))}
          </div>
          {resolved.fillerBreakdown.length > 0 && (
            <div className="text-[10px] text-muted-foreground mt-1.5 space-y-0.5">
              {resolved.fillerBreakdown.map((f) => {
                const mat = CRAFTING_MATERIALS.find((m) => m.id === f.materialId);
                return (
                  <div key={f.materialId}>
                    {mat?.icon} ×{f.count}: {f.label}
                  </div>
                );
              })}
            </div>
          )}
          {discovery?.discoveredBy && (
            <div className="text-[10px] italic text-amber-500 mt-1.5">
              Invented by <b>{discovery.discoveredBy}</b>
              {isCrossSeed ? ' (another world)' : ''}
            </div>
          )}
          {!discovery && (
            <div className="text-[10px] italic text-emerald-500 mt-1.5">
              ✨ Undiscovered! You'll be credited as its inventor.
            </div>
          )}
        </div>
      </div>
      <Button className="w-full mt-3" disabled={!canCraft} onClick={onCraft}>
        {canCraft ? `Craft ${bp.name}` : 'Missing materials'}
      </Button>
    </Card>
  );
}

function RecipeBookView({
  book, onLoad,
}: { book: DiscoveredRecipe[]; onLoad: (rec: DiscoveredRecipe) => void }) {
  if (book.length === 0) {
    return (
      <Card className="p-6 text-sm text-muted-foreground text-center">
        Your recipe book is empty. Craft or dismantle items to fill it.
      </Card>
    );
  }
  return (
    <Card className="p-2">
      <ScrollArea className="h-[420px]">
        <div className="space-y-1">
          {book.map((rec) => (
            <button
              key={rec.hash}
              onClick={() => onLoad(rec)}
              className="w-full text-left p-2 rounded hover:bg-muted flex items-center gap-2 text-sm"
            >
              <span className="text-lg">📜</span>
              <span className="flex-1 truncate">{rec.itemName}</span>
              <span className="text-xs text-muted-foreground">
                {rec.discoveredBy ? `by ${rec.discoveredBy}` : rec.local ? 'local' : ''}
              </span>
            </button>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
}

/** Helper for a caller to compute a hash for a previously-obtained item (unused externally, kept for future). */
export { hashGrid };
