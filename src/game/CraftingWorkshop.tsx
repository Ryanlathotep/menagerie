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
    <div className="fixed inset-0 bg-background/90 backdrop-blur-sm z-50 flex items-center justify-center p-2">
      <Card className="w-full max-w-4xl h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-2 border-b flex items-center justify-between shrink-0">
          <h2 className="text-base font-bold bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
            🔨 Crafting Workshop
          </h2>
          <div className="flex gap-1">
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
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onClose}>✕</Button>
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
    <div className="flex-1 overflow-hidden flex min-h-0">
      {/* Recipe List */}
      <div className="w-1/2 border-r flex flex-col min-h-0">
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
      <div className="w-1/2 p-2 flex flex-col min-h-0">
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
    <div className="flex-1 overflow-hidden flex min-h-0">
      {/* Recipe List */}
      <div className="w-1/2 border-r flex flex-col min-h-0">
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
      <div className="w-1/2 p-2 flex flex-col min-h-0">
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
    <div className="flex-1 overflow-hidden flex min-h-0">
      {/* Equipment List */}
      <div className="w-1/2 border-r flex flex-col min-h-0">
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
      <div className="w-1/2 p-2 flex flex-col min-h-0">
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
