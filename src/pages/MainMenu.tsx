import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { GameProvider as _unused, useGame, buildProgressSnapshot } from '@/game/state';
import { UnlockedMonster, InventoryItem } from '@/game/types';
import { createMonster } from '@/game/utils';
import {
  CraftingRecipe,
  ConsumableRecipe,
  EquipmentItem,
  MonsterEquipment,
  createEmptyEquipment,
} from '@/game/equipment';
import { isCreativeMode, effectiveTools } from '@/game/creativeMode';
import { SettingsButton } from '@/game/Settings';
import { TownShop } from '@/game/TownShop';
import { CraftingWorkshop } from '@/game/CraftingWorkshop';
import { DungeonListPanel } from '@/game/DungeonListPanel';
import { ItemWorldTowerPicker } from '@/game/ItemWorldTowerPicker';
import { getItemWorldTowerType } from '@/game/itemWorldTowers';
import { DungeonEntrance } from '@/game/types';
import { useAuth } from '@/hooks/useAuth';
import { useCloudSave } from '@/hooks/useCloudSave';

void _unused;

export function MainMenu() {
  const { state, dispatch } = useGame();
  const [showCrafting, setShowCrafting] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [pendingItemWorldEntrance, setPendingItemWorldEntrance] = useState<DungeonEntrance | null>(null);
  const { signOut, isAuthenticated } = useAuth();
  const { syncSave, saveToCloud, syncing, lastSyncTime } = useCloudSave();
  const navigate = useNavigate();

  const handleResetSave = () => {
    if (confirm('Are you sure you want to reset all progress? This cannot be undone.')) {
      dispatch({ type: 'RESET_SAVE' });
      toast.success('Save data reset!');
    }
  };

  const handleCraft = (recipe: CraftingRecipe, result: EquipmentItem) => {
    if (!isCreativeMode()) {
      dispatch({ type: 'USE_MATERIALS', materials: recipe.materials });
    }
    dispatch({ type: 'STORE_EQUIPMENT', item: result });
    toast.success(`Crafted ${result.name}!`);
  };

  const handleCraftConsumable = (recipe: ConsumableRecipe) => {
    if (!isCreativeMode()) {
      dispatch({ type: 'USE_MATERIALS', materials: recipe.materials });
    }
    const consumableItem: InventoryItem = {
      id: recipe.resultId,
      name: recipe.name,
      type: 'potion',
      value: 0,
      effect: recipe.effect,
      quantity: 1,
    };
    dispatch({ type: 'STORE_ITEM', item: consumableItem });
    toast.success(`Brewed ${recipe.name}!`);
  };

  const handleDismantle = (itemId: string, materialsGained: { materialId: string; quantity: number }[]) => {
    dispatch({ type: 'DISMANTLE_EQUIPMENT', itemId });
    const materialNames = materialsGained
      .map(m => `${m.quantity}x ${m.materialId.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')}`)
      .join(', ');
    toast.success(`Dismantled! Got ${materialNames}`);
  };

  const handleBuyItem = (item: InventoryItem, price: number) => {
    if (!isCreativeMode()) {
      dispatch({ type: 'SPEND_TOWN_GOLD', amount: price });
    }
    dispatch({ type: 'STORE_ITEM', item });
    toast.success(`Bought ${item.name}!`);
  };

  const handleBuyEquipment = (item: EquipmentItem, price: number) => {
    if (!isCreativeMode()) {
      dispatch({ type: 'SPEND_TOWN_GOLD', amount: price });
    }
    dispatch({ type: 'STORE_EQUIPMENT', item });
    toast.success(`Bought ${item.name}!`);
  };

  const handleSellEquipment = (itemId: string, price: number) => {
    dispatch({ type: 'SELL_EQUIPMENT', itemId, price });
    toast.success(`Sold for ${price} gold!`);
  };

  // Quick-start: skip both character-select and pre-run equipment screens
  // when the player already has a saved party they're happy with.
  const savedPartyIds: string[] = (() => {
    try {
      const raw = localStorage.getItem('menagerie_last_party');
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch { return []; }
  })();
  const quickStartParty = savedPartyIds
    .map(id => state.saveData.unlockedMonsters.find(u => u.comboId === id))
    .filter(Boolean) as UnlockedMonster[];
  const canQuickStart = quickStartParty.length > 0;

  const quickStart = (destination: 'dungeon' | 'overworld', entranceId?: string, startFloor?: number) => {
    if (!canQuickStart) return;
    localStorage.setItem('menagerie_run_destination', destination);
    localStorage.setItem('menagerie_run_origin', 'main_menu');
    if (destination === 'dungeon' && entranceId) {
      const entrance = state.saveData.dungeonEntrances?.[entranceId];
      localStorage.setItem('menagerie_active_dungeon_id', entranceId);
      localStorage.setItem('menagerie_active_dungeon_difficulty', String(entrance?.difficulty || 1));
    } else {
      localStorage.removeItem('menagerie_active_dungeon_id');
    }
    if (startFloor && startFloor > 0) {
      localStorage.setItem('menagerie_selected_start_floor', String(startFloor));
    } else {
      localStorage.removeItem('menagerie_selected_start_floor');
    }

    const monsters = quickStartParty.map(saved =>
      createMonster(
        saved.species,
        saved.classType,
        saved.element,
        saved.level,
        saved.equipment,
        saved.experience,
        saved.moveMastery,
      ),
    );
    const partyPreEquipped: MonsterEquipment[] = monsters.map(m => m.equipment || createEmptyEquipment());

    dispatch({
      type: 'START_RUN',
      monster: monsters[0],
      party: monsters,
      partyPreEquipped,
      withdrawnIds: [],
      preSelectedItems: [],
      destination,
    });
  };

  const highestMonsterLevel = state.saveData.unlockedMonsters.reduce(
    (max, m) => Math.max(max, m.level ?? 1),
    1,
  );

  return (
    <div className="game-container font-serif text-center">
      <div className="w-full max-w-md mx-auto text-center space-y-6 sm:space-y-8 px-2">
        <div className="relative inline-block">
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent pb-2 break-words">
            Monster Menagerie
          </h1>
          <span
            aria-label="Beta"
            className="absolute -bottom-1 -right-3 sm:-right-6 rotate-[-12deg] text-sm sm:text-base font-bold text-accent tracking-wider uppercase drop-shadow-sm"
          >
            Beta
          </span>
        </div>
        <p className="text-muted-foreground text-base sm:text-lg">Play as the monsters. Unlock them all.</p>

        <div className="space-y-4">
          {state.run && (
            <div className="flex gap-2 justify-center">
              <Button
                size="lg"
                className="w-full max-w-xs sm:w-64 bg-gradient-to-r from-accent to-primary hover:opacity-90 animate-pulse"
                onClick={() => {
                  const phase = state.run?.battle
                    ? 'battle'
                    : state.run?.dungeon
                      ? 'dungeon'
                      : 'overworld';
                  dispatch({ type: 'SET_PHASE', phase });
                }}
              >
                ▶️ Resume Run
              </Button>
            </div>
          )}

          <div className="flex gap-2 justify-center flex-wrap">
            <Button
              size="lg"
              className="w-full max-w-xs sm:w-64 bg-gradient-to-r from-secondary to-primary hover:opacity-90"
              onClick={() => {
                localStorage.setItem('menagerie_run_destination', 'overworld');
                localStorage.setItem('menagerie_run_origin', 'main_menu');
                localStorage.removeItem('menagerie_active_dungeon_id');
                dispatch({ type: 'SET_PHASE', phase: 'character_select' });
              }}
            >
              🗺️ Enter Overworld
            </Button>
            {canQuickStart && (
              <Button
                size="lg"
                variant="secondary"
                className="w-full max-w-xs sm:w-64"
                onClick={() => quickStart('overworld')}
                title={`Start with last party (${quickStartParty.length}): ${quickStartParty.map(m => m.species).join(', ')}`}
              >
                ▶️ Start Adventure
              </Button>
            )}
          </div>

          <DungeonListPanel
            dungeonEntrances={state.saveData.dungeonEntrances || {}}
            onLaunch={(entrance) => {
              // Item World towers must pick a base asset first.
              if (entrance.category === 'item_world') {
                setPendingItemWorldEntrance(entrance);
                return;
              }
              localStorage.setItem('menagerie_run_destination', 'dungeon');
              localStorage.setItem('menagerie_run_origin', 'main_menu');
              localStorage.setItem('menagerie_active_dungeon_id', entrance.id);
              localStorage.setItem('menagerie_active_dungeon_difficulty', String(entrance.difficulty || 1));
              dispatch({ type: 'SET_PHASE', phase: 'character_select' });
            }}
            onQuickStart={canQuickStart ? (entrance, startFloor) => quickStart('dungeon', entrance.id, startFloor) : undefined}
            quickStartPartySize={quickStartParty.length}
            highestMonsterLevel={highestMonsterLevel}
          />

          <ItemWorldTowerPicker
            open={pendingItemWorldEntrance !== null}
            towerType={pendingItemWorldEntrance ? getItemWorldTowerType(pendingItemWorldEntrance.id) : null}
            onCancel={() => setPendingItemWorldEntrance(null)}
            onConfirmed={() => {
              const entrance = pendingItemWorldEntrance;
              setPendingItemWorldEntrance(null);
              if (!entrance) return;
              localStorage.setItem('menagerie_run_destination', 'dungeon');
              localStorage.setItem('menagerie_run_origin', 'main_menu');
              localStorage.setItem('menagerie_active_dungeon_id', entrance.id);
              localStorage.setItem('menagerie_active_dungeon_difficulty', String(entrance.difficulty || 1));
              dispatch({ type: 'SET_PHASE', phase: 'character_select' });
            }}
          />


          <div className="flex gap-2 justify-center">
            <Button variant="outline" className="w-32" onClick={() => setShowShop(true)}>
              🏪 Shop
            </Button>
            <Button variant="outline" className="w-32" onClick={() => setShowCrafting(true)}>
              🔨 Crafting
            </Button>
          </div>
        </div>

        <div className="text-sm text-muted-foreground mt-8 space-y-1">
          <p>💰 Gold: {state.saveData.gold || 0}</p>
          <p>🔓 Unlocked: {state.saveData.unlockedMonsters?.length || 1} / 720 monsters</p>
          <p>🏔️ Highest Floor: {state.saveData.highestFloor}</p>
          <p>🎮 Total Runs: {state.saveData.totalRuns}</p>
          <p>📦 Materials: {Object.keys(state.saveData.materials || {}).length} types</p>
          <p>🗃️ Stored Equipment: {state.saveData.storedEquipment?.length || 0} items</p>
          <p>🧪 Stored Consumables: {(state.saveData.storedItems || []).reduce((sum, item) => sum + (item.quantity || 1), 0)} items</p>
        </div>

        <div className="pt-4 border-t border-border/50 space-y-2">
          {isAuthenticated ? (
            <>
              <p className="text-sm text-green-500 flex items-center justify-center gap-2">
                ☁️ {syncing ? 'Syncing...' : 'Cloud Save Active'}
                {lastSyncTime && (
                  <span className="text-xs text-muted-foreground">
                    (Last: {lastSyncTime.toLocaleTimeString()})
                  </span>
                )}
              </p>
              <div className="flex gap-2 justify-center flex-wrap">
                <Button
                  variant="default"
                  size="sm"
                  onClick={async () => {
                    const snapshot = buildProgressSnapshot(state.saveData, state.run, state.saveData.overworldState);
                    const result = await saveToCloud(snapshot);
                    if (result.success) {
                      toast.success('Quick saved to cloud!');
                    } else {
                      toast.error(`Save failed: ${result.error || 'unknown error'}`);
                    }
                  }}
                  disabled={syncing}
                >
                  💾 Quick Save
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const snapshot = buildProgressSnapshot(state.saveData, state.run, state.saveData.overworldState);
                    const result = await syncSave(snapshot);
                    if (result.action === 'downloaded' && result.data) {
                      dispatch({ type: 'LOAD_SAVE', saveData: result.data });
                    }
                  }}
                  disabled={syncing}
                >
                  🔄 Sync Now
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => { await signOut(); navigate('/auth'); }}
                  title="Sign out and sign in as a different user"
                >
                  🔁 Switch Account
                </Button>
                <Button variant="ghost" size="sm" onClick={signOut}>
                  Sign Out
                </Button>
              </div>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => navigate('/auth')}>
              ☁️ Sign In / Create Account
            </Button>
          )}
        </div>

        <div className="flex gap-2 justify-center">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={handleResetSave}>
            Reset Save Data
          </Button>
          <SettingsButton />
        </div>
      </div>

      {showShop && (
        <TownShop
          gold={isCreativeMode() ? Number.MAX_SAFE_INTEGER : (state.saveData.gold || 0)}
          storedEquipment={state.saveData.storedEquipment || []}
          onBuyItem={handleBuyItem}
          onBuyEquipment={handleBuyEquipment}
          onSellEquipment={handleSellEquipment}
          onClose={() => setShowShop(false)}
        />
      )}

      {showCrafting && (
        <CraftingWorkshop
          materials={state.saveData.materials || {}}
          playerLevel={1}
          storedEquipment={state.saveData.storedEquipment || []}
          unlockedRecipes={state.saveData.unlockedRecipes || []}
          tools={effectiveTools(state.saveData.tools)}
          onCraft={handleCraft}
          onCraftConsumable={handleCraftConsumable}
          onDismantle={handleDismantle}
          onUpgradePickaxe={(tier, mats) => {
            if (!isCreativeMode()) {
              dispatch({ type: 'USE_MATERIALS', materials: mats });
            }
            dispatch({ type: 'SET_PICKAXE_TIER', tier });
            toast.success(`${tier.charAt(0).toUpperCase() + tier.slice(1)} Pickaxe ready!`);
          }}
          onUpgradeShovel={(tier, mats) => {
            if (!isCreativeMode()) {
              dispatch({ type: 'USE_MATERIALS', materials: mats });
            }
            dispatch({ type: 'SET_SHOVEL_TIER', tier });
            toast.success(`${tier.charAt(0).toUpperCase() + tier.slice(1)} Shovel ready!`);
          }}
          onCraftWorkstation={(mats) => {
            if (!isCreativeMode()) {
              dispatch({ type: 'USE_MATERIALS', materials: mats });
            }
            dispatch({ type: 'SET_WORKSTATION_OWNED' });
            toast.success('🛠️ Portable Workstation ready! Use it from the dungeon HUD.');
          }}
          onClose={() => setShowCrafting(false)}
        />
      )}
    </div>
  );
}
