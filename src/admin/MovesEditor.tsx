import { useState, useMemo, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { useGameDataOverrides } from '@/hooks/useGameDataOverrides';
import { SPECIES_MOVES, ELEMENT_MOVES, CLASS_MOVES, Move } from '@/game/moves';
import { rateAgainst, setSingleMoveOverride } from '@/game/moveOverrides';
import { SpeciesType, ElementType, ClassType } from '@/game/types';
import { Search, Save, RotateCcw, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const ALL_SPECIES: SpeciesType[] = [
  'slime', 'skeleton', 'goblin', 'mushroom', 'ghost',
  'imp', 'golem', 'wisp', 'chimera', 'dragon',
  'rat', 'spider', 'bat', 'snake', 'wolf',
  'beetle', 'crow', 'shark', 'frog', 'jellyfish',
];
const ALL_ELEMENTS: ElementType[] = ['normal', 'fire', 'water', 'earth', 'air', 'void'];
const ALL_CLASSES: ClassType[] = ['normal', 'kinetic', 'energy', 'biological', 'chemical', 'political'];

type SourcedMove = { move: Move; source: string; sourceId: string; isCustom: boolean };

type NumericFieldKey = 'power' | 'accuracy' | 'staminaCost' | 'speedMod' | 'aoeRadius' | 'unlockLevel';

type NumericFieldStats = {
  min: number;
  max: number;
  avg: number;
};

function computeTrimmedStats(values: number[]): NumericFieldStats {
  const clean = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (clean.length === 0) return { min: 0, max: 0, avg: 0 };

  const trim = Math.floor(clean.length * 0.1);
  const trimmed = trim * 2 < clean.length ? clean.slice(trim, clean.length - trim) : clean;
  const avg = Math.round(trimmed.reduce((sum, value) => sum + value, 0) / trimmed.length);

  return {
    min: trimmed[0],
    max: trimmed[trimmed.length - 1],
    avg,
  };
}

function formatNumericHint(stats: NumericFieldStats) {
  return `Typical ${stats.min}–${stats.max} • avg ${stats.avg}`;
}

export function MovesEditor() {
  const { overrides, saveOverride, deleteOverride, getOverride, loading } = useGameDataOverrides('moves');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editedMove, setEditedMove] = useState<Partial<Move>>({});

  // Built-in moves (with their built-in pool as the inferred default availability).
  const builtIns = useMemo<SourcedMove[]>(() => {
    const out: SourcedMove[] = [];
    Object.entries(SPECIES_MOVES).forEach(([s, list]) => list.forEach((m) => out.push({ move: m, source: 'Species', sourceId: s, isCustom: false })));
    Object.entries(ELEMENT_MOVES).forEach(([e, list]) => list.forEach((m) => out.push({ move: m, source: 'Element', sourceId: e, isCustom: false })));
    Object.entries(CLASS_MOVES).forEach(([c, list]) => list.forEach((m) => out.push({ move: m, source: 'Class', sourceId: c, isCustom: false })));
    return out;
  }, []);

  // Custom (admin-created) moves come from overrides that carry `custom: true`.
  const customMoves = useMemo<SourcedMove[]>(() => {
    return overrides
      .filter((o) => (o.data_value as Partial<Move>)?.custom)
      .map((o) => ({
        move: o.data_value as unknown as Move,
        source: 'Custom',
        sourceId: 'admin',
        isCustom: true,
      }));
  }, [overrides]);

  const allMoves: SourcedMove[] = useMemo(() => {
    // De-duplicate built-ins by id (they appear in multiple pools if shared).
    const seen = new Set<string>();
    const uniq: SourcedMove[] = [];
    for (const sm of builtIns) {
      if (!seen.has(sm.move.id)) {
        seen.add(sm.move.id);
        uniq.push(sm);
      }
    }
    return [...customMoves, ...uniq];
  }, [builtIns, customMoves]);

  const filteredMoves = useMemo(() => {
    if (!search) return allMoves;
    const lower = search.toLowerCase();
    return allMoves.filter(
      ({ move, source, sourceId }) =>
        move.name.toLowerCase().includes(lower) ||
        move.id.toLowerCase().includes(lower) ||
        source.toLowerCase().includes(lower) ||
        sourceId.toLowerCase().includes(lower) ||
        (move.effect ?? '').toLowerCase().includes(lower)
    );
  }, [allMoves, search]);

  // The comparison pool for rating = every move in the game.
  const ratingPool: Move[] = useMemo(() => allMoves.map((m) => m.move), [allMoves]);

  const selected = useMemo(() => allMoves.find((m) => m.move.id === selectedId) ?? null, [allMoves, selectedId]);

  const selectedOverride = useMemo(() => {
    if (!selected) return null;
    return (overrides.find((entry) => entry.data_type === 'moves' && entry.data_key === selected.move.id)?.data_value as Partial<Move>) ?? null;
  }, [overrides, selected]);

  // Only re-seed editedMove when the SELECTION changes, not on every overrides
  // refetch. Refetches (which happen after each save) were wiping in-progress
  // edits and causing empty `{}` payloads on the next Save click.
  const loadedForIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selected) {
      loadedForIdRef.current = null;
      return;
    }
    if (loadedForIdRef.current === selected.move.id) return;
    loadedForIdRef.current = selected.move.id;
    setEditedMove(selectedOverride ? { ...selected.move, ...selectedOverride } : { ...selected.move });
  }, [selected, selectedOverride]);

  const handleSelect = (id: string) => setSelectedId(id);

  const handleAddNew = () => {
    const id = `custom_${Date.now().toString(36)}`;
    const draft: Move = {
      id,
      name: 'New Move',
      description: 'A custom admin-designed move.',
      type: 'melee',
      power: 25,
      accuracy: 95,
      staminaCost: 6,
      speedMod: 0,
      aspects: ['species'],
      unlockLevel: 1,
      availableSpecies: [],
      availableElements: [],
      availableClasses: [],
      custom: true,
    };
    setSingleMoveOverride(id, draft); // optimistic local
    saveOverride('moves', id, draft as unknown as Record<string, unknown>).then((ok) => {
      if (ok) {
        loadedForIdRef.current = id; // we've already seeded editedMove below
        setSelectedId(id);
        setEditedMove(draft);
      }
    });
  };

  const handleSave = async () => {
    if (!selected) return;
    // Guard against saving an empty payload (e.g. if state was wiped mid-edit).
    // Always start from the currently-selected move so required fields persist.
    const base = selected.move as Move;
    const merged: Move = { ...base, ...editedMove, id: base.id } as Move;
    if (selected.isCustom) merged.custom = true;
    // Refuse obviously broken saves rather than overwriting with junk.
    if (!merged.name || !merged.type) {
      toast.error('Move is missing required fields');
      return;
    }
    const ok = await saveOverride('moves', base.id, merged as unknown as Record<string, unknown>);
    if (ok) {
      setSingleMoveOverride(base.id, merged);
      setEditedMove(merged);
      toast.success(`Saved ${merged.name}`);
    }
  };

  const handleReset = async () => {
    if (!selected) return;
    const ok = await deleteOverride('moves', selected.move.id);
    if (ok) {
      setSingleMoveOverride(selected.move.id, null);
      if (selected.isCustom) setSelectedId(null);
      else setEditedMove({ ...selected.move });
      toast.success(selected.isCustom ? 'Deleted custom move' : `Reset ${selected.move.name}`);
    }
  };

  const hasOverride = selected ? !!getOverride('moves', selected.move.id) : false;
  const ratingInfo = useMemo(() => rateAgainst(editedMove, ratingPool), [editedMove, ratingPool]);
  const numericStats = useMemo<Record<NumericFieldKey, NumericFieldStats>>(() => ({
    power: computeTrimmedStats(ratingPool.map((move) => move.power ?? 0)),
    accuracy: computeTrimmedStats(ratingPool.map((move) => move.accuracy ?? 100)),
    staminaCost: computeTrimmedStats(ratingPool.map((move) => move.staminaCost ?? 0)),
    speedMod: computeTrimmedStats(ratingPool.map((move) => move.speedMod ?? 0)),
    aoeRadius: computeTrimmedStats(ratingPool.map((move) => move.aoeRadius ?? 0)),
    unlockLevel: computeTrimmedStats(ratingPool.map((move) => move.unlockLevel ?? 1)),
  }), [ratingPool]);

  if (loading) return <div className="text-muted-foreground p-4">Loading moves...</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* ============ Move List ============ */}
      <Card className="order-2 lg:order-1 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, id, source, effect…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          <Button size="sm" onClick={handleAddNew} className="gap-1">
            <Plus className="w-4 h-4" /> New
          </Button>
        </div>

          <ScrollArea className="h-[260px] lg:h-[480px]">
          <div className="space-y-1">
            {filteredMoves.map(({ move, source, sourceId, isCustom }) => {
              const hasOvr = !!getOverride('moves', move.id);
              const r = rateAgainst(move, ratingPool).rating;
              return (
                <button
                  key={move.id}
                  onClick={() => handleSelect(move.id)}
                  className={`w-full text-left p-2 rounded text-sm hover:bg-muted transition-colors flex justify-between items-center ${
                    selectedId === move.id ? 'bg-primary/20' : ''
                  }`}
                >
                  <span className="truncate">
                    <span className="font-medium">{move.name}</span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      ({isCustom ? 'Custom' : `${source}: ${sourceId}`})
                    </span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-mono text-muted-foreground">{r}</span>
                    {hasOvr && !isCustom && (
                      <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded">mod</span>
                    )}
                    {isCustom && (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-600 px-1.5 py-0.5 rounded">new</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </ScrollArea>

        <div className="mt-2 text-xs text-muted-foreground">
          {filteredMoves.length} moves • {customMoves.length} custom • {overrides.length - customMoves.length} overrides
        </div>
      </Card>

      {/* ============ Move Editor ============ */}
      <Card className="order-1 lg:order-2 p-4">
        {selected ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg truncate">{(editedMove.name as string) || selected.move.name}</h3>
              <div className="flex items-center gap-2 shrink-0">
                {selected.isCustom && (
                  <span className="text-xs bg-emerald-500/20 text-emerald-600 px-2 py-1 rounded">Custom</span>
                )}
                {hasOverride && !selected.isCustom && (
                  <span className="text-xs bg-amber-500/20 text-amber-500 px-2 py-1 rounded">Has Override</span>
                )}
              </div>
            </div>

            {/* ----- Rating ----- */}
            <div className="rounded-md border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">Power Rating</span>
                <span className="font-mono">
                  {ratingInfo.rating}
                  <span className="text-muted-foreground"> / {ratingInfo.max}</span>
                </span>
              </div>
              <Progress value={Math.min(100, (ratingInfo.rating / Math.max(1, ratingInfo.max)) * 100)} className="h-2" />
              <div className="text-xs text-muted-foreground flex justify-between">
                <span>Stronger than {ratingInfo.percentile}% of moves</span>
                <span>avg {ratingInfo.avg} • min {ratingInfo.min} • max {ratingInfo.max}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Name</Label>
                <Input
                  value={(editedMove.name as string) || ''}
                  onChange={(e) => setEditedMove({ ...editedMove, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Type</Label>
                <Select
                  value={(editedMove.type as string) || 'melee'}
                  onValueChange={(v) => setEditedMove({ ...editedMove, type: v as Move['type'] })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="melee">Melee</SelectItem>
                    <SelectItem value="ranged">Ranged</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                    <SelectItem value="heal">Heal</SelectItem>
                    <SelectItem value="movement">Movement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <Input
                value={(editedMove.description as string) || ''}
                onChange={(e) => setEditedMove({ ...editedMove, description: e.target.value })}
              />
            </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
               <NumberField label="Power" value={editedMove.power ?? 0}
                 hint={formatNumericHint(numericStats.power)}
                 onChange={(v) => setEditedMove({ ...editedMove, power: v })} />
               <NumberField label="Accuracy" value={editedMove.accuracy ?? 100}
                 hint={formatNumericHint(numericStats.accuracy)}
                 onChange={(v) => setEditedMove({ ...editedMove, accuracy: v })} />
               <NumberField label="Stamina Cost" value={editedMove.staminaCost ?? 0}
                 hint={formatNumericHint(numericStats.staminaCost)}
                 onChange={(v) => setEditedMove({ ...editedMove, staminaCost: v })} />
            </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
               <NumberField label="Speed Mod" value={editedMove.speedMod ?? 0}
                 hint={formatNumericHint(numericStats.speedMod)}
                 onChange={(v) => setEditedMove({ ...editedMove, speedMod: v })} />
               <NumberField label="AoE Radius" value={editedMove.aoeRadius ?? 0}
                 hint={formatNumericHint(numericStats.aoeRadius)}
                 onChange={(v) => setEditedMove({ ...editedMove, aoeRadius: v })} />
            </div>

            {/* ----- Learned-at-level slider ----- */}
            <div>
              <div className="flex justify-between mb-1">
                <div>
                  <Label>Learned at Level</Label>
                  <div className="text-[11px] text-muted-foreground">{formatNumericHint(numericStats.unlockLevel)}</div>
                </div>
                <span className="text-sm font-mono">{editedMove.unlockLevel ?? 1}</span>
              </div>
              <Slider
                min={1}
                max={50}
                step={1}
                value={[editedMove.unlockLevel ?? 1]}
                onValueChange={([v]) => setEditedMove({ ...editedMove, unlockLevel: v })}
              />
            </div>

            <EffectPicker
              value={(editedMove.effect as string) || ''}
              onChange={(v) => setEditedMove({ ...editedMove, effect: v || undefined })}
            />

            {/* ----- Damage-type toggles ----- */}
            <div className="rounded-md border border-border bg-muted/30 p-2 space-y-2">
              <div className="text-xs font-semibold">Damage Types</div>

              <ToggleRow
                label="Inherit caster's element"
                hint="Move uses the caster's own element for elemental matchups (overrides the fixed element below)."
                checked={!!editedMove.inheritMonsterElement}
                onChange={(v) => setEditedMove({ ...editedMove, inheritMonsterElement: v })}
              />
              <ToggleRow
                label="Inherit caster's class"
                hint="Move uses the caster's own class for class matchups (overrides the fixed class below)."
                checked={!!editedMove.inheritMonsterClass}
                onChange={(v) => setEditedMove({ ...editedMove, inheritMonsterClass: v })}
              />

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Fixed Element</Label>
                  <Select
                    value={(editedMove.element as string) ?? 'none'}
                    onValueChange={(v) => setEditedMove({ ...editedMove, element: v === 'none' ? undefined : (v as ElementType) })}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (typeless)</SelectItem>
                      {ALL_ELEMENTS.map((e) => (
                        <SelectItem key={e} value={e} className="capitalize">{e}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Fixed Class</Label>
                  <Select
                    value={(editedMove.classBonus as string) ?? 'none'}
                    onValueChange={(v) => setEditedMove({ ...editedMove, classBonus: v === 'none' ? undefined : (v as ClassType) })}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (typeless)</SelectItem>
                      {ALL_CLASSES.map((c) => (
                        <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground leading-tight">
                Use the dropdowns to force a damage type outside the caster's usual element/class.
                Inherit toggles take priority when on.
              </div>

              <ToggleRow
                label="Triggers traps & rune effects on AoE overlap"
                hint="When the move's AoE covers a trap, the trap fires; non-favored creatures on rune tiles take backlash damage."
                checked={!!editedMove.triggersTrapsOnAoe}
                onChange={(v) => setEditedMove({ ...editedMove, triggersTrapsOnAoe: v })}
              />
            </div>


            {/* ----- Availability toggles ----- */}
            <div className="rounded-md border border-border bg-muted/30 p-2 space-y-1">
              <div className="text-xs font-semibold">Availability Logic</div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={(editedMove.availabilityMode ?? 'all') === 'all' ? 'default' : 'outline'}
                  className="h-7 text-xs flex-1"
                  onClick={() => setEditedMove({ ...editedMove, availabilityMode: 'all' })}
                >
                  Requires ALL (AND)
                </Button>
                <Button
                  size="sm"
                  variant={editedMove.availabilityMode === 'any' ? 'default' : 'outline'}
                  className="h-7 text-xs flex-1"
                  onClick={() => setEditedMove({ ...editedMove, availabilityMode: 'any' })}
                >
                  Any match (OR)
                </Button>
              </div>
              <div className="text-[10px] text-muted-foreground leading-tight">
                {(editedMove.availabilityMode ?? 'all') === 'all'
                  ? 'Monster must match every populated list below (species AND element AND class).'
                  : 'Monster qualifies if it matches at least one populated list below.'}
                {' '}Empty lists are ignored either way.
              </div>
            </div>

            <AvailabilityToggles
              title="Available Species"
              options={ALL_SPECIES}
              selected={(editedMove.availableSpecies as SpeciesType[]) || []}
              onChange={(v) => setEditedMove({ ...editedMove, availableSpecies: v })}
              hint={selected.isCustom ? 'Empty = no species restriction' : 'Empty = inherit built-in pool (originally in ' + (selected.source === 'Species' ? selected.sourceId : '—') + ')'}
            />
            <AvailabilityToggles
              title="Available Elements"
              options={ALL_ELEMENTS}
              selected={(editedMove.availableElements as ElementType[]) || []}
              onChange={(v) => setEditedMove({ ...editedMove, availableElements: v })}
              hint={selected.isCustom ? 'Empty = any element' : 'Empty = inherit built-in pool'}
            />
            <AvailabilityToggles
              title="Available Classes"
              options={ALL_CLASSES}
              selected={(editedMove.availableClasses as ClassType[]) || []}
              onChange={(v) => setEditedMove({ ...editedMove, availableClasses: v })}
              hint={selected.isCustom ? 'Empty = any class' : 'Empty = inherit built-in pool'}
            />

            <div className="flex gap-2">
              <Button onClick={handleSave} className="flex-1 gap-2">
                <Save className="w-4 h-4" /> Save
              </Button>
              {(hasOverride || selected.isCustom) && (
                <Button variant="outline" onClick={handleReset} className="gap-2">
                  {selected.isCustom ? <Trash2 className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                  {selected.isCustom ? 'Delete' : 'Reset'}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
            Select a move to edit — or click <span className="mx-1 inline-flex items-center gap-1 rounded border px-1.5 py-0.5"><Plus className="w-3 h-3" />New</span> to design one.
          </div>
        )}
      </Card>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function NumberField({ label, value, onChange, hint }: { label: string; value: number; onChange: (v: number) => void; hint?: string }) {
  // Keep a local string so iOS users can clear the field, type "-", "12", etc.
  // without each keystroke being coerced to 0 (which previously made it feel
  // like the keyboard wasn't working).
  const [text, setText] = useState<string>(String(value ?? 0));

  // Re-sync when the parent value changes from outside (e.g. selecting a
  // different move) but not while the user is mid-edit with a matching number.
  useEffect(() => {
    const parsed = parseInt(text, 10);
    if (Number.isNaN(parsed) || parsed !== value) {
      setText(String(value ?? 0));
}

function ToggleRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`w-full text-left flex items-start gap-2 p-2 rounded border transition-colors ${
        checked ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50'
      }`}
    >
      <div className={`mt-0.5 h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
        checked ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40'
      }`}>
        {checked ? '✓' : ''}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium">{label}</div>
        {hint && <div className="text-[10px] text-muted-foreground leading-tight">{hint}</div>}
      </div>
    </button>
  );
}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const commit = (raw: string) => {
    const n = parseInt(raw, 10);
    onChange(Number.isFinite(n) ? n : 0);
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-2 mb-1">
        <Label>{label}</Label>
        {hint && <span className="text-[11px] text-muted-foreground text-right">{hint}</span>}
      </div>
      <Input
        type="text"
        inputMode="numeric"
        pattern="-?[0-9]*"
        autoComplete="off"
        value={text}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          // Only push valid integers up; allow empty / "-" locally.
          if (/^-?\d+$/.test(v)) commit(v);
        }}
        onBlur={() => {
          commit(text);
          setText(String(parseInt(text, 10) || 0));
        }}
      />
    </div>
  );
}

function AvailabilityToggles<T extends string>({
  title, options, selected, onChange, hint,
}: {
  title: string;
  options: T[];
  selected: T[];
  onChange: (v: T[]) => void;
  hint?: string;
}) {
  const toggle = (opt: T) => {
    if (selected.includes(opt)) onChange(selected.filter((s) => s !== opt));
    else onChange([...selected, opt]);
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <Label>{title}</Label>
        <div className="flex gap-1">
          <button type="button" className="text-[11px] text-muted-foreground hover:text-foreground" onClick={() => onChange([...options])}>all</button>
          <span className="text-[11px] text-muted-foreground">·</span>
          <button type="button" className="text-[11px] text-muted-foreground hover:text-foreground" onClick={() => onChange([])}>none</button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <Button
              key={opt}
              type="button"
              size="sm"
              variant={active ? 'default' : 'outline'}
              onClick={() => toggle(opt)}
              className="h-7 text-xs capitalize"
            >
              {opt}
            </Button>
          );
        })}
      </div>
      {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

// All known move effects, grouped for readability.
const EFFECT_GROUPS: { label: string; effects: string[] }[] = [
  { label: 'Status / DoT', effects: ['poison', 'burn', 'paralyze', 'confuse'] },
  { label: 'Self Buffs', effects: ['raise_attack', 'raise_defense', 'raise_special', 'raise_speed', 'raise_accuracy', 'raise_dodge', 'raise_all_stats'] },
  { label: 'Debuffs', effects: ['lower_attack', 'lower_defense', 'lower_special', 'lower_speed', 'lower_accuracy', 'lower_all_stats'] },
  { label: 'Resource', effects: ['heal_self', 'restore_stamina', 'drain_stamina', 'drain_enemy_stamina'] },
  { label: 'Special', effects: ['crit_chance', 'crit_vs_wounded', 'bonus_vs_wounded', 'charge_next', 'double_next', 'copy_type', 'steal_buff', 'steal_item', 'find_item', 'reveal_stats'] },
];
const ALL_EFFECTS = Array.from(new Set(EFFECT_GROUPS.flatMap((g) => g.effects))).sort();

function EffectPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const matches = (e: string) => !q || e.toLowerCase().includes(q) || e.replace(/_/g, ' ').includes(q);
  const isCustom = value && !ALL_EFFECTS.includes(value);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Effect</Label>
        <span className="text-xs text-muted-foreground">
          {value ? <>Selected: <code className="font-mono">{value}</code></> : 'None'}
        </span>
      </div>

      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search effects… (or type a custom ID)" className="pl-8" />
      </div>

      <ScrollArea className="h-40 rounded-md border p-2">
        <div className="space-y-2">
          {EFFECT_GROUPS.map((group) => {
            const shown = group.effects.filter(matches);
            if (shown.length === 0) return null;
            return (
              <div key={group.label}>
                <div className="text-xs font-semibold text-muted-foreground mb-1">{group.label}</div>
                <div className="flex flex-wrap gap-1.5">
                  {shown.map((eff) => {
                    const active = value === eff;
                    return (
                      <Button key={eff} type="button" size="sm" variant={active ? 'default' : 'outline'}
                        onClick={() => onChange(active ? '' : eff)} className="h-7 text-xs">
                        {eff.replace(/_/g, ' ')}
                      </Button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {q && !ALL_EFFECTS.some(matches) && (
            <Button type="button" size="sm" variant={value === query.trim() ? 'default' : 'secondary'}
              onClick={() => onChange(query.trim())} className="h-7 text-xs">
              Use custom: "{query.trim()}"
            </Button>
          )}
        </div>
      </ScrollArea>

      {isCustom && <div className="text-xs text-amber-600">Custom effect ID — combat logic must handle "{value}".</div>}
      {value && (
        <Button type="button" size="sm" variant="ghost" onClick={() => onChange('')} className="h-7 text-xs">
          Clear effect
        </Button>
      )}
    </div>
  );
}
