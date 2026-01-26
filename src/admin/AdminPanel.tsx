import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAdminRole } from '@/hooks/useAdminRole';
import { MovesEditor } from './MovesEditor';
import { EquipmentEditor } from './EquipmentEditor';
import { RecipesEditor } from './RecipesEditor';
import { MonstersEditor } from './MonstersEditor';
import { VisualEditor } from './visualEditor';
import { Shield, Swords, Package, Ghost, Palette } from 'lucide-react';

export function AdminPanel() {
  const { isAdmin, loading } = useAdminRole();
  const [activeTab, setActiveTab] = useState('moves');

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Checking permissions...</div>
        </div>
      </Card>
    );
  }

  if (!isAdmin) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          You don't have permission to access this area.
        </div>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <div className="p-4 border-b bg-gradient-to-r from-primary/10 to-secondary/10">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          Admin Panel
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Edit game data - changes are saved to the database and override defaults
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="w-full justify-start p-2 bg-muted/50 rounded-none">
          <TabsTrigger value="moves" className="gap-2">
            <Swords className="w-4 h-4" />
            Moves
          </TabsTrigger>
          <TabsTrigger value="equipment" className="gap-2">
            <Shield className="w-4 h-4" />
            Equipment
          </TabsTrigger>
          <TabsTrigger value="recipes" className="gap-2">
            <Package className="w-4 h-4" />
            Recipes
          </TabsTrigger>
          <TabsTrigger value="monsters" className="gap-2">
            <Ghost className="w-4 h-4" />
            Monsters
          </TabsTrigger>
          <TabsTrigger value="sprites" className="gap-2">
            <Palette className="w-4 h-4" />
            Sprites
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          <TabsContent value="moves" className="p-4 m-0">
            <MovesEditor />
          </TabsContent>
          <TabsContent value="equipment" className="p-4 m-0">
            <EquipmentEditor />
          </TabsContent>
          <TabsContent value="recipes" className="p-4 m-0">
            <RecipesEditor />
          </TabsContent>
          <TabsContent value="monsters" className="p-4 m-0">
            <MonstersEditor />
          </TabsContent>
          <TabsContent value="sprites" className="p-4 m-0">
            <div className="space-y-4">
              <div className="bg-yellow-100 dark:bg-yellow-900/20 p-4 rounded-lg border-2 border-yellow-500 space-y-3">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  ⚠️ Important: Sprite Quality Workflow
                </h3>
                <div className="space-y-2 text-sm">
                  <p><strong>Why imported sprites look pixelated:</strong></p>
                  <p>Clean SVG → Rasterize to pixels → Edit → Convert back to SVG = <strong>Quality Loss</strong></p>
                  
                  <hr className="my-2" />
                  
                  <p><strong>For BEST quality (like existing sprites):</strong></p>
                  <ul className="list-disc ml-6 space-y-1">
                    <li>Use the <strong>Direct SVG Editor</strong> below</li>
                    <li>Hand-craft bezier curves</li>
                    <li>Copy existing sprite code as a starting point</li>
                    <li>No pixel conversion = No quality loss</li>
                  </ul>
                  
                  <p className="mt-2"><strong>Pixel Editor is for:</strong></p>
                  <ul className="list-disc ml-6 space-y-1">
                    <li>Creating <strong>NEW</strong> sprites from scratch</li>
                    <li>NOT for editing existing hand-crafted sprites</li>
                  </ul>
                </div>
              </div>
              
              <VisualEditor />
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </Card>
  );
}
