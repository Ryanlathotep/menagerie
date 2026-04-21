// Crafting Workshop - Accessible from main menu
// Materials are kept even when fleeing dungeon
// Recipe learning: bring equipment back from dungeon to unlock recipes

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EquipmentIcon, SlotIcon } from './EquipmentIcon';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  CraftingRecipe,
  CRAFTING_RECIPES,
  RARITY_COLORS,
  craftEquipment,
  EquipmentItem,
  dismantleEquipment,
  CRAFTING_MATERIALS,
  CONSUMABLE_RECIPES,
  ConsumableRecipe,
} from './equipment';
import { isCreativeMode, onCreativeModeChange } from './creativeMode';
import { PICKAXE_TIERS, PICKAXE_TIER_ORDER, nextPickaxeTier, SHOVEL_TIERS, SHOVEL_TIER_ORDER, nextShovelTier, type PickaxeTier, type ShovelTier, type PlayerTools } from './tools';
import { useEffect } from 'react';

interface MaterialInventory {
  [materialId: string]: number;
}

interface CraftingWorkshopProps {
  materials: MaterialInventory;
  playerLevel: number;
  storedEquipment: EquipmentItem[];
  unlockedRecipes: string[];
  tools?: PlayerTools;
  onCraft: (recipe: CraftingRecipe, result: EquipmentItem) => void;
  onCraftConsumable?: (recipe: ConsumableRecipe) => void;
  onDismantle: (itemId: string, materialsGained: { materialId: string; quantity: number }[]) => void;
  onUpgradePickaxe?: (tier: PickaxeTier, materials: { materialId: string; quantity: number }[]) => void;
  onUpgradeShovel?: (tier: ShovelTier, materials: { materialId: string; quantity: number }[]) => void;
  onClose: () => void;
}

export function CraftingWorkshop({
  materials,
  playerLevel,
  storedEquipment,
  unlockedRecipes,
  tools,
  onCraft,
  onCraftConsumable,
  onDismantle,
  onUpgradePickaxe,
  onUpgradeShovel,
  onClose,
}: CraftingWorkshopProps) {
  const [selectedRecipe, setSelectedRecipe] = useState<CraftingRecipe | null>(null);
  const [selectedConsumable, setSelectedConsumable] = useState<ConsumableRecipe | null>(null);
  const [craftedItem, setCraftedItem] = useState<EquipmentItem | null>(null);
  const [craftedConsumable, setCraftedConsumable] = useState<ConsumableRecipe | null>(null);
  const [activeTab, setActiveTab] = useState<'craft' | 'consumables' | 'dismantle' | 'tools'>('craft');
  const [selectedDismantle, setSelectedDismantle] = useState<EquipmentItem | null>(null);
  
  // Creative mode flag — re-renders when toggled so disabled buttons & "missing
  // materials" labels flip live.
  const [creative, setCreative] = useState(isCreativeMode());
  useEffect(() => onCreativeModeChange(setCreative), []);

  // Check if player has materials for recipe (always true in creative mode)
  const canCraft = (recipe: CraftingRecipe | ConsumableRecipe): boolean => {
    if (creative) return true;
    return recipe.materials.every(req => (materials[req.materialId] || 0) >= req.quantity);
  };
  
  // Check if recipe is unlocked (works for both equipment and consumables)
  // Creative mode unlocks every recipe so admins can test any tier.
  const isUnlocked = (recipe: CraftingRecipe | ConsumableRecipe): boolean => {
    if (creative) return true;
    // Common recipes are always unlocked
    const rarity = 'resultRarity' in recipe ? recipe.resultRarity : recipe.rarity;
    if (rarity === 'common') return true;
    return unlockedRecipes.includes(recipe.id);
  };
  
  // Group equipment recipes by rarity
  const recipesByRarity = {
    common: CRAFTING_RECIPES.filter(r => r.resultRarity === 'common'),
    uncommon: CRAFTING_RECIPES.filter(r => r.resultRarity === 'uncommon'),
    rare: CRAFTING_RECIPES.filter(r => r.resultRarity === 'rare'),
    epic: CRAFTING_RECIPES.filter(r => r.resultRarity === 'epic'),
    legendary: CRAFTING_RECIPES.filter(r => r.resultRarity === 'legendary'),
  };
  
  // Group consumable recipes by type
  const consumablesByType = {
    healing: CONSUMABLE_RECIPES.filter(r => r.effect === 'heal_hp' || r.effect === 'heal_stamina' || r.effect === 'heal_full'),
    status: CONSUMABLE_RECIPES.filter(r => r.effect.startsWith('cure_')),
    buffs: CONSUMABLE_RECIPES.filter(r => r.effect.startsWith('boost_')),
    revive: CONSUMABLE_RECIPES.filter(r => r.effect.startsWith('revive')),
  };
  
  const handleCraft = () => {
    if (!selectedRecipe || !canCraft(selectedRecipe) || !isUnlocked(selectedRecipe)) return;
    
    const result = craftEquipment(selectedRecipe, playerLevel);
    setCraftedItem(result);
    onCraft(selectedRecipe, result);
  };
  
  const handleCraftConsumable = () => {
    if (!selectedConsumable || !canCraft(selectedConsumable) || !isUnlocked(selectedConsumable)) return;
    setCraftedConsumable(selectedConsumable);
    onCraftConsumable?.(selectedConsumable);
  };
  
  const handleDismantle = () => {
    if (!selectedDismantle) return;
    
    const result = dismantleEquipment(selectedDismantle);
    onDismantle(selectedDismantle.id, result.materials);
    setSelectedDismantle(null);
  };
  
  return (
    <div className="fixed inset-0 bg-background/90 backdrop-blur-sm z-50 flex items-center justify-center p-2">
      <Card className="w-full max-w-4xl h-[95vh] sm:h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-2 border-b shrink-0 flex items-center gap-2">
          <h2 className="text-sm sm:text-base font-bold bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent shrink-0">
            🔨 <span className="hidden sm:inline">Crafting Workshop</span><span className="sm:hidden">Craft</span>
          </h2>
          <div className="flex gap-1 flex-wrap flex-1 justify-end">
            <Button
              variant={activeTab === 'craft' ? 'default' : 'ghost'}
              size="sm"
              className="text-xs h-7 px-2"
              onClick={() => setActiveTab('craft')}
            >
              ⚒️ Equip
            </Button>
            <Button
              variant={activeTab === 'consumables' ? 'default' : 'ghost'}
              size="sm"
              className="text-xs h-7 px-2"
              onClick={() => setActiveTab('consumables')}
            >
              🧪 Potions
            </Button>
            <Button
              variant={activeTab === 'dismantle' ? 'default' : 'ghost'}
              size="sm"
              className="text-xs h-7 px-2"
              onClick={() => setActiveTab('dismantle')}
            >
              🔧 Dismantle
            </Button>
            <Button
              variant={activeTab === 'tools' ? 'default' : 'ghost'}
              size="sm"
              className="text-xs h-7 px-2"
              onClick={() => setActiveTab('tools')}
            >
              ⛏️ Tools
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 shrink-0"
            onClick={onClose}
            aria-label="Close crafting workshop"
          >
            ✕
          </Button>
        </div>
        
        {activeTab === 'craft' ? (
          <CraftingTab
            recipesByRarity={recipesByRarity}
            selectedRecipe={selectedRecipe}
            setSelectedRecipe={setSelectedRecipe}
            setCraftedItem={setCraftedItem}
            craftedItem={craftedItem}
            materials={materials}
            canCraft={canCraft}
            isUnlocked={isUnlocked}
            handleCraft={handleCraft}
          />
        ) : activeTab === 'consumables' ? (
          <ConsumablesTab
            consumablesByType={consumablesByType}
            selectedConsumable={selectedConsumable}
            setSelectedConsumable={setSelectedConsumable}
            craftedConsumable={craftedConsumable}
            setCraftedConsumable={setCraftedConsumable}
            materials={materials}
            canCraft={canCraft}
            isUnlocked={isUnlocked}
            handleCraftConsumable={handleCraftConsumable}
          />
        ) : activeTab === 'dismantle' ? (
          <DismantleTab
            storedEquipment={storedEquipment}
            selectedDismantle={selectedDismantle}
            setSelectedDismantle={setSelectedDismantle}
            handleDismantle={handleDismantle}
            materials={materials}
          />
        ) : (
          <ToolsTab
            tools={tools}
            materials={materials}
            creative={creative}
            onUpgradePickaxe={onUpgradePickaxe}
            onUpgradeShovel={onUpgradeShovel}
          />
        )}
      </Card>
    </div>
  );
}

// Crafting tab component
function CraftingTab({
  recipesByRarity,
  selectedRecipe,
  setSelectedRecipe,
  setCraftedItem,
  craftedItem,
  materials,
  canCraft,
  isUnlocked,
  handleCraft,
}: {
  recipesByRarity: Record<string, CraftingRecipe[]>;
  selectedRecipe: CraftingRecipe | null;
  setSelectedRecipe: (r: CraftingRecipe | null) => void;
  setCraftedItem: (i: EquipmentItem | null) => void;
  craftedItem: EquipmentItem | null;
  materials: MaterialInventory;
  canCraft: (r: CraftingRecipe) => boolean;
  isUnlocked: (r: CraftingRecipe) => boolean;
  handleCraft: () => void;
}) {
  return (
    <div className="flex-1 overflow-hidden flex flex-col sm:flex-row min-h-0">
      {/* Recipe List */}
      <div className="w-full sm:w-1/2 border-b sm:border-b-0 sm:border-r flex flex-col min-h-0 max-h-[45vh] sm:max-h-none">
        <Tabs defaultValue="common" className="flex-1 flex flex-col min-h-0">
          <TabsList className="w-full grid grid-cols-5 mx-1 my-1 shrink-0">
            <TabsTrigger value="common" className="text-[10px] h-6">Common</TabsTrigger>
            <TabsTrigger value="uncommon" className="text-[10px] h-6 text-green-400">Uncommon</TabsTrigger>
            <TabsTrigger value="rare" className="text-[10px] h-6 text-blue-400">Rare</TabsTrigger>
            <TabsTrigger value="epic" className="text-[10px] h-6 text-purple-400">Epic</TabsTrigger>
            <TabsTrigger value="legendary" className="text-[10px] h-6 text-amber-400">Legend</TabsTrigger>
          </TabsList>
          
          {Object.entries(recipesByRarity).map(([rarity, recipes]) => (
            <TabsContent key={rarity} value={rarity} className="flex-1 m-0 min-h-0">
              <ScrollArea className="h-full">
                <div className="p-1 space-y-1">
                  {recipes.length > 0 ? recipes.map(recipe => {
                    const craftable = canCraft(recipe);
                    const unlocked = isUnlocked(recipe);
                    const rarityStyle = RARITY_COLORS[recipe.resultRarity];
                    
                    return (
                      <button
                        key={recipe.id}
                        onClick={() => {
                          setSelectedRecipe(recipe);
                          setCraftedItem(null);
                        }}
                        className={`
                          w-full p-2 rounded border text-left transition-all
                          ${selectedRecipe?.id === recipe.id 
                            ? 'ring-2 ring-primary' 
                            : 'hover:bg-muted/50'
                          }
                          ${!unlocked 
                            ? 'border-muted opacity-40 grayscale' 
                            : craftable 
                              ? rarityStyle.border 
                              : 'border-muted opacity-60'
                          }
                        `}
                      >
                        <div className="flex items-center gap-2">
                          {unlocked ? (
                            <SlotIcon slot={recipe.resultSlot} size={28} />
                          ) : (
                            <span className="text-lg">❓</span>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-semibold truncate ${unlocked ? rarityStyle.text : 'text-muted-foreground'}`}>
                              {unlocked ? recipe.name : '???'}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {unlocked ? `${recipe.resultSlot}` : 'Find to unlock'}
                            </p>
                          </div>
                          {!unlocked ? (
                            <span className="text-muted-foreground text-[10px]">🔒</span>
                          ) : craftable ? (
                            <span className="text-green-400 text-[10px]">✓</span>
                          ) : null}
                        </div>
                      </button>
                    );
                  }) : (
                    <div className="text-center py-4 text-muted-foreground text-xs">
                      <p>No {rarity} recipes</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
      </div>
      
      {/* Recipe Details & Crafting */}
      <div className="w-full sm:w-1/2 p-2 flex flex-col min-h-0 flex-1">
        <ScrollArea className="flex-1">
          {selectedRecipe ? (
            <div className="space-y-3 pr-2">
              {/* Recipe header with sprite preview */}
              <div className="flex items-center gap-2">
                <SlotIcon slot={selectedRecipe.resultSlot} size={36} />
                <div className="flex-1 min-w-0">
                  <h3 className={`text-sm font-bold truncate ${isUnlocked(selectedRecipe) ? RARITY_COLORS[selectedRecipe.resultRarity].text : 'text-muted-foreground'}`}>
                    {isUnlocked(selectedRecipe) ? selectedRecipe.name : '???'}
                  </h3>
                  <p className="text-[10px] text-muted-foreground capitalize">
                    {selectedRecipe.resultRarity} {selectedRecipe.resultSlot}
                    {selectedRecipe.element && ` • ${selectedRecipe.element}`}
                  </p>
                </div>
              </div>
              
              {!isUnlocked(selectedRecipe) ? (
                <div className="p-2 bg-muted/50 rounded border border-dashed border-muted-foreground/30">
                  <p className="text-xs text-muted-foreground text-center">🔒 Recipe Locked</p>
                  <p className="text-[10px] text-muted-foreground text-center mt-1">
                    Bring back a matching item to unlock!
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">{selectedRecipe.description}</p>
                  
                  {/* Required materials */}
                  <div className="space-y-1">
                    <h4 className="font-semibold text-xs">Required Materials</h4>
                    <div className="space-y-0.5">
                      {selectedRecipe.materials.map(req => {
                        const have = materials[req.materialId] || 0;
                        const enough = have >= req.quantity;
                        
                        return (
                          <div 
                            key={req.materialId}
                            className={`flex items-center justify-between p-1.5 rounded text-xs ${enough ? 'bg-green-500/10' : 'bg-red-500/10'}`}
                          >
                            <span>{req.materialId.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')}</span>
                            <span className={`font-mono ${enough ? 'text-green-400' : 'text-red-400'}`}>
                              {have}/{req.quantity}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
              
              {/* Crafted item preview with sprite */}
              {craftedItem && (
                <div className={`p-2 rounded border ${RARITY_COLORS[craftedItem.rarity].border} ${RARITY_COLORS[craftedItem.rarity].bg}`}>
                  <p className="text-[10px] text-muted-foreground mb-1">Crafted:</p>
                  <div className="flex items-center gap-2">
                    <EquipmentIcon item={craftedItem} size={32} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold truncate ${RARITY_COLORS[craftedItem.rarity].text}`}>
                        {craftedItem.name}
                      </p>
                      <div className="flex flex-wrap gap-0.5 mt-0.5">
                        {Object.entries(craftedItem.stats).map(([stat, value]) => (
                          value !== 0 && (
                            <span 
                              key={stat} 
                              className={`text-[9px] px-1 rounded ${value > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}
                            >
                              {value > 0 ? '+' : ''}{value} {stat.slice(0, 3).toUpperCase()}
                            </span>
                          )
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-center py-8">
              <div className="text-muted-foreground">
                <p className="text-2xl mb-1">🔨</p>
                <p className="text-xs">Select a recipe to craft</p>
                <p className="text-[10px] mt-1">Materials kept when fleeing!</p>
                <p className="text-[10px] text-amber-400">💡 Find items to unlock recipes</p>
              </div>
            </div>
          )}
        </ScrollArea>
        
        {selectedRecipe && (
          <Button
            className="w-full mt-2 h-8 text-xs bg-gradient-to-r from-orange-500 to-amber-500 shrink-0"
            disabled={!canCraft(selectedRecipe) || !isUnlocked(selectedRecipe)}
            onClick={handleCraft}
          >
            {!isUnlocked(selectedRecipe) ? '🔒 Locked' : canCraft(selectedRecipe) ? '🔨 Craft' : '❌ Missing Materials'}
          </Button>
        )}
        
        {/* Material inventory summary */}
        <MaterialSummary materials={materials} />
      </div>
    </div>
  );
}

// Consumables tab component
function ConsumablesTab({
  consumablesByType,
  selectedConsumable,
  setSelectedConsumable,
  craftedConsumable,
  setCraftedConsumable,
  materials,
  canCraft,
  isUnlocked,
  handleCraftConsumable,
}: {
  consumablesByType: Record<string, ConsumableRecipe[]>;
  selectedConsumable: ConsumableRecipe | null;
  setSelectedConsumable: (r: ConsumableRecipe | null) => void;
  craftedConsumable: ConsumableRecipe | null;
  setCraftedConsumable: (r: ConsumableRecipe | null) => void;
  materials: MaterialInventory;
  canCraft: (r: ConsumableRecipe) => boolean;
  isUnlocked: (r: ConsumableRecipe) => boolean;
  handleCraftConsumable: () => void;
}) {
  const typeLabels: Record<string, { label: string; icon: string }> = {
    healing: { label: 'Healing', icon: '❤️' },
    status: { label: 'Status Cures', icon: '💊' },
    buffs: { label: 'Buffs', icon: '⚡' },
    revive: { label: 'Revives', icon: '✨' },
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col sm:flex-row min-h-0">
      {/* Recipe List */}
      <div className="w-full sm:w-1/2 border-b sm:border-b-0 sm:border-r flex flex-col min-h-0 max-h-[45vh] sm:max-h-none">
        <Tabs defaultValue="healing" className="flex-1 flex flex-col min-h-0">
          <TabsList className="w-full grid grid-cols-4 mx-1 my-1 shrink-0">
            {Object.entries(typeLabels).map(([type, { label, icon }]) => (
              <TabsTrigger key={type} value={type} className="text-[10px] h-6">
                {icon} {label}
              </TabsTrigger>
            ))}
          </TabsList>
          
          {Object.entries(consumablesByType).map(([type, recipes]) => (
            <TabsContent key={type} value={type} className="flex-1 m-0 min-h-0">
              <ScrollArea className="h-full">
                <div className="p-1 space-y-1">
                  {recipes.length > 0 ? recipes.map(recipe => {
                    const craftable = canCraft(recipe);
                    const unlocked = isUnlocked(recipe);
                    const rarityStyle = RARITY_COLORS[recipe.rarity];
                    
                    return (
                      <button
                        key={recipe.id}
                        onClick={() => {
                          setSelectedConsumable(recipe);
                          setCraftedConsumable(null);
                        }}
                        className={`
                          w-full p-2 rounded border text-left transition-all
                          ${selectedConsumable?.id === recipe.id 
                            ? 'ring-2 ring-primary' 
                            : 'hover:bg-muted/50'
                          }
                          ${!unlocked 
                            ? 'border-muted opacity-40 grayscale' 
                            : craftable 
                              ? rarityStyle.border 
                              : 'border-muted opacity-60'
                          }
                        `}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{unlocked ? recipe.icon : '❓'}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-semibold truncate ${unlocked ? rarityStyle.text : 'text-muted-foreground'}`}>
                              {unlocked ? recipe.name : '???'}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {unlocked ? recipe.description : 'Find to unlock'}
                            </p>
                          </div>
                          {!unlocked ? (
                            <span className="text-muted-foreground text-[10px]">🔒</span>
                          ) : craftable ? (
                            <span className="text-green-400 text-[10px]">✓</span>
                          ) : null}
                        </div>
                      </button>
                    );
                  }) : (
                    <div className="text-center py-4 text-muted-foreground text-xs">
                      <p>No {type} recipes</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
      </div>
      
      {/* Recipe Details & Crafting */}
      <div className="w-full sm:w-1/2 p-2 flex flex-col min-h-0 flex-1">
        <ScrollArea className="flex-1">
          {selectedConsumable ? (
            <div className="space-y-3 pr-2">
              {/* Recipe header */}
              <div className="flex items-center gap-2">
                <span className="text-2xl">{isUnlocked(selectedConsumable) ? selectedConsumable.icon : '❓'}</span>
                <div className="flex-1 min-w-0">
                  <h3 className={`text-sm font-bold truncate ${isUnlocked(selectedConsumable) ? RARITY_COLORS[selectedConsumable.rarity].text : 'text-muted-foreground'}`}>
                    {isUnlocked(selectedConsumable) ? selectedConsumable.name : '???'}
                  </h3>
                  <p className="text-[10px] text-muted-foreground capitalize">
                    {selectedConsumable.rarity} consumable
                  </p>
                </div>
              </div>
              
              {!isUnlocked(selectedConsumable) ? (
                <div className="p-2 bg-muted/50 rounded border border-dashed border-muted-foreground/30">
                  <p className="text-xs text-muted-foreground text-center">🔒 Recipe Locked</p>
                  <p className="text-[10px] text-muted-foreground text-center mt-1">
                    Bring back this potion to unlock!
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">{selectedConsumable.description}</p>
                  
                  {/* Required materials */}
                  <div className="space-y-1">
                    <h4 className="font-semibold text-xs">Required Materials</h4>
                    <div className="space-y-0.5">
                      {selectedConsumable.materials.map(req => {
                        const have = materials[req.materialId] || 0;
                        const enough = have >= req.quantity;
                        
                        return (
                          <div 
                            key={req.materialId}
                            className={`flex items-center justify-between p-1.5 rounded text-xs ${enough ? 'bg-green-500/10' : 'bg-red-500/10'}`}
                          >
                            <span>{req.materialId.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')}</span>
                            <span className={`font-mono ${enough ? 'text-green-400' : 'text-red-400'}`}>
                              {have}/{req.quantity}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
              
              {/* Crafted consumable confirmation */}
              {craftedConsumable && (
                <div className={`p-2 rounded border ${RARITY_COLORS[craftedConsumable.rarity].border} ${RARITY_COLORS[craftedConsumable.rarity].bg}`}>
                  <p className="text-[10px] text-muted-foreground mb-1">Crafted:</p>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{craftedConsumable.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold truncate ${RARITY_COLORS[craftedConsumable.rarity].text}`}>
                        {craftedConsumable.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">{craftedConsumable.description}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-center py-8">
              <div className="text-muted-foreground">
                <p className="text-2xl mb-1">🧪</p>
                <p className="text-xs">Select a consumable to craft</p>
                <p className="text-[10px] mt-1">Potions, cures, and buffs!</p>
                <p className="text-[10px] text-green-400">💡 Find potions to unlock recipes</p>
              </div>
            </div>
          )}
        </ScrollArea>
        
        {selectedConsumable && (
          <Button
            className="w-full mt-2 h-8 text-xs bg-gradient-to-r from-green-500 to-emerald-500 shrink-0"
            disabled={!canCraft(selectedConsumable) || !isUnlocked(selectedConsumable)}
            onClick={handleCraftConsumable}
          >
            {!isUnlocked(selectedConsumable) ? '🔒 Locked' : canCraft(selectedConsumable) ? '🧪 Brew' : '❌ Missing Materials'}
          </Button>
        )}
        
        {/* Material inventory summary */}
        <MaterialSummary materials={materials} />
      </div>
    </div>
  );
}

// Dismantle tab component
function DismantleTab({
  storedEquipment,
  selectedDismantle,
  setSelectedDismantle,
  handleDismantle,
  materials,
}: {
  storedEquipment: EquipmentItem[];
  selectedDismantle: EquipmentItem | null;
  setSelectedDismantle: (i: EquipmentItem | null) => void;
  handleDismantle: () => void;
  materials: MaterialInventory;
}) {
  const previewResult = selectedDismantle ? dismantleEquipment(selectedDismantle) : null;
  
  return (
    <div className="flex-1 overflow-hidden flex flex-col sm:flex-row min-h-0">
      {/* Equipment List */}
      <div className="w-full sm:w-1/2 border-b sm:border-b-0 sm:border-r flex flex-col min-h-0 max-h-[45vh] sm:max-h-none">
        <div className="p-1.5 border-b text-[10px] text-muted-foreground shrink-0">
          Select equipment to break down
        </div>
        <ScrollArea className="flex-1">
          <div className="p-1 space-y-1">
            {storedEquipment.length > 0 ? storedEquipment.map(item => {
              const rarityStyle = RARITY_COLORS[item.rarity];
              
              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedDismantle(item)}
                  className={`
                    w-full p-2 rounded border text-left transition-all
                    ${selectedDismantle?.id === item.id 
                      ? 'ring-2 ring-primary' 
                      : 'hover:bg-muted/50'
                    }
                    ${rarityStyle.border}
                  `}
                >
                  <div className="flex items-center gap-2">
                    <EquipmentIcon item={item} size={28} showStatPreview={false} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold truncate ${rarityStyle.text}`}>
                        {item.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground capitalize truncate">
                        Lv.{item.level} {item.rarity} {item.slot}
                      </p>
                    </div>
                  </div>
                </button>
              );
            }) : (
              <div className="text-center py-4 text-muted-foreground">
                <p className="text-lg mb-1">📦</p>
                <p className="text-xs">No equipment in storage</p>
                <p className="text-[10px] mt-0.5">Flee the dungeon with gear to store it</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
      
      {/* Dismantle Preview */}
      <div className="w-full sm:w-1/2 p-2 flex flex-col min-h-0 flex-1">
        <ScrollArea className="flex-1">
          {selectedDismantle ? (
            <div className="space-y-3 pr-2">
              {/* Item header with sprite */}
              <div className="flex items-center gap-2">
                <EquipmentIcon item={selectedDismantle} size={36} />
                <div className="flex-1 min-w-0">
                  <h3 className={`text-sm font-bold truncate ${RARITY_COLORS[selectedDismantle.rarity].text}`}>
                    {selectedDismantle.name}
                  </h3>
                  <p className="text-[10px] text-muted-foreground capitalize">
                    Lv.{selectedDismantle.level} {selectedDismantle.rarity} {selectedDismantle.slot}
                  </p>
                </div>
              </div>
              
              {/* Current stats */}
              <div className="space-y-1">
                <h4 className="font-semibold text-xs text-muted-foreground">Current Stats</h4>
                <div className="flex flex-wrap gap-0.5">
                  {Object.entries(selectedDismantle.stats).map(([stat, value]) => (
                    value !== 0 && (
                      <span 
                        key={stat} 
                        className={`text-[10px] px-1.5 py-0.5 rounded ${value > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}
                      >
                        {value > 0 ? '+' : ''}{value} {stat}
                      </span>
                    )
                  ))}
                </div>
              </div>
              
              {/* Materials to receive */}
              <div className="space-y-1">
                <h4 className="font-semibold text-xs text-green-400">Materials You'll Receive</h4>
                <div className="space-y-0.5">
                  {previewResult?.materials.map(({ materialId, quantity }) => {
                    const material = CRAFTING_MATERIALS.find(m => m.id === materialId);
                    return (
                      <div 
                        key={materialId}
                        className="flex items-center justify-between p-1.5 rounded bg-green-500/10 text-xs"
                      >
                        <span className="flex items-center gap-1">
                          <span>{material?.icon || '📦'}</span>
                          {materialId.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')}
                        </span>
                        <span className="font-mono text-green-400">+{quantity}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded">
                <p className="text-[10px] text-amber-400">
                  ⚠️ Cannot be undone. Equipment will be destroyed.
                </p>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-center py-8">
              <div className="text-muted-foreground">
                <p className="text-2xl mb-1">🔧</p>
                <p className="text-xs">Select equipment to dismantle</p>
                <p className="text-[10px] mt-1">Break down gear into materials</p>
              </div>
            </div>
          )}
        </ScrollArea>
        
        {selectedDismantle && (
          <Button
            className="w-full mt-2 h-8 text-xs shrink-0"
            variant="destructive"
            onClick={handleDismantle}
          >
            🔧 Dismantle Equipment
          </Button>
        )}
        
        {/* Material inventory summary */}
        <MaterialSummary materials={materials} />
      </div>
    </div>
  );
}

// Material summary component
function MaterialSummary({ materials }: { materials: MaterialInventory }) {
  return (
    <div className="mt-2 p-2 bg-muted/50 rounded shrink-0">
      <p className="text-[10px] font-semibold text-muted-foreground mb-1">Your Materials</p>
      <div className="flex flex-wrap gap-0.5">
        {Object.entries(materials).length > 0 ? (
          Object.entries(materials).map(([id, qty]) => (
            <TooltipProvider key={id}>
              <Tooltip>
                <TooltipTrigger>
                  <span className="text-[10px] px-1 py-0.5 bg-muted rounded">
                    {id.split('_')[0]}: {qty}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {id.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))
        ) : (
          <span className="text-[10px] text-muted-foreground">No materials yet</span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Tools tab — singleton, upgradeable in place. Pickaxe (and future tools).
// ============================================================================
function ToolsTab({
  tools,
  materials,
  creative,
  onUpgradePickaxe,
  onUpgradeShovel,
}: {
  tools?: PlayerTools;
  materials: MaterialInventory;
  creative: boolean;
  onUpgradePickaxe?: (tier: PickaxeTier, materials: { materialId: string; quantity: number }[]) => void;
  onUpgradeShovel?: (tier: ShovelTier, materials: { materialId: string; quantity: number }[]) => void;
}) {
  const canAfford = (mats: { materialId: string; quantity: number }[]): boolean => {
    if (creative) return true;
    return mats.every(m => (materials[m.materialId] || 0) >= m.quantity);
  };

  // ----- Pickaxe -----
  const currentPickaxe = tools?.pickaxe;
  const currentPickIdx = currentPickaxe ? PICKAXE_TIER_ORDER.indexOf(currentPickaxe) : -1;
  const nextPickTier = nextPickaxeTier(currentPickaxe);
  const nextPickData = nextPickTier ? PICKAXE_TIERS[nextPickTier] : null;

  const handleUpgradePickaxe = () => {
    if (!nextPickTier || !nextPickData) return;
    if (!canAfford(nextPickData.materials)) return;
    onUpgradePickaxe?.(nextPickTier, nextPickData.materials);
  };

  // ----- Shovel -----
  const currentShovel = tools?.shovel;
  const currentShovIdx = currentShovel ? SHOVEL_TIER_ORDER.indexOf(currentShovel) : -1;
  const nextShovTier = nextShovelTier(currentShovel);
  const nextShovData = nextShovTier ? SHOVEL_TIERS[nextShovTier] : null;

  const handleUpgradeShovel = () => {
    if (!nextShovTier || !nextShovData) return;
    if (!canAfford(nextShovData.materials)) return;
    onUpgradeShovel?.(nextShovTier, nextShovData.materials);
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col min-h-0 p-3">
      <ScrollArea className="flex-1">
        <div className="space-y-4 pr-2">
          {/* Pickaxe section */}
          <ToolLadderSection
            title="Pickaxe"
            icon="⛏️"
            blurb="Singleton tool — auto-applied. Upgrade in place to mine harder dungeon walls. Higher tiers also mine faster."
            currentTier={currentPickaxe}
            currentIdx={currentPickIdx}
            order={PICKAXE_TIER_ORDER as readonly string[]}
            tiers={PICKAXE_TIERS as Record<string, { name: string; icon: string; power: number; speed: number; materials: { materialId: string; quantity: number }[] }>}
            nextTier={nextPickTier}
            powerLabel={(power) => `Mines wall tier ≤ ${power}`}
            materials={materials}
            creative={creative}
            onUpgrade={handleUpgradePickaxe}
            maxLabel="✨ Mithril Pickaxe — max tier reached!"
          />

          {/* Shovel section */}
          <ToolLadderSection
            title="Shovel"
            icon="🪏"
            blurb="Singleton tool — auto-applied. Dig up rune tiles (and grass for soil) to harvest placeable Rune Stones. Mismatched runes still bite back when shoveled."
            currentTier={currentShovel}
            currentIdx={currentShovIdx}
            order={SHOVEL_TIER_ORDER as readonly string[]}
            tiers={SHOVEL_TIERS as Record<string, { name: string; icon: string; power: number; speed: number; materials: { materialId: string; quantity: number }[] }>}
            nextTier={nextShovTier}
            powerLabel={(power) => `Digs rune tier ≤ ${power}`}
            materials={materials}
            creative={creative}
            onUpgrade={handleUpgradeShovel}
            maxLabel="✨ Mithril Shovel — max tier reached!"
          />
        </div>
      </ScrollArea>

      <MaterialSummary materials={materials} />
    </div>
  );
}

// Shared renderer for tool tier ladders (Pickaxe, Shovel, future Axe).
function ToolLadderSection({
  title,
  icon,
  blurb,
  currentTier,
  currentIdx,
  order,
  tiers,
  nextTier,
  powerLabel,
  materials,
  creative,
  onUpgrade,
  maxLabel,
}: {
  title: string;
  icon: string;
  blurb: string;
  currentTier: string | undefined;
  currentIdx: number;
  order: readonly string[];
  tiers: Record<string, { name: string; icon: string; power: number; speed: number; materials: { materialId: string; quantity: number }[] }>;
  nextTier: string | null;
  powerLabel: (power: number) => string;
  materials: MaterialInventory;
  creative: boolean;
  onUpgrade: () => void;
  maxLabel: string;
}) {
  const canAfford = (mats: { materialId: string; quantity: number }[]): boolean => {
    if (creative) return true;
    return mats.every(m => (materials[m.materialId] || 0) >= m.quantity);
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        {title}
        {currentTier && (
          <span className="text-[10px] text-muted-foreground font-normal">
            (current: {tiers[currentTier].name})
          </span>
        )}
      </h3>
      <p className="text-[11px] text-muted-foreground">{blurb}</p>

      <div className="space-y-1">
        {order.map((tier, idx) => {
          const data = tiers[tier];
          const owned = idx <= currentIdx;
          const isNext = tier === nextTier;
          const affordable = canAfford(data.materials);

          return (
            <div
              key={tier}
              className={`
                p-2 rounded border flex items-center gap-2 transition-all
                ${owned ? 'border-green-500/50 bg-green-500/5' : ''}
                ${isNext ? 'border-primary ring-1 ring-primary/40' : ''}
                ${!owned && !isNext ? 'border-muted opacity-50' : ''}
              `}
            >
              <span className="text-lg shrink-0">{data.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold">{data.name}</p>
                  {owned && <span className="text-[9px] text-green-400">✓ owned</span>}
                  {isNext && <span className="text-[9px] text-primary">→ next upgrade</span>}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {powerLabel(data.power)} • Speed {data.speed}×
                </p>
                {!owned && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {data.materials.map(req => {
                      const have = materials[req.materialId] || 0;
                      const enough = creative || have >= req.quantity;
                      return (
                        <span
                          key={req.materialId}
                          className={`text-[10px] px-1.5 py-0.5 rounded ${enough ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}
                        >
                          {req.materialId.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')}{' '}
                          {have}/{req.quantity}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
              {isNext && (
                <Button
                  size="sm"
                  className="h-7 text-[10px] px-2 shrink-0 bg-gradient-to-r from-orange-500 to-amber-500"
                  disabled={!affordable}
                  onClick={onUpgrade}
                >
                  {currentTier ? 'Upgrade' : 'Craft'}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {!nextTier && currentTier && (
        <div className="p-2 rounded border border-amber-500/40 bg-amber-500/10 text-center">
          <p className="text-[11px] text-amber-400">{maxLabel}</p>
        </div>
      )}
    </div>
  );
}
