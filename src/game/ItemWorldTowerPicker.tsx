// Asset picker for the three Item World towers (Prototyping / Training / Skill Forge).
// Players slot one base asset; that asset seeds the tower's dungeon generation
// and determines what reward they earn when the Extraction Altar is reached.

import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useGame } from './state';
import { ItemWorldTowerType, ITEM_WORLD_REWARD_FLOOR_DELTA } from './itemWorldTowers';
import { SPECIES_MOVES } from './moves';
import { Hammer, Swords, Sparkles } from 'lucide-react';

interface Props {
  open: boolean;
  towerType: ItemWorldTowerType | null;
  onCancel: () => void;
  /** Fired after the asset is committed to save data. Caller proceeds with the normal launch flow. */
  onConfirmed: () => void;
}

const TYPE_META: Record<ItemWorldTowerType, { title: string; subtitle: string; reward: string; icon: typeof Hammer }> = {
  prototyping: {
    title: 'Prototyping Tower',
    subtitle: 'Pick an item to forge.',
    reward: `Reach floor +${ITEM_WORLD_REWARD_FLOOR_DELTA} to permanently unlock this item's crafting recipe.`,
    icon: Hammer,
  },
  training: {
    title: 'Training Tower',
    subtitle: 'Pick a monster to train.',
    reward: `Reach floor +${ITEM_WORLD_REWARD_FLOOR_DELTA} to grant this monster a permanent +1 base level.`,
    icon: Swords,
  },
  skill_creation: {
    title: 'Skill Forge',
    subtitle: 'Pick a move to scribe.',
    reward: `Reach floor +${ITEM_WORLD_REWARD_FLOOR_DELTA} to receive a teachable Scroll of this move.`,
    icon: Sparkles,
  },
};

export function ItemWorldTowerPicker({ open, towerType, onCancel, onConfirmed }: Props) {
  const { state, dispatch } = useGame();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const meta = towerType ? TYPE_META[towerType] : null;

  // Build the asset list per tower type.
  const assets: { id: string; name: string; level: number; sub?: string }[] = useMemo(() => {
    if (!towerType) return [];
    if (towerType === 'prototyping') {
      const seen = new Map<string, { id: string; name: string; level: number; sub?: string }>();
      for (const eq of state.saveData.storedEquipment || []) {
        if (!seen.has(eq.id)) {
          seen.set(eq.id, { id: eq.id, name: eq.name, level: eq.level ?? 1, sub: eq.slot });
        }
      }
      return Array.from(seen.values()).sort((a, b) => b.level - a.level);
    }
    if (towerType === 'training') {
      return (state.saveData.unlockedMonsters || [])
        .map(m => ({
          id: m.comboId,
          name: `${m.species} (${m.element}/${m.classType})`,
          level: m.level ?? 1,
        }))
        .sort((a, b) => b.level - a.level);
    }
    // skill_creation — flatten species movepools the player has unlocked
    const seen = new Map<string, { id: string; name: string; level: number; sub?: string }>();
    const speciesSet = new Set((state.saveData.unlockedMonsters || []).map(m => m.species));
    speciesSet.forEach(sp => {
      for (const mv of SPECIES_MOVES[sp] || []) {
        if (!seen.has(mv.id)) {
          seen.set(mv.id, { id: mv.id, name: mv.name, level: mv.unlockLevel ?? 1, sub: mv.type });
        }
      }
    });
    return Array.from(seen.values()).sort((a, b) => a.level - b.level);
  }, [towerType, state.saveData]);

  const handleConfirm = () => {
    if (!towerType || !selectedId) return;
    const picked = assets.find(a => a.id === selectedId);
    if (!picked) return;
    dispatch({
      type: 'SET_ITEM_WORLD_TOWER_ASSET',
      towerType,
      baseAssetId: picked.id,
      baseAssetName: picked.name,
      baseAssetLevel: picked.level,
    });
    setSelectedId(null);
    onConfirmed();
  };

  const handleCancel = () => {
    setSelectedId(null);
    onCancel();
  };

  if (!meta || !towerType) return null;
  const Icon = meta.icon;
  const existing = state.saveData.itemWorldTowerState?.[towerType];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="w-5 h-5" /> {meta.title}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-1">
              <div>{meta.subtitle}</div>
              <div className="text-xs text-muted-foreground/80">{meta.reward}</div>
              {existing && (
                <div className="text-xs text-amber-600">
                  ⚠ Slotting a new asset resets this tower's layout. Current: <b>{existing.baseAssetName}</b>
                </div>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        {assets.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">
            You don't own anything that can be slotted here yet.
          </div>
        ) : (
          <ScrollArea className="max-h-72 pr-2">
            <div className="space-y-1">
              {assets.map(a => {
                const selected = selectedId === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setSelectedId(a.id)}
                    className={`w-full text-left px-3 py-2 rounded-md border transition-colors ${
                      selected ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{a.name}</span>
                      <Badge variant="secondary" className="text-[10px] shrink-0">Lv. {a.level}</Badge>
                    </div>
                    {a.sub && (
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground capitalize">
                        {a.sub}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={handleCancel}>Cancel</Button>
          <Button size="sm" disabled={!selectedId} onClick={handleConfirm}>Slot & Enter</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
