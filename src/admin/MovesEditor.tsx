import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useGameDataOverrides } from '@/hooks/useGameDataOverrides';
import { SPECIES_MOVES, ELEMENT_MOVES, CLASS_MOVES, Move } from '@/game/moves';
import { Search, Save, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

export function MovesEditor() {
  const { overrides, saveOverride, deleteOverride, getOverride, loading } = useGameDataOverrides('moves');
  const [search, setSearch] = useState('');
  const [selectedMove, setSelectedMove] = useState<Move | null>(null);
  const [editedMove, setEditedMove] = useState<Partial<Move>>({});

  // Gather all moves from code
  const allMoves = useMemo(() => {
    const moves: { move: Move; source: string; sourceId: string }[] = [];

    // Species moves
    Object.entries(SPECIES_MOVES).forEach(([species, speciesMoves]) => {
      speciesMoves.forEach((move) => {
        moves.push({ move, source: 'Species', sourceId: species });
      });
    });

    // Element moves
    Object.entries(ELEMENT_MOVES).forEach(([element, elementMoves]) => {
      elementMoves.forEach((move) => {
        moves.push({ move, source: 'Element', sourceId: element });
      });
    });

    // Class moves
    Object.entries(CLASS_MOVES).forEach(([classType, classMoves]) => {
      classMoves.forEach((move) => {
        moves.push({ move, source: 'Class', sourceId: classType });
      });
    });

    return moves;
  }, []);

  const filteredMoves = useMemo(() => {
    if (!search) return allMoves;
    const lower = search.toLowerCase();
    return allMoves.filter(
      ({ move, source, sourceId }) =>
        move.name.toLowerCase().includes(lower) ||
        move.id.toLowerCase().includes(lower) ||
        source.toLowerCase().includes(lower) ||
        sourceId.toLowerCase().includes(lower)
    );
  }, [allMoves, search]);

  const handleSelectMove = (moveData: { move: Move; source: string; sourceId: string }) => {
    setSelectedMove(moveData.move);
    // Check for existing override
    const override = getOverride('moves', moveData.move.id) as Partial<Move> | null;
    setEditedMove(override || { ...moveData.move });
  };

  const handleSave = async () => {
    if (!selectedMove) return;
    
    const success = await saveOverride('moves', selectedMove.id, editedMove as Record<string, unknown>);
    if (success) {
      toast.success(`Saved override for ${selectedMove.name}`);
    }
  };

  const handleReset = async () => {
    if (!selectedMove) return;
    
    const success = await deleteOverride('moves', selectedMove.id);
    if (success) {
      setEditedMove({ ...selectedMove });
      toast.success(`Reset ${selectedMove.name} to defaults`);
    }
  };

  const hasOverride = selectedMove ? !!getOverride('moves', selectedMove.id) : false;

  if (loading) {
    return <div className="text-muted-foreground p-4">Loading moves...</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Move List */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search moves..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
        </div>

        <ScrollArea className="h-[400px]">
          <div className="space-y-1">
            {filteredMoves.map(({ move, source, sourceId }) => {
              const hasOvr = !!getOverride('moves', move.id);
              return (
                <button
                  key={move.id}
                  onClick={() => handleSelectMove({ move, source, sourceId })}
                  className={`w-full text-left p-2 rounded text-sm hover:bg-muted transition-colors flex justify-between items-center ${
                    selectedMove?.id === move.id ? 'bg-primary/20' : ''
                  }`}
                >
                  <span>
                    <span className="font-medium">{move.name}</span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      ({source}: {sourceId})
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
          {filteredMoves.length} moves • {overrides.length} overrides
        </div>
      </Card>

      {/* Move Editor */}
      <Card className="p-4">
        {selectedMove ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">{selectedMove.name}</h3>
              {hasOverride && (
                <span className="text-xs bg-amber-500/20 text-amber-500 px-2 py-1 rounded">
                  Has Override
                </span>
              )}
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
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="melee">Melee</SelectItem>
                    <SelectItem value="ranged">Ranged</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                    <SelectItem value="heal">Heal</SelectItem>
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

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Power</Label>
                <Input
                  type="number"
                  value={(editedMove.power as number) ?? 0}
                  onChange={(e) => setEditedMove({ ...editedMove, power: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Accuracy</Label>
                <Input
                  type="number"
                  value={(editedMove.accuracy as number) ?? 100}
                  onChange={(e) => setEditedMove({ ...editedMove, accuracy: parseInt(e.target.value) || 100 })}
                />
              </div>
              <div>
                <Label>Stamina Cost</Label>
                <Input
                  type="number"
                  value={(editedMove.staminaCost as number) ?? 0}
                  onChange={(e) => setEditedMove({ ...editedMove, staminaCost: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Speed Mod</Label>
                <Input
                  type="number"
                  value={(editedMove.speedMod as number) ?? 0}
                  onChange={(e) => setEditedMove({ ...editedMove, speedMod: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Unlock Level</Label>
                <Input
                  type="number"
                  value={(editedMove.unlockLevel as number) ?? 1}
                  onChange={(e) => setEditedMove({ ...editedMove, unlockLevel: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>

            <EffectPicker
              value={(editedMove.effect as string) || ''}
              onChange={(v) => setEditedMove({ ...editedMove, effect: v || undefined })}
            />


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
            Select a move to edit
          </div>
        )}
      </Card>
    </div>
  );
}
