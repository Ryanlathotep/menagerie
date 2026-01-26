import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useGameDataOverrides } from '@/hooks/useGameDataOverrides';
import { SPECIES_DATA, SpeciesType, SpeciesData } from '@/game/types';
import { Search, Save, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

interface SpeciesEditable extends SpeciesData {
  speciesId: SpeciesType;
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
    setEditedSpecies(override || { ...species });
  };

  const handleSave = async () => {
    if (!selectedSpecies) return;
    
    const success = await saveOverride('monsters', selectedSpecies.speciesId, editedSpecies as Record<string, unknown>);
    if (success) {
      toast.success(`Saved override for ${selectedSpecies.name}`);
    }
  };

  const handleReset = async () => {
    if (!selectedSpecies) return;
    
    const success = await deleteOverride('monsters', selectedSpecies.speciesId);
    if (success) {
      setEditedSpecies({ ...selectedSpecies });
      toast.success(`Reset ${selectedSpecies.name} to defaults`);
    }
  };

  const handleStatChange = (stat: keyof SpeciesData['baseStats'], value: number) => {
    const currentStats = editedSpecies.baseStats || selectedSpecies?.baseStats;
    if (!currentStats) return;
    
    setEditedSpecies({
      ...editedSpecies,
      baseStats: {
        hp: currentStats.hp,
        attack: currentStats.attack,
        defense: currentStats.defense,
        speed: currentStats.speed,
        special: currentStats.special,
        [stat]: value,
      },
    });
  };

  const hasOverride = selectedSpecies ? !!getOverride('monsters', selectedSpecies.speciesId) : false;

  if (loading) {
    return <div className="text-muted-foreground p-4">Loading monsters...</div>;
  }

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
              return (
                <button
                  key={species.speciesId}
                  onClick={() => handleSelectSpecies(species)}
                  className={`w-full text-left p-2 rounded text-sm hover:bg-muted transition-colors flex justify-between items-center ${
                    selectedSpecies?.speciesId === species.speciesId ? 'bg-primary/20' : ''
                  }`}
                >
                  <span>
                    <span className="font-medium">{species.name}</span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      ({species.category})
                    </span>
                  </span>
                  {hasOvr && (
                    <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                      Modified
                    </span>
                  )}
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
              <div className="grid grid-cols-2 gap-2 mt-2">
                {(['hp', 'attack', 'defense', 'speed', 'special'] as const).map((stat) => (
                  <div key={stat} className="flex items-center gap-2">
                    <span className="text-sm capitalize w-16">{stat}</span>
                    <Input
                      type="number"
                      value={(editedSpecies.baseStats || selectedSpecies.baseStats)?.[stat] ?? 0}
                      onChange={(e) => handleStatChange(stat, parseInt(e.target.value) || 0)}
                    />
                  </div>
                ))}
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
