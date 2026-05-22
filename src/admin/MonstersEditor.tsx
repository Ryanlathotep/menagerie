import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { useGameDataOverrides } from '@/hooks/useGameDataOverrides';
import { SPECIES_DATA, SpeciesType, SpeciesData } from '@/game/types';
import { Search, Save, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { computeTrimmedStats, formatNumericHint, rateValueAgainst } from './statCompare';
import { CopyFromPicker } from './CopyFromPicker';

interface SpeciesEditable extends SpeciesData {
  speciesId: SpeciesType;
}

const STAT_KEYS = ['hp', 'attack', 'defense', 'speed', 'special'] as const;
type StatKey = typeof STAT_KEYS[number];

function statTotal(s?: SpeciesData['baseStats']): number {
  if (!s) return 0;
  return STAT_KEYS.reduce((sum, k) => sum + (s[k] ?? 0), 0);
}

export function MonstersEditor() {
  const { overrides, saveOverride, deleteOverride, getOverride, loading } = useGameDataOverrides('monsters');
  const [search, setSearch] = useState('');
  const [selectedSpecies, setSelectedSpecies] = useState<SpeciesEditable | null>(null);
  const [editedSpecies, setEditedSpecies] = useState<Partial<SpeciesData>>({});

  const allSpecies = useMemo(() => {
    return Object.entries(SPECIES_DATA).map(([id, data]) => ({
      ...data,
      speciesId: id as SpeciesType,
    }));
  }, []);

  // Comparison pool: every species' base stats (with overrides applied).
  const pool = useMemo(() => {
    return allSpecies.map((sp) => {
      const ovr = getOverride('monsters', sp.speciesId) as Partial<SpeciesData> | null;
      return { ...sp, ...(ovr || {}) } as SpeciesEditable;
    });
  }, [allSpecies, getOverride]);

  const poolTotals = useMemo(() => pool.map((sp) => statTotal(sp.baseStats)), [pool]);
  const perStatTrim = useMemo(() => {
    const out = {} as Record<StatKey, ReturnType<typeof computeTrimmedStats>>;
    for (const k of STAT_KEYS) {
      out[k] = computeTrimmedStats(pool.map((sp) => sp.baseStats?.[k] ?? 0));
    }
    return out;
  }, [pool]);

  const filteredSpecies = useMemo(() => {
    if (!search) return allSpecies;
    const lower = search.toLowerCase();
    return allSpecies.filter(
      (species) =>
        species.name.toLowerCase().includes(lower) ||
        species.speciesId.toLowerCase().includes(lower) ||
        species.passiveAbility.toLowerCase().includes(lower)
    );
  }, [allSpecies, search]);

  const handleSelectSpecies = (species: SpeciesEditable) => {
    setSelectedSpecies(species);
    const override = getOverride('monsters', species.speciesId) as Partial<SpeciesData> | null;
    setEditedSpecies(override ? { ...species, ...override } : { ...species });
  };

  const handleSave = async () => {
    if (!selectedSpecies) return;
    const success = await saveOverride('monsters', selectedSpecies.speciesId, editedSpecies as Record<string, unknown>);
    if (success) toast.success(`Saved override for ${selectedSpecies.name}`);
  };

  const handleReset = async () => {
    if (!selectedSpecies) return;
    const success = await deleteOverride('monsters', selectedSpecies.speciesId);
    if (success) {
      setEditedSpecies({ ...selectedSpecies });
      toast.success(`Reset ${selectedSpecies.name} to defaults`);
    }
  };

  const handleStatChange = (stat: StatKey, value: number) => {
    const currentStats = editedSpecies.baseStats || selectedSpecies?.baseStats;
    if (!currentStats) return;
    setEditedSpecies({
      ...editedSpecies,
      baseStats: { ...currentStats, [stat]: value },
    });
  };

  const hasOverride = selectedSpecies ? !!getOverride('monsters', selectedSpecies.speciesId) : false;

  const currentStats = editedSpecies.baseStats || selectedSpecies?.baseStats;
  const currentTotal = statTotal(currentStats);
  const ratingInfo = useMemo(() => rateValueAgainst(currentTotal, poolTotals), [currentTotal, poolTotals]);
  const totalTrim = useMemo(() => computeTrimmedStats(poolTotals), [poolTotals]);

  if (loading) return <div className="text-muted-foreground p-4">Loading monsters...</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Species List */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search species..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
        </div>

        <ScrollArea className="h-[400px]">
          <div className="space-y-1">
            {filteredSpecies.map((species) => {
              const hasOvr = !!getOverride('monsters', species.speciesId);
              const effective = pool.find((p) => p.speciesId === species.speciesId);
              const total = statTotal(effective?.baseStats);
              return (
                <button
                  key={species.speciesId}
                  onClick={() => handleSelectSpecies(species)}
                  className={`w-full text-left p-2 rounded text-sm hover:bg-muted transition-colors flex justify-between items-center ${
                    selectedSpecies?.speciesId === species.speciesId ? 'bg-primary/20' : ''
                  }`}
                >
                  <span className="truncate">
                    <span className="font-medium">{species.name}</span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      ({species.category})
                    </span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-mono text-muted-foreground">{total}</span>
                    {hasOvr && (
                      <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded">mod</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </ScrollArea>

        <div className="mt-2 text-xs text-muted-foreground">
          {filteredSpecies.length} species • {overrides.length} overrides
        </div>
      </Card>

      {/* Species Editor */}
      <Card className="p-4">
        {selectedSpecies ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">{selectedSpecies.name}</h3>
              {hasOverride && (
                <span className="text-xs bg-amber-500/20 text-amber-500 px-2 py-1 rounded">
                  Has Override
                </span>
              )}
            </div>

            {/* ----- Stat Total Rating ----- */}
            <div className="rounded-md border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">Stat Total</span>
                <span className="font-mono">
                  {ratingInfo.rating}
                  <span className="text-muted-foreground"> / {ratingInfo.max}</span>
                </span>
              </div>
              <Progress
                value={Math.min(100, (ratingInfo.rating / Math.max(1, ratingInfo.max)) * 100)}
                className="h-2"
              />
              <div className="text-xs text-muted-foreground flex justify-between">
                <span>Stronger than {ratingInfo.percentile}% of species</span>
                <span>avg {ratingInfo.avg} • min {ratingInfo.min} • max {ratingInfo.max}</span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                {formatNumericHint(totalTrim)}
              </div>
            </div>

            <CopyFromPicker
              sources={pool.map((p) => ({ id: p.speciesId, name: `${p.name} (${p.category})` }))}
              excludeId={selectedSpecies.speciesId}
              onPick={(sourceId) => {
                const src = pool.find((p) => p.speciesId === sourceId);
                if (!src) return;
                const cloned = JSON.parse(JSON.stringify(src)) as SpeciesEditable;
                // Preserve the target's identity; clone every other field.
                setEditedSpecies({
                  ...cloned,
                  name: selectedSpecies.name,
                });
              }}
              label={`Copy fields into "${selectedSpecies.name}" from`}
            />

            <div>
              <Label>Name</Label>
              <Input
                value={(editedSpecies.name as string) || ''}
                onChange={(e) => setEditedSpecies({ ...editedSpecies, name: e.target.value })}
              />
            </div>

            <div>
              <Label>Passive Ability</Label>
              <Input
                value={(editedSpecies.passiveAbility as string) || ''}
                onChange={(e) => setEditedSpecies({ ...editedSpecies, passiveAbility: e.target.value })}
              />
            </div>

            <div>
              <Label>Passive Description</Label>
              <Input
                value={(editedSpecies.passiveDescription as string) || ''}
                onChange={(e) => setEditedSpecies({ ...editedSpecies, passiveDescription: e.target.value })}
              />
            </div>

            <div>
              <Label>Base Stats</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                {STAT_KEYS.map((stat) => {
                  const trim = perStatTrim[stat];
                  return (
                    <div key={stat} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm capitalize w-16">{stat}</span>
                        <Input
                          type="number"
                          value={currentStats?.[stat] ?? 0}
                          onChange={(e) => handleStatChange(stat, parseInt(e.target.value) || 0)}
                        />
                      </div>
                      <div className="text-[10px] text-muted-foreground pl-[72px]">
                        {formatNumericHint(trim)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} className="flex-1 gap-2">
                <Save className="w-4 h-4" />
                Save Override
              </Button>
              {hasOverride && (
                <Button variant="outline" onClick={handleReset} className="gap-2">
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            Select a species to edit
          </div>
        )}
      </Card>
    </div>
  );
}
