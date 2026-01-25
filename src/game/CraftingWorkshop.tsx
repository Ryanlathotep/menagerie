// Crafting Workshop - Accessible from main menu
// Materials are kept even when fleeing dungeon
// Recipe learning: bring equipment back from dungeon to unlock recipes

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
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

interface MaterialInventory {
  [materialId: string]: number;
}

interface CraftingWorkshopProps {
  materials: MaterialInventory;
  playerLevel: number;
  storedEquipment: EquipmentItem[];
  unlockedRecipes: string[];
  onCraft: (recipe: CraftingRecipe, result: EquipmentItem) => void;
  onCraftConsumable?: (recipe: ConsumableRecipe) => void;
  onDismantle: (itemId: string, materialsGained: { materialId: string; quantity: number }[]) => void;
  onClose: () => void;
}

export function CraftingWorkshop({
  materials,
  playerLevel,
  storedEquipment,
  unlockedRecipes,
  onCraft,
  onCraftConsumable,
  onDismantle,
  onClose,
}: CraftingWorkshopProps) {
  const [selectedRecipe, setSelectedRecipe] = useState<CraftingRecipe | null>(null);
  const [selectedConsumable, setSelectedConsumable] = useState<ConsumableRecipe | null>(null);
  const [craftedItem, setCraftedItem] = useState<EquipmentItem | null>(null);
  const [craftedConsumable, setCraftedConsumable] = useState<ConsumableRecipe | null>(null);
  const [activeTab, setActiveTab] = useState<'craft' | 'consumables' | 'dismantle'>('craft');
  const [selectedDismantle, setSelectedDismantle] = useState<EquipmentItem | null>(null);
  
  // Check if player has materials for recipe
  const canCraft = (recipe: CraftingRecipe | ConsumableRecipe): boolean => {
    return recipe.materials.every(req => (materials[req.materialId] || 0) >= req.quantity);
  };
  
  // Check if recipe is unlocked (works for both equipment and consumables)
  const isUnlocked = (recipe: CraftingRecipe | ConsumableRecipe): boolean => {
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
    <div className="fixed inset-0 bg-background/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-xl font-bold bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
            🔨 Crafting Workshop
          </h2>
          <div className="flex gap-2">
            <Button
              variant={activeTab === 'craft' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('craft')}
            >
              ⚒️ Equipment
            </Button>
            <Button
              variant={activeTab === 'consumables' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('consumables')}
            >
              🧪 Potions
            </Button>
            <Button
              variant={activeTab === 'dismantle' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('dismantle')}
            >
              🔧 Dismantle
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
          </div>
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
        ) : (
          <DismantleTab
            storedEquipment={storedEquipment}
            selectedDismantle={selectedDismantle}
            setSelectedDismantle={setSelectedDismantle}
            handleDismantle={handleDismantle}
            materials={materials}
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
    <div className="flex-1 overflow-hidden flex">
      {/* Recipe List */}
      <div className="w-1/2 border-r flex flex-col">
        <Tabs defaultValue="common" className="flex-1 flex flex-col">
          <TabsList className="w-full grid grid-cols-5 m-2 mr-4">
            <TabsTrigger value="common" className="text-xs">Common</TabsTrigger>
            <TabsTrigger value="uncommon" className="text-xs text-green-400">Uncommon</TabsTrigger>
            <TabsTrigger value="rare" className="text-xs text-blue-400">Rare</TabsTrigger>
            <TabsTrigger value="epic" className="text-xs text-purple-400">Epic</TabsTrigger>
            <TabsTrigger value="legendary" className="text-xs text-amber-400">Legend</TabsTrigger>
          </TabsList>
          
          {Object.entries(recipesByRarity).map(([rarity, recipes]) => (
            <TabsContent key={rarity} value={rarity} className="flex-1 m-0">
              <ScrollArea className="h-full">
                <div className="p-2 space-y-2">
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
                          w-full p-3 rounded-lg border text-left transition-all
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
                          <span className="text-2xl">{unlocked ? recipe.icon : '❓'}</span>
                          <div className="flex-1">
                            <p className={`font-semibold ${unlocked ? rarityStyle.text : 'text-muted-foreground'}`}>
                              {unlocked ? recipe.name : '???'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {unlocked ? recipe.description : 'Find this item in the dungeon to unlock'}
                            </p>
                          </div>
                          {!unlocked ? (
                            <span className="text-muted-foreground text-xs">🔒</span>
                          ) : craftable ? (
                            <span className="text-green-400 text-xs">✓ Ready</span>
                          ) : null}
                        </div>
                      </button>
                    );
                  }) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No {rarity} recipes available</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
      </div>
      
      {/* Recipe Details & Crafting */}
      <div className="w-1/2 p-4 flex flex-col">
        {selectedRecipe ? (
          <>
            <div className="flex-1 space-y-4">
              {/* Recipe header */}
              <div className="flex items-center gap-3">
                <span className="text-4xl">{isUnlocked(selectedRecipe) ? selectedRecipe.icon : '❓'}</span>
                <div>
                  <h3 className={`text-lg font-bold ${isUnlocked(selectedRecipe) ? RARITY_COLORS[selectedRecipe.resultRarity].text : 'text-muted-foreground'}`}>
                    {isUnlocked(selectedRecipe) ? selectedRecipe.name : '???'}
                  </h3>
                  <p className="text-sm text-muted-foreground capitalize">
                    {selectedRecipe.resultRarity} {selectedRecipe.resultSlot}
                    {selectedRecipe.element && ` • ${selectedRecipe.element} element`}
                  </p>
                </div>
              </div>
              
              {!isUnlocked(selectedRecipe) ? (
                <div className="p-4 bg-muted/50 rounded-lg border border-dashed border-muted-foreground/30">
                  <p className="text-sm text-muted-foreground text-center">
                    🔒 Recipe Locked
                  </p>
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    Bring back a matching item from the dungeon to unlock this recipe!
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-sm">{selectedRecipe.description}</p>
                  
                  {/* Required materials */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Required Materials</h4>
                    <div className="space-y-1">
                      {selectedRecipe.materials.map(req => {
                        const have = materials[req.materialId] || 0;
                        const enough = have >= req.quantity;
                        
                        return (
                          <div 
                            key={req.materialId}
                            className={`
                              flex items-center justify-between p-2 rounded
                              ${enough ? 'bg-green-500/10' : 'bg-red-500/10'}
                            `}
                          >
                            <span className="text-sm">
                              {req.materialId.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')}
                            </span>
                            <span className={`text-sm font-mono ${enough ? 'text-green-400' : 'text-red-400'}`}>
                              {have}/{req.quantity}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
              
              {/* Crafted item preview */}
              {craftedItem && (
                <div className={`p-3 rounded-lg border ${RARITY_COLORS[craftedItem.rarity].border} ${RARITY_COLORS[craftedItem.rarity].bg}`}>
                  <p className="text-xs text-muted-foreground mb-1">Crafted:</p>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{craftedItem.icon}</span>
                    <div>
                      <p className={`font-semibold ${RARITY_COLORS[craftedItem.rarity].text}`}>
                        {craftedItem.name}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.entries(craftedItem.stats).map(([stat, value]) => (
                          value !== 0 && (
                            <span 
                              key={stat} 
                              className={`text-[10px] px-1 rounded ${value > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}
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
            
            <Button
              className="w-full mt-4 bg-gradient-to-r from-orange-500 to-amber-500"
              disabled={!canCraft(selectedRecipe) || !isUnlocked(selectedRecipe)}
              onClick={handleCraft}
            >
              {!isUnlocked(selectedRecipe) ? '🔒 Locked' : canCraft(selectedRecipe) ? '🔨 Craft' : '❌ Missing Materials'}
            </Button>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center">
            <div className="text-muted-foreground">
              <p className="text-4xl mb-2">🔨</p>
              <p>Select a recipe to craft</p>
              <p className="text-xs mt-2">
                Materials are kept even if you flee the dungeon!
              </p>
              <p className="text-xs mt-1 text-amber-400">
                💡 Bring back equipment to unlock new recipes
              </p>
            </div>
          </div>
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
    <div className="flex-1 overflow-hidden flex">
      {/* Recipe List */}
      <div className="w-1/2 border-r flex flex-col">
        <Tabs defaultValue="healing" className="flex-1 flex flex-col">
          <TabsList className="w-full grid grid-cols-4 m-2 mr-4">
            {Object.entries(typeLabels).map(([type, { label, icon }]) => (
              <TabsTrigger key={type} value={type} className="text-xs">
                {icon} {label}
              </TabsTrigger>
            ))}
          </TabsList>
          
          {Object.entries(consumablesByType).map(([type, recipes]) => (
            <TabsContent key={type} value={type} className="flex-1 m-0">
              <ScrollArea className="h-full">
                <div className="p-2 space-y-2">
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
                          w-full p-3 rounded-lg border text-left transition-all
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
                          <span className="text-2xl">{unlocked ? recipe.icon : '❓'}</span>
                          <div className="flex-1">
                            <p className={`font-semibold ${unlocked ? rarityStyle.text : 'text-muted-foreground'}`}>
                              {unlocked ? recipe.name : '???'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {unlocked ? recipe.description : 'Find this item in the dungeon to unlock'}
                            </p>
                          </div>
                          {!unlocked ? (
                            <span className="text-muted-foreground text-xs">🔒</span>
                          ) : craftable ? (
                            <span className="text-green-400 text-xs">✓ Ready</span>
                          ) : null}
                        </div>
                      </button>
                    );
                  }) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No {type} recipes available</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
      </div>
      
      {/* Recipe Details & Crafting */}
      <div className="w-1/2 p-4 flex flex-col">
        {selectedConsumable ? (
          <>
            <div className="flex-1 space-y-4">
              {/* Recipe header */}
              <div className="flex items-center gap-3">
                <span className="text-4xl">{isUnlocked(selectedConsumable) ? selectedConsumable.icon : '❓'}</span>
                <div>
                  <h3 className={`text-lg font-bold ${isUnlocked(selectedConsumable) ? RARITY_COLORS[selectedConsumable.rarity].text : 'text-muted-foreground'}`}>
                    {isUnlocked(selectedConsumable) ? selectedConsumable.name : '???'}
                  </h3>
                  <p className="text-sm text-muted-foreground capitalize">
                    {selectedConsumable.rarity} consumable
                  </p>
                </div>
              </div>
              
              {!isUnlocked(selectedConsumable) ? (
                <div className="p-4 bg-muted/50 rounded-lg border border-dashed border-muted-foreground/30">
                  <p className="text-sm text-muted-foreground text-center">
                    🔒 Recipe Locked
                  </p>
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    Bring back this potion from the dungeon to unlock the recipe!
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-sm">{selectedConsumable.description}</p>
                  
                  {/* Required materials */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Required Materials</h4>
                    <div className="space-y-1">
                      {selectedConsumable.materials.map(req => {
                        const have = materials[req.materialId] || 0;
                        const enough = have >= req.quantity;
                        
                        return (
                          <div 
                            key={req.materialId}
                            className={`
                              flex items-center justify-between p-2 rounded
                              ${enough ? 'bg-green-500/10' : 'bg-red-500/10'}
                            `}
                          >
                            <span className="text-sm">
                              {req.materialId.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')}
                            </span>
                            <span className={`text-sm font-mono ${enough ? 'text-green-400' : 'text-red-400'}`}>
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
                <div className={`p-3 rounded-lg border ${RARITY_COLORS[craftedConsumable.rarity].border} ${RARITY_COLORS[craftedConsumable.rarity].bg}`}>
                  <p className="text-xs text-muted-foreground mb-1">Crafted:</p>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{craftedConsumable.icon}</span>
                    <div>
                      <p className={`font-semibold ${RARITY_COLORS[craftedConsumable.rarity].text}`}>
                        {craftedConsumable.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{craftedConsumable.description}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <Button
              className="w-full mt-4 bg-gradient-to-r from-green-500 to-emerald-500"
              disabled={!canCraft(selectedConsumable) || !isUnlocked(selectedConsumable)}
              onClick={handleCraftConsumable}
            >
              {!isUnlocked(selectedConsumable) ? '🔒 Locked' : canCraft(selectedConsumable) ? '🧪 Brew' : '❌ Missing Materials'}
            </Button>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center">
            <div className="text-muted-foreground">
              <p className="text-4xl mb-2">🧪</p>
              <p>Select a consumable to craft</p>
              <p className="text-xs mt-2">
                Potions, cures, and buffs to aid your adventure!
              </p>
              <p className="text-xs mt-1 text-green-400">
                💡 Bring back potions to unlock new recipes
              </p>
            </div>
          </div>
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
    <div className="flex-1 overflow-hidden flex">
      {/* Equipment List */}
      <div className="w-1/2 border-r flex flex-col">
        <div className="p-2 border-b text-xs text-muted-foreground">
          Select equipment to break down into materials
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-2">
            {storedEquipment.length > 0 ? storedEquipment.map(item => {
              const rarityStyle = RARITY_COLORS[item.rarity];
              
              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedDismantle(item)}
                  className={`
                    w-full p-3 rounded-lg border text-left transition-all
                    ${selectedDismantle?.id === item.id 
                      ? 'ring-2 ring-primary' 
                      : 'hover:bg-muted/50'
                    }
                    ${rarityStyle.border}
                  `}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{item.icon}</span>
                    <div className="flex-1">
                      <p className={`font-semibold ${rarityStyle.text}`}>
                        {item.name}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        Lv.{item.level} {item.rarity} {item.slot}
                      </p>
                    </div>
                  </div>
                </button>
              );
            }) : (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-2xl mb-2">📦</p>
                <p>No equipment in storage</p>
                <p className="text-xs mt-1">Flee the dungeon with equipment to store it</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
      
      {/* Dismantle Preview */}
      <div className="w-1/2 p-4 flex flex-col">
        {selectedDismantle ? (
          <>
            <div className="flex-1 space-y-4">
              {/* Item header */}
              <div className="flex items-center gap-3">
                <span className="text-4xl">{selectedDismantle.icon}</span>
                <div>
                  <h3 className={`text-lg font-bold ${RARITY_COLORS[selectedDismantle.rarity].text}`}>
                    {selectedDismantle.name}
                  </h3>
                  <p className="text-sm text-muted-foreground capitalize">
                    Lv.{selectedDismantle.level} {selectedDismantle.rarity} {selectedDismantle.slot}
                  </p>
                </div>
              </div>
              
              {/* Current stats */}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm text-muted-foreground">Current Stats</h4>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(selectedDismantle.stats).map(([stat, value]) => (
                    value !== 0 && (
                      <span 
                        key={stat} 
                        className={`text-xs px-2 py-0.5 rounded ${value > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}
                      >
                        {value > 0 ? '+' : ''}{value} {stat}
                      </span>
                    )
                  ))}
                </div>
              </div>
              
              {/* Materials to receive */}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm text-green-400">Materials You'll Receive</h4>
                <div className="space-y-1">
                  {previewResult?.materials.map(({ materialId, quantity }) => {
                    const material = CRAFTING_MATERIALS.find(m => m.id === materialId);
                    return (
                      <div 
                        key={materialId}
                        className="flex items-center justify-between p-2 rounded bg-green-500/10"
                      >
                        <span className="text-sm flex items-center gap-2">
                          <span>{material?.icon || '📦'}</span>
                          {materialId.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')}
                        </span>
                        <span className="text-sm font-mono text-green-400">
                          +{quantity}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <p className="text-xs text-amber-400">
                  ⚠️ This action cannot be undone. The equipment will be destroyed.
                </p>
              </div>
            </div>
            
            <Button
              className="w-full mt-4"
              variant="destructive"
              onClick={handleDismantle}
            >
              🔧 Dismantle Equipment
            </Button>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center">
            <div className="text-muted-foreground">
              <p className="text-4xl mb-2">🔧</p>
              <p>Select equipment to dismantle</p>
              <p className="text-xs mt-2">
                Break down unwanted gear into crafting materials
              </p>
            </div>
          </div>
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
    <div className="mt-4 p-3 bg-muted/50 rounded-lg">
      <p className="text-xs font-semibold text-muted-foreground mb-2">Your Materials</p>
      <div className="flex flex-wrap gap-1">
        {Object.entries(materials).length > 0 ? (
          Object.entries(materials).map(([id, qty]) => (
            <TooltipProvider key={id}>
              <Tooltip>
                <TooltipTrigger>
                  <span className="text-xs px-1.5 py-0.5 bg-muted rounded">
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
          <span className="text-xs text-muted-foreground">No materials yet</span>
        )}
      </div>
    </div>
  );
}
