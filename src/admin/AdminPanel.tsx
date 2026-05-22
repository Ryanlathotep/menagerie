import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAdminRole } from '@/hooks/useAdminRole';
import { MovesEditor } from './MovesEditor';
import { EquipmentEditor } from './EquipmentEditor';
import { RecipesEditor } from './RecipesEditor';
import { MonstersEditor } from './MonstersEditor';
import { AdminAccessEditor } from './AdminAccessEditor';
import { BugReportsEditor } from './BugReportsEditor';
import { ShapeDesigner } from './ShapeDesigner';
import { Shield, Swords, Package, Ghost, UserCog, Bug, Crosshair } from 'lucide-react';

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
          <TabsTrigger value="bugs" className="gap-2">
            <Bug className="w-4 h-4" />
            Bug Reports
          </TabsTrigger>
          <TabsTrigger value="access" className="gap-2">
            <UserCog className="w-4 h-4" />
            Access
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
          <TabsContent value="bugs" className="p-4 m-0">
            <BugReportsEditor />
          </TabsContent>
          <TabsContent value="access" className="p-4 m-0">
            <AdminAccessEditor />
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </Card>
  );
}
