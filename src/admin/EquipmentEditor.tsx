import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { useGameDataOverrides } from '@/hooks/useGameDataOverrides';
import {
  EQUIPMENT_SETS,
  EquipmentSet,
  SetId,
} from '@/game/equipment';
import { Search, Save, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { computeTrimmedStats, formatNumericHint, rateValueAgainst } from './statCompare';

/** Sum every numeric stat across every set-bonus tier, plus a flat bump for
 *  special / effect strings so sets with utility bonuses don't read as weak. */
function setPowerRating(set: Partial<EquipmentSet>): number {
  let total = 0;
  for (const b of set.bonuses || []) {
    if (b.stats) {
      for (const v of Object.values(b.stats)) {
        if (typeof v === 'number') total += v;
      }
    }
    if (b.special) total += 8;
    if (b.effect) total += 6;
    // Higher-piece bonuses are harder to assemble — weight them slightly more.
    total += Math.max(0, (b.pieces - 2)) * 2;
  }
  return Math.round(total);
}

interface EquipmentSetEditable extends EquipmentSet {
  setId: SetId;
}

export function EquipmentEditor() {
  const { overrides, saveOverride, deleteOverride, getOverride, loading } = useGameDataOverrides('equipment');
  const [search, setSearch] = useState('');
  const [selectedSet, setSelectedSet] = useState<EquipmentSetEditable | null>(null);
  const [editedSet, setEditedSet] = useState<Partial<EquipmentSet>>({});

  // Equipment sets list
  const allSets = useMemo(() => {
    return Object.entries(EQUIPMENT_SETS).map(([id, set]) => ({
      ...set,
      setId: id as SetId,
    }));
  }, []);

  // Effective pool with overrides applied — drives the comparison ratings.
  const pool = useMemo(() => {
    return allSets.map((set) => {
      const ovr = getOverride('equipment', set.id) as Partial<EquipmentSet> | null;
      return { ...set, ...(ovr || {}) } as EquipmentSetEditable;
    });
  }, [allSets, getOverride]);
  const poolRatings = useMemo(() => pool.map(setPowerRating), [pool]);
  const ratingTrim = useMemo(() => computeTrimmedStats(poolRatings), [poolRatings]);

  const filteredSets = useMemo(() => {
    if (!search) return allSets;
    const lower = search.toLowerCase();
    return allSets.filter(
      (set) =>
        set.name.toLowerCase().includes(lower) ||
        set.id.toLowerCase().includes(lower) ||
        set.description.toLowerCase().includes(lower)
    );
  }, [allSets, search]);

  const handleSelectSet = (set: EquipmentSetEditable) => {
    setSelectedSet(set);
    const override = getOverride('equipment', set.id) as Partial<EquipmentSet> | null;
    setEditedSet(override ? { ...set, ...override } : { ...set });
  };

  const handleSave = async () => {
    if (!selectedSet) return;
    
    const success = await saveOverride('equipment', selectedSet.id, editedSet as Record<string, unknown>);
    if (success) {
      toast.success(`Saved override for ${selectedSet.name}`);
    }
  };

  const handleReset = async () => {
    if (!selectedSet) return;
    
    const success = await deleteOverride('equipment', selectedSet.id);
    if (success) {
      setEditedSet({ ...selectedSet });
      toast.success(`Reset ${selectedSet.name} to defaults`);
    }
  };

  const hasOverride = selectedSet ? !!getOverride('equipment', selectedSet.id) : false;
  const ratingInfo = useMemo(
    () => rateValueAgainst(setPowerRating(editedSet), poolRatings),
    [editedSet, poolRatings],
  );

  if (loading) {
    return <div className="text-muted-foreground p-4">Loading equipment...</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Set List */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search equipment sets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
        </div>

        <ScrollArea className="h-[400px]">
          <div className="space-y-1">
            {filteredSets.map((set) => {
              const hasOvr = !!getOverride('equipment', set.id);
              return (
                <button
                  key={set.id}
                  onClick={() => handleSelectSet(set)}
                  className={`w-full text-left p-2 rounded text-sm hover:bg-muted transition-colors flex justify-between items-center ${
                    selectedSet?.id === set.id ? 'bg-primary/20' : ''
                  }`}
                >
                  <span>
                    <span 
                      className="font-medium"
                      style={{ color: `hsl(${set.color})` }}
                    >
                      {set.name}
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
          {filteredSets.length} sets • {overrides.length} overrides
        </div>
      </Card>

      {/* Set Editor */}
      <Card className="p-4">
        {selectedSet ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 
                className="font-bold text-lg"
                style={{ color: `hsl(${selectedSet.color})` }}
              >
                {selectedSet.name}
              </h3>
              {hasOverride && (
                <span className="text-xs bg-amber-500/20 text-amber-500 px-2 py-1 rounded">
                  Has Override
                </span>
              )}
            </div>

            <div>
              <Label>Name</Label>
              <Input
                value={(editedSet.name as string) || ''}
                onChange={(e) => setEditedSet({ ...editedSet, name: e.target.value })}
              />
            </div>

            <div>
              <Label>Description</Label>
              <Input
                value={(editedSet.description as string) || ''}
                onChange={(e) => setEditedSet({ ...editedSet, description: e.target.value })}
              />
            </div>

            <div>
              <Label>Color (HSL)</Label>
              <div className="flex gap-2">
                <Input
                  value={(editedSet.color as string) || ''}
                  onChange={(e) => setEditedSet({ ...editedSet, color: e.target.value })}
                  placeholder="e.g., 30 80% 50%"
                />
                <div 
                  className="w-10 h-10 rounded border"
                  style={{ backgroundColor: `hsl(${editedSet.color || selectedSet.color})` }}
                />
              </div>
            </div>

            <div>
              <Label>Set Bonuses</Label>
              <div className="space-y-2 mt-2">
                {(editedSet.bonuses || selectedSet.bonuses)?.map((bonus, idx) => (
                  <div key={idx} className="p-2 bg-muted/50 rounded text-sm">
                    <div className="font-medium">{bonus.pieces}-piece bonus</div>
                    {bonus.stats && (
                      <div className="text-xs text-muted-foreground">
                        Stats: {Object.entries(bonus.stats)
                          .filter(([, v]) => v)
                          .map(([k, v]) => `${k}: +${v}`)
                          .join(', ')}
                      </div>
                    )}
                    {bonus.special && (
                      <div className="text-xs text-primary">{bonus.special}</div>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Bonus editing requires JSON mode (coming soon)
              </p>
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
            Select an equipment set to edit
          </div>
        )}
      </Card>
    </div>
  );
}
