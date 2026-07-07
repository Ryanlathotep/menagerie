// Modal for configuring a crafting station building — tier upgrade + modifier
// slots. Modifiers can be swapped freely; upgrades cost themed materials.

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import {
  BUILDING_DEFINITIONS,
  type CraftingStationKind,
  type PlayerBuilding,
} from './buildings';
import { CRAFTING_MATERIALS } from './equipment';
import {
  STATION_TIER_ORDER,
  getStationTierData,
  getModifierSlotsForTier,
  type StationTier,
} from './crafting/stationTiers';
import { isCreativeMode } from './creativeMode';

interface StationConfigModalProps {
  building: PlayerBuilding;
  stationKind: CraftingStationKind;
  materials: Record<string, number>;
  /** Persist new tier + modifiers back on the building. */
  onUpdate: (nextTier: StationTier, nextModifiers: { materialId: string; quantity: number }[]) => void;
  /** Spend materials for an upgrade. */
  onSpendMaterials: (spent: { materialId: string; quantity: number }[]) => void;
  onClose: () => void;
}

export function StationConfigModal({
  building,
  stationKind,
  materials,
  onUpdate,
  onSpendMaterials,
  onClose,
}: StationConfigModalProps) {
  const def = BUILDING_DEFINITIONS[building.type];
  const currentTier: StationTier = (building.stationTier ?? 1) as StationTier;
  const currentMods = building.stationModifiers ?? [];
  const [modifiers, setModifiers] = useState<{ materialId: string; quantity: number }[]>(currentMods);
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const creative = isCreativeMode();

  const slots = getModifierSlotsForTier(currentTier);
  const nextTier = currentTier < 5 ? ((currentTier + 1) as StationTier) : null;
  const nextTierData = nextTier ? getStationTierData(stationKind, nextTier) : null;

  const canAffordUpgrade = nextTierData ? (
    creative ||
    (nextTierData.upgradeCost.materials.every(m => (materials[m.materialId] || 0) >= m.quantity))
  ) : false;

  const handleUpgrade = () => {
    if (!nextTier || !nextTierData || !canAffordUpgrade) return;
    if (!creative) onSpendMaterials(nextTierData.upgradeCost.materials);
    onUpdate(nextTier, modifiers);
    toast.success(`${def.name} upgraded to ${nextTierData.label}`);
  };

  const handleSaveMods = () => {
    onUpdate(currentTier, modifiers);
    toast.success('Modifiers saved');
    onClose();
  };

  const setSlot = (idx: number, materialId: string | null) => {
    setModifiers(prev => {
      const next = [...prev];
      if (materialId == null) {
        next.splice(idx, 1);
      } else {
        next[idx] = { materialId, quantity: 1 };
      }
      return next.filter(Boolean);
    });
  };

  return (
    <div
      className="fixed inset-0 bg-background/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <Card
        className="p-4 max-w-md w-full space-y-3 max-h-[85vh] overflow-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-bold">{def.emoji} Configure {def.name}</h2>
            <p className="text-[11px] text-muted-foreground">
              Current: {getStationTierData(stationKind, currentTier).label} • {slots} modifier slot{slots === 1 ? '' : 's'}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Modifier slots */}
        <div className="space-y-1">
          <div className="text-xs font-semibold">Station Modifiers</div>
          <p className="text-[10px] text-muted-foreground">
            Materials socketed here add a "Station Bonus" stat lane to every item crafted at this station.
            Changes are free — swap them anytime.
          </p>
          {slots === 0 ? (
            <p className="text-[11px] italic text-muted-foreground">Reach Tier II to unlock modifier slots.</p>
          ) : (
            <div className="flex gap-1 flex-wrap">
              {Array.from({ length: slots }).map((_, i) => {
                const m = modifiers[i];
                const mat = m ? CRAFTING_MATERIALS.find(mm => mm.id === m.materialId) : null;
                return (
                  <button
                    key={i}
                    onClick={() => setPickerSlot(i === pickerSlot ? null : i)}
                    className={`w-12 h-12 rounded border-2 flex items-center justify-center text-2xl
                      ${pickerSlot === i ? 'border-primary bg-primary/10' : mat ? 'border-amber-500/70 bg-amber-500/10' : 'border-dashed border-muted-foreground/40'}`}
                    title={mat ? `${mat.name} — click to change` : 'Empty slot — click to fill'}
                  >
                    {mat ? mat.icon : '＋'}
                  </button>
                );
              })}
            </div>
          )}
          {pickerSlot !== null && (
            <Card className="p-2 mt-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs">Choose material for slot {pickerSlot + 1}</span>
                <Button size="sm" variant="ghost" onClick={() => { setSlot(pickerSlot, null); setPickerSlot(null); }}>
                  Clear
                </Button>
              </div>
              <ScrollArea className="h-40">
                <div className="grid grid-cols-2 gap-1">
                  {CRAFTING_MATERIALS.filter(m => (materials[m.id] || 0) > 0).map(m => (
                    <button
                      key={m.id}
                      onClick={() => { setSlot(pickerSlot, m.id); setPickerSlot(null); }}
                      className="text-left p-1.5 rounded border hover:bg-primary/10 text-xs flex items-center gap-1.5"
                    >
                      <span>{m.icon}</span>
                      <span className="truncate flex-1">{m.name}</span>
                      <span className="text-muted-foreground">×{materials[m.id]}</span>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          )}
        </div>

        {/* Tier upgrade */}
        <div className="border-t pt-3 space-y-1">
          <div className="text-xs font-semibold">Tier Ladder</div>
          <div className="flex flex-wrap gap-1">
            {STATION_TIER_ORDER.map(t => {
              const td = getStationTierData(stationKind, t);
              const owned = t <= currentTier;
              return (
                <span
                  key={t}
                  className={`text-[10px] px-1.5 py-0.5 rounded border ${owned ? td.color + ' bg-muted/30' : 'text-muted-foreground/40 border-dashed'}`}
                >
                  T{t}: {td.grid}×{td.grid} · {td.modifierSlots}slots
                </span>
              );
            })}
          </div>
          {nextTierData ? (
            <div className="text-[11px] text-muted-foreground mt-1">
              Upgrade → <b className={nextTierData.color}>{nextTierData.label}</b>
              {' — '}Cost: {nextTierData.upgradeCost.materials.map(m => {
                const mat = CRAFTING_MATERIALS.find(mm => mm.id === m.materialId);
                const have = materials[m.materialId] || 0;
                return `${mat?.icon ?? ''} ${m.quantity} (have ${have})`;
              }).join(', ') || 'free'}
            </div>
          ) : (
            <div className="text-[11px] text-amber-500 mt-1">Max tier reached.</div>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={handleSaveMods}>
            Save Modifiers
          </Button>
          {nextTier && (
            <Button className="flex-1" disabled={!canAffordUpgrade} onClick={handleUpgrade}>
              Upgrade to T{nextTier}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
