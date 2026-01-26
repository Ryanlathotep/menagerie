import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useGameDataOverrides } from '@/hooks/useGameDataOverrides';
import { 
  CRAFTING_RECIPES, 
  CraftingRecipe,
  CRAFTING_MATERIALS
} from '@/game/equipment';
import { Search, Save, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

export function RecipesEditor() {
  const { overrides, saveOverride, deleteOverride, getOverride, loading } = useGameDataOverrides('recipes');
  const [search, setSearch] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<CraftingRecipe | null>(null);
  const [editedRecipe, setEditedRecipe] = useState<Partial<CraftingRecipe>>({});

  const filteredRecipes = useMemo(() => {
    if (!search) return CRAFTING_RECIPES;
    const lower = search.toLowerCase();
    return CRAFTING_RECIPES.filter(
      (recipe) =>
        recipe.name.toLowerCase().includes(lower) ||
        recipe.id.toLowerCase().includes(lower) ||
        recipe.resultSlot?.toLowerCase().includes(lower) ||
        recipe.resultRarity?.toLowerCase().includes(lower)
    );
  }, [search]);

  const handleSelectRecipe = (recipe: CraftingRecipe) => {
    setSelectedRecipe(recipe);
    const override = getOverride('recipes', recipe.id) as Partial<CraftingRecipe> | null;
    setEditedRecipe(override || { ...recipe });
  };

  const handleSave = async () => {
    if (!selectedRecipe) return;
    
    const success = await saveOverride('recipes', selectedRecipe.id, editedRecipe as Record<string, unknown>);
    if (success) {
      toast.success(`Saved override for ${selectedRecipe.name}`);
    }
  };

  const handleReset = async () => {
    if (!selectedRecipe) return;
    
    const success = await deleteOverride('recipes', selectedRecipe.id);
    if (success) {
      setEditedRecipe({ ...selectedRecipe });
      toast.success(`Reset ${selectedRecipe.name} to defaults`);
    }
  };

  const handleMaterialChange = (materialId: string, quantity: number) => {
    const currentMaterials = editedRecipe.materials || selectedRecipe?.materials || [];
    const existingIndex = currentMaterials.findIndex(m => m.materialId === materialId);
    
    let newMaterials: { materialId: string; quantity: number }[];
    if (quantity === 0) {
      // Remove material if quantity is 0
      newMaterials = currentMaterials.filter(m => m.materialId !== materialId);
    } else if (existingIndex >= 0) {
      // Update existing
      newMaterials = currentMaterials.map((m, i) => 
        i === existingIndex ? { ...m, quantity } : m
      );
    } else {
      // Add new
      newMaterials = [...currentMaterials, { materialId, quantity }];
    }
    
    setEditedRecipe({
      ...editedRecipe,
      materials: newMaterials,
    });
  };

  const getMaterialQuantity = (materialId: string): number => {
    const materials = editedRecipe.materials || selectedRecipe?.materials || [];
    const found = materials.find(m => m.materialId === materialId);
    return found?.quantity || 0;
  };

  const hasOverride = selectedRecipe ? !!getOverride('recipes', selectedRecipe.id) : false;

  if (loading) {
    return <div className="text-muted-foreground p-4">Loading recipes...</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Recipe List */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search recipes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
        </div>

        <ScrollArea className="h-[400px]">
          <div className="space-y-1">
            {filteredRecipes.map((recipe) => {
              const hasOvr = !!getOverride('recipes', recipe.id);
              return (
                <button
                  key={recipe.id}
                  onClick={() => handleSelectRecipe(recipe)}
                  className={`w-full text-left p-2 rounded text-sm hover:bg-muted transition-colors flex justify-between items-center ${
                    selectedRecipe?.id === recipe.id ? 'bg-primary/20' : ''
                  }`}
                >
                  <span>
                    <span className="mr-1">{recipe.icon}</span>
                    <span className="font-medium">{recipe.name}</span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      ({recipe.resultSlot} • {recipe.resultRarity})
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
          {filteredRecipes.length} recipes • {overrides.length} overrides
        </div>
      </Card>

      {/* Recipe Editor */}
      <Card className="p-4">
        {selectedRecipe ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">
                <span className="mr-2">{selectedRecipe.icon}</span>
                {selectedRecipe.name}
              </h3>
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
                  value={(editedRecipe.name as string) || ''}
                  onChange={(e) => setEditedRecipe({ ...editedRecipe, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={(editedRecipe.description as string) || ''}
                  onChange={(e) => setEditedRecipe({ ...editedRecipe, description: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Materials Required</Label>
              <ScrollArea className="h-48 mt-2">
                <div className="space-y-2">
                  {CRAFTING_MATERIALS.map((material) => {
                    const currentQty = getMaterialQuantity(material.id);
                    return (
                      <div key={material.id} className="flex items-center gap-2">
                        <span className="text-lg">{material.icon}</span>
                        <span className="flex-1 text-sm">{material.name}</span>
                        <Input
                          type="number"
                          className="w-20"
                          value={currentQty}
                          onChange={(e) => handleMaterialChange(material.id, parseInt(e.target.value) || 0)}
                          min={0}
                        />
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
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
            Select a recipe to edit
          </div>
        )}
      </Card>
    </div>
  );
}
