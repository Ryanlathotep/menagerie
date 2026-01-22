// Crafting Workshop - Accessible from main menu
// Materials are kept even when fleeing dungeon

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
  CraftingMaterial,
  CraftingRecipe,
  CRAFTING_RECIPES,
  RARITY_COLORS,
  craftEquipment,
  EquipmentItem,
} from './equipment';

interface MaterialInventory {
  [materialId: string]: number;
}

interface CraftingWorkshopProps {
  materials: MaterialInventory;
  playerLevel: number;
  onCraft: (recipe: CraftingRecipe, result: EquipmentItem) => void;
  onClose: () => void;
}

export function CraftingWorkshop({
  materials,
  playerLevel,
  onCraft,
  onClose,
}: CraftingWorkshopProps) {
  const [selectedRecipe, setSelectedRecipe] = useState<CraftingRecipe | null>(null);
  const [craftedItem, setCraftedItem] = useState<EquipmentItem | null>(null);
  
  // Check if player has materials for recipe
  const canCraft = (recipe: CraftingRecipe): boolean => {
    return recipe.materials.every(req => (materials[req.materialId] || 0) >= req.quantity);
  };
  
  // Group recipes by rarity
  const recipesByRarity = {
    common: CRAFTING_RECIPES.filter(r => r.resultRarity === 'common'),
    uncommon: CRAFTING_RECIPES.filter(r => r.resultRarity === 'uncommon'),
    rare: CRAFTING_RECIPES.filter(r => r.resultRarity === 'rare'),
    epic: CRAFTING_RECIPES.filter(r => r.resultRarity === 'epic'),
    legendary: CRAFTING_RECIPES.filter(r => r.resultRarity === 'legendary'),
  };
  
  const handleCraft = () => {
    if (!selectedRecipe || !canCraft(selectedRecipe)) return;
    
    const result = craftEquipment(selectedRecipe, playerLevel);
    setCraftedItem(result);
    onCraft(selectedRecipe, result);
  };
  
  return (
    <div className="fixed inset-0 bg-background/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-xl font-bold bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
            🔨 Crafting Workshop
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
        </div>
        
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
                              ${craftable ? rarityStyle.border : 'border-muted opacity-60'}
                            `}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">{recipe.icon}</span>
                              <div className="flex-1">
                                <p className={`font-semibold ${rarityStyle.text}`}>
                                  {recipe.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {recipe.description}
                                </p>
                              </div>
                              {craftable && (
                                <span className="text-green-400 text-xs">✓ Ready</span>
                              )}
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
                    <span className="text-4xl">{selectedRecipe.icon}</span>
                    <div>
                      <h3 className={`text-lg font-bold ${RARITY_COLORS[selectedRecipe.resultRarity].text}`}>
                        {selectedRecipe.name}
                      </h3>
                      <p className="text-sm text-muted-foreground capitalize">
                        {selectedRecipe.resultRarity} {selectedRecipe.resultSlot}
                        {selectedRecipe.element && ` • ${selectedRecipe.element} element`}
                      </p>
                    </div>
                  </div>
                  
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
                  disabled={!canCraft(selectedRecipe)}
                  onClick={handleCraft}
                >
                  {canCraft(selectedRecipe) ? '🔨 Craft' : '❌ Missing Materials'}
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
                </div>
              </div>
            )}
            
            {/* Material inventory summary */}
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
          </div>
        </div>
      </Card>
    </div>
  );
}
