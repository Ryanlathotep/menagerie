// Admin editor for the grid-crafting system.
// Two panes:
//   1) Blueprints — inspect + override required patterns per item.
//   2) Material Effects — override per-material filler contributions.

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useGameDataOverrides } from '@/hooks/useGameDataOverrides';
import { CRAFTING_MATERIALS } from '@/game/equipment';
import { DEFAULT_BLUEPRINTS } from '@/game/crafting/patterns';
import { getMaterialEffect, setMaterialEffectOverride } from '@/game/crafting/materialEffects';
import type { ItemBlueprint, MaterialEffect } from '@/game/crafting/types';

const STAT_KEYS = ['maxHp','attack','defense','speed','dodge','special','stamina','levelBonus'] as const;
type StatKey = typeof STAT_KEYS[number];

export function CraftGridEditor() {
  return (
    <Tabs defaultValue="blueprints">
      <TabsList>
        <TabsTrigger value="blueprints">Blueprints</TabsTrigger>
        <TabsTrigger value="materials">Material Effects</TabsTrigger>
      </TabsList>
      <TabsContent value="blueprints" className="mt-3">
        <BlueprintsEditor />
      </TabsContent>
      <TabsContent value="materials" className="mt-3">
        <MaterialEffectsEditor />
      </TabsContent>
    </Tabs>
  );
}

// ----------- Blueprints -----------

function BlueprintsEditor() {
  const { overrides, saveOverride, deleteOverride, getOverride, loading } = useGameDataOverrides('craft_pattern');
  const [selectedId, setSelectedId] = useState<string>(DEFAULT_BLUEPRINTS[0]?.id);
  const bp = DEFAULT_BLUEPRINTS.find((b) => b.id === selectedId);
  const override = bp ? (getOverride('craft_pattern', bp.id) as Partial<ItemBlueprint> | null) : null;
  const merged: ItemBlueprint | null = bp ? { ...bp, ...override } : null;
  const [draft, setDraft] = useState<ItemBlueprint | null>(merged);

  useEffect(() => {
    setDraft(merged);
  }, [selectedId, overrides.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || !bp || !draft) return <div className="text-muted-foreground">Loading blueprints…</div>;

  const size = Math.max(3, ...draft.pattern.map((p) => Math.max(p.dx, p.dy) + 1));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-3">
      <Card className="p-2">
        <ScrollArea className="h-[500px]">
          <div className="space-y-0.5">
            {DEFAULT_BLUEPRINTS.map((b) => {
              const modified = !!getOverride('craft_pattern', b.id);
              return (
                <button
                  key={b.id}
                  onClick={() => setSelectedId(b.id)}
                  className={`w-full text-left p-2 rounded flex items-center gap-2 text-sm hover:bg-muted ${selectedId === b.id ? 'bg-primary/15' : ''}`}
                >
                  <span>{b.icon}</span>
                  <span className="flex-1">{b.name}</span>
                  <span className="text-xs text-muted-foreground">{b.category}</span>
                  {modified && <span className="text-[10px] bg-primary/20 text-primary px-1 rounded">M</span>}
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="text-3xl">{draft.icon}</div>
          <div className="flex-1">
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="font-bold" />
            <div className="text-xs text-muted-foreground mt-0.5">
              Slot: {draft.slot} • Category: {draft.category} • Min grid: {draft.minGrid}×{draft.minGrid}
            </div>
          </div>
        </div>

        <div>
          <Label>Base stats (JSON)</Label>
          <textarea
            className="w-full text-xs font-mono p-2 rounded border bg-background"
            rows={2}
            value={JSON.stringify(draft.baseStats)}
            onChange={(e) => {
              try { setDraft({ ...draft, baseStats: JSON.parse(e.target.value) }); }
              catch { /* ignore mid-typing */ }
            }}
          />
        </div>

        <div>
          <Label>Required pattern ({draft.pattern.length} cells)</Label>
          <div className="text-xs text-muted-foreground mb-1">
            Filled cells satisfy the pattern; empty cells accept any filler.
          </div>
          <div
            className="grid gap-1 mx-auto mt-2"
            style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`, maxWidth: size * 84 }}
          >
            {Array.from({ length: size * size }).map((_, i) => {
              const dx = i % size, dy = Math.floor(i / size);
              const slotIdx = draft.pattern.findIndex((p) => p.dx === dx && p.dy === dy);
              const slot = slotIdx >= 0 ? draft.pattern[slotIdx] : null;
              return (
                <div
                  key={i}
                  className={`aspect-square rounded border-2 p-1 text-[10px] flex flex-col items-center justify-center gap-0.5
                    ${slot ? 'border-primary/60 bg-primary/10' : 'border-muted/40'}`}
                >
                  {slot ? (
                    <>
                      <select
                        className="w-full text-[10px] bg-transparent"
                        value={slot.role}
                        onChange={(e) => {
                          const p = [...draft.pattern];
                          p[slotIdx] = { ...slot, role: e.target.value as typeof slot.role };
                          setDraft({ ...draft, pattern: p });
                        }}
                      >
                        {['blade','handle','guard','binder','catalyst','base','seal'].map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                      <Input
                        className="h-6 text-[9px] text-center"
                        value={slot.acceptTypes.join(',')}
                        onChange={(e) => {
                          const p = [...draft.pattern];
                          const types = e.target.value.split(',').map((s) => s.trim()).filter(Boolean) as typeof slot.acceptTypes;
                          p[slotIdx] = { ...slot, acceptTypes: types };
                          setDraft({ ...draft, pattern: p });
                        }}
                      />
                      <button
                        className="text-destructive text-[10px] hover:underline"
                        onClick={() => setDraft({ ...draft, pattern: draft.pattern.filter((_, k) => k !== slotIdx) })}
                      >remove</button>
                    </>
                  ) : (
                    <button
                      className="text-muted-foreground hover:text-primary"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          pattern: [...draft.pattern, { dx, dy, role: 'blade', acceptTypes: ['metal'] }],
                        })
                      }
                    >+ add</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={async () => {
              await saveOverride('craft_pattern', bp.id, draft as unknown as Record<string, unknown>);
              toast.success(`Saved override for ${bp.name}`);
            }}
          >Save Override</Button>
          {override && (
            <Button variant="outline" onClick={async () => {
              await deleteOverride('craft_pattern', bp.id);
              toast.success(`Reset ${bp.name}`);
            }}>Reset</Button>
          )}
        </div>
      </Card>
    </div>
  );
}

// ----------- Material Effects -----------

function MaterialEffectsEditor() {
  const { overrides, saveOverride, deleteOverride, getOverride, loading } = useGameDataOverrides('material_effect');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(CRAFTING_MATERIALS[0]?.id);

  // Push all overrides into runtime map so the crafting UI reflects them.
  useEffect(() => {
    for (const o of overrides) {
      setMaterialEffectOverride(o.data_key, o.data_value as unknown as MaterialEffect);
    }
  }, [overrides]);

  const mat = CRAFTING_MATERIALS.find((m) => m.id === selectedId);
  const currentOverride = mat ? (getOverride('material_effect', mat.id) as unknown as MaterialEffect | null) : null;
  const effective = mat ? (currentOverride ?? getMaterialEffect(mat.id)) : null;
  const [draft, setDraft] = useState<MaterialEffect | null>(effective);

  useEffect(() => { setDraft(effective); }, [selectedId, overrides.length]); // eslint-disable-line

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return CRAFTING_MATERIALS.filter((m) => !q || m.name.toLowerCase().includes(q) || m.type.includes(q));
  }, [search]);

  if (loading || !mat || !draft) return <div className="text-muted-foreground">Loading materials…</div>;

  const updateStat = (k: StatKey, v: number) => {
    const perUnit = { ...draft.perUnit };
    if (v === 0) delete (perUnit as Record<string, number>)[k];
    else (perUnit as Record<string, number>)[k] = v;
    setDraft({ ...draft, perUnit });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-3">
      <Card className="p-2">
        <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-2 h-8" />
        <ScrollArea className="h-[500px]">
          <div className="space-y-0.5">
            {filtered.map((m) => {
              const modified = !!getOverride('material_effect', m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedId(m.id)}
                  className={`w-full text-left p-1.5 rounded flex items-center gap-2 text-sm hover:bg-muted ${selectedId === m.id ? 'bg-primary/15' : ''}`}
                >
                  <span>{m.icon}</span>
                  <span className="flex-1 truncate">{m.name}</span>
                  <span className="text-[10px] text-muted-foreground">{m.type}</span>
                  {modified && <span className="text-[10px] bg-primary/20 text-primary px-1 rounded">M</span>}
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="text-3xl">{mat.icon}</div>
          <div>
            <div className="font-bold">{mat.name}</div>
            <div className="text-xs text-muted-foreground">{mat.type} • {mat.rarity}</div>
          </div>
        </div>

        <div>
          <Label>Effect label</Label>
          <Input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
        </div>

        <div>
          <Label>Name prefix (added to items when this material is dominant)</Label>
          <Input
            value={draft.namePrefix ?? ''}
            placeholder="e.g. Blazing, Frost-Kissed, Verdant"
            onChange={(e) => setDraft({ ...draft, namePrefix: e.target.value })}
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Prepended before the item name (with trailing space) when this material is the top filler.
          </p>
        </div>

        <div>
          <Label>Default per-unit stat contribution</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
            {STAT_KEYS.map((k) => (
              <div key={k}>
                <div className="text-[10px] text-muted-foreground capitalize">{k}</div>
                <Input
                  type="number"
                  value={(draft.perUnit as Record<string, number>)[k] ?? 0}
                  onChange={(e) => updateStat(k, Number(e.target.value) || 0)}
                  className="h-8"
                />
              </div>
            ))}
          </div>
        </div>

        <PerItemOverrides
          draft={draft}
          setDraft={setDraft}
        />

        <div className="flex gap-2">
          <Button onClick={async () => {
            await saveOverride('material_effect', mat.id, draft as unknown as Record<string, unknown>);
            setMaterialEffectOverride(mat.id, draft);
            toast.success(`Saved effect for ${mat.name}`);
          }}>Save Override</Button>
          {currentOverride && (
            <Button variant="outline" onClick={async () => {
              await deleteOverride('material_effect', mat.id);
              setMaterialEffectOverride(mat.id, null);
              toast.success(`Reset ${mat.name}`);
            }}>Reset</Button>
          )}
        </div>
      </Card>
    </div>
  );
}

// ---------- Per-item override sub-editor ----------

function PerItemOverrides({
  draft, setDraft,
}: {
  draft: MaterialEffect;
  setDraft: (e: MaterialEffect) => void;
}) {
  const overrides = draft.perItemPerUnit ?? {};
  const [addingBp, setAddingBp] = useState<string>('');

  const updateBpStat = (bpId: string, k: StatKey, v: number) => {
    const cur = { ...(overrides[bpId] ?? {}) } as Record<string, number>;
    if (v === 0) delete cur[k];
    else cur[k] = v;
    const next = { ...overrides, [bpId]: cur };
    if (Object.keys(cur).length === 0) delete next[bpId];
    setDraft({ ...draft, perItemPerUnit: Object.keys(next).length ? next : undefined });
  };

  const removeBp = (bpId: string) => {
    const next = { ...overrides };
    delete next[bpId];
    setDraft({ ...draft, perItemPerUnit: Object.keys(next).length ? next : undefined });
  };

  const unusedBps = DEFAULT_BLUEPRINTS.filter((b) => !(b.id in overrides));

  return (
    <div className="border-t pt-3">
      <Label>Per-item bonus overrides</Label>
      <p className="text-[10px] text-muted-foreground mb-2">
        When this material is used in the named blueprint, these stats replace the default per-unit contribution.
        Leave empty to fall back to the default.
      </p>

      <div className="space-y-2">
        {Object.entries(overrides).map(([bpId, stats]) => {
          const bp = DEFAULT_BLUEPRINTS.find((b) => b.id === bpId);
          return (
            <Card key={bpId} className="p-2 bg-muted/30">
              <div className="flex items-center gap-2 mb-1">
                <span>{bp?.icon}</span>
                <span className="text-sm font-medium flex-1">{bp?.name ?? bpId}</span>
                <button
                  className="text-destructive text-xs hover:underline"
                  onClick={() => removeBp(bpId)}
                >remove</button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {STAT_KEYS.map((k) => (
                  <div key={k}>
                    <div className="text-[9px] text-muted-foreground capitalize">{k}</div>
                    <Input
                      type="number"
                      value={(stats as Record<string, number>)[k] ?? 0}
                      onChange={(e) => updateBpStat(bpId, k, Number(e.target.value) || 0)}
                      className="h-7 text-xs"
                    />
                  </div>
                ))}
              </div>
            </Card>
          );
        })}

        {unusedBps.length > 0 && (
          <div className="flex gap-2">
            <select
              className="flex-1 h-8 text-xs bg-background border rounded px-2"
              value={addingBp}
              onChange={(e) => setAddingBp(e.target.value)}
            >
              <option value="">— add per-item override —</option>
              {unusedBps.map((b) => (
                <option key={b.id} value={b.id}>{b.icon} {b.name}</option>
              ))}
            </select>
            <Button
              size="sm"
              disabled={!addingBp}
              onClick={() => {
                setDraft({
                  ...draft,
                  perItemPerUnit: { ...overrides, [addingBp]: {} },
                });
                setAddingBp('');
              }}
            >Add</Button>
          </div>
        )}
      </div>
    </div>
  );
}
