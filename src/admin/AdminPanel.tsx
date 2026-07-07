import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

function SwitchAccountButton() {
  const { signOut, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  if (!isAuthenticated) return null;
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => { await signOut(); navigate('/auth'); }}
      title={user?.email ? `Signed in as ${user.email} — click to switch` : 'Switch account'}
    >
      🔁 Switch Account
    </Button>
  );
}
import { CraftGridEditor } from './CraftGridEditor';
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
import { FeatureRequestsEditor } from './FeatureRequestsEditor';
import { ShapeDesigner } from './ShapeDesigner';
import { EquipmentIconEditor } from './EquipmentIconEditor';
import { AssetLibrary } from './AssetLibrary';
import { ParticlesEditor } from './ParticlesEditor';
import { WorldGenEditor } from './WorldGenEditor';
import { TileAssetManager } from './TileAssetManager';
import { TilePatternPainter } from './TilePatternPainter';
import { Shield, Swords, Package, Ghost, UserCog, Bug, Crosshair, Image as ImageIcon, Palette, Sparkles, Globe2, Lightbulb, Grid3x3 } from 'lucide-react';


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
      <div className="p-4 border-b bg-gradient-to-r from-primary/10 to-secondary/10 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Admin Panel
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Edit game data - changes are saved to the database and override defaults
          </p>
        </div>
        <SwitchAccountButton />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="w-full overflow-x-auto overflow-y-hidden bg-muted/50">
          <TabsList className="inline-flex w-max min-w-full justify-start p-2 rounded-none bg-transparent">
            <TabsTrigger value="moves" className="gap-2 shrink-0">
              <Swords className="w-4 h-4" />
              Moves
            </TabsTrigger>
            <TabsTrigger value="shapes" className="gap-2 shrink-0">
              <Crosshair className="w-4 h-4" />
              Shapes
            </TabsTrigger>
            <TabsTrigger value="equipment" className="gap-2 shrink-0">
              <Shield className="w-4 h-4" />
              Equipment
            </TabsTrigger>
            <TabsTrigger value="icons" className="gap-2 shrink-0">
              <ImageIcon className="w-4 h-4" />
              Icons
            </TabsTrigger>
            <TabsTrigger value="recipes" className="gap-2 shrink-0">
              <Package className="w-4 h-4" />
              Recipes
            </TabsTrigger>
            <TabsTrigger value="monsters" className="gap-2 shrink-0">
              <Ghost className="w-4 h-4" />
              Monsters
            </TabsTrigger>
            <TabsTrigger value="assets" className="gap-2 shrink-0">
              <Palette className="w-4 h-4" />
              Assets
            </TabsTrigger>
            <TabsTrigger value="particles" className="gap-2 shrink-0">
              <Sparkles className="w-4 h-4" />
              Particles
            </TabsTrigger>
            <TabsTrigger value="tiles" className="gap-2 shrink-0">
              <Grid3x3 className="w-4 h-4" />
              Tiles
            </TabsTrigger>
            <TabsTrigger value="worldgen" className="gap-2 shrink-0">
              <Globe2 className="w-4 h-4" />
              World Gen
            </TabsTrigger>

            <TabsTrigger value="bugs" className="gap-2 shrink-0">
              <Bug className="w-4 h-4" />
              Bug Reports
            </TabsTrigger>
            <TabsTrigger value="features" className="gap-2 shrink-0">
              <Lightbulb className="w-4 h-4" />
              Features
            </TabsTrigger>
            <TabsTrigger value="access" className="gap-2 shrink-0">
              <UserCog className="w-4 h-4" />
              Access
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          <TabsContent value="moves" className="p-4 m-0">
            <MovesEditor />
          </TabsContent>
          <TabsContent value="shapes" className="p-4 m-0">
            <ShapeDesigner />
          </TabsContent>
          <TabsContent value="equipment" className="p-4 m-0">
            <EquipmentEditor />
          </TabsContent>
          <TabsContent value="icons" className="p-4 m-0">
            <EquipmentIconEditor />
          </TabsContent>
          <TabsContent value="recipes" className="p-4 m-0">
            <RecipesEditor />
          </TabsContent>
          <TabsContent value="monsters" className="p-4 m-0">
            <MonstersEditor />
          </TabsContent>
          <TabsContent value="assets" className="p-4 m-0">
            <AssetLibrary />
          </TabsContent>
          <TabsContent value="particles" className="p-4 m-0">
            <ParticlesEditor />
          </TabsContent>
          <TabsContent value="tiles" className="p-4 m-0">
            <Tabs defaultValue="library">
              <TabsList>
                <TabsTrigger value="library">Asset Manager</TabsTrigger>
                <TabsTrigger value="patterns">Tile Patterns (Painter)</TabsTrigger>
              </TabsList>
              <TabsContent value="library" className="mt-4">
                <TileAssetManager />
              </TabsContent>
              <TabsContent value="patterns" className="mt-4">
                <TilePatternPainter />
              </TabsContent>
            </Tabs>
          </TabsContent>
          <TabsContent value="worldgen" className="p-4 m-0">
            <WorldGenEditor />
          </TabsContent>

          <TabsContent value="bugs" className="p-4 m-0">
            <BugReportsEditor />
          </TabsContent>
          <TabsContent value="features" className="p-4 m-0">
            <FeatureRequestsEditor />
          </TabsContent>
          <TabsContent value="access" className="p-4 m-0">
            <AdminAccessEditor />
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </Card>
  );
}
