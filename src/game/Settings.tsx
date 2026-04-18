// Game Settings Component and Hook

import { useState, useEffect, createContext, useContext, ReactNode, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Settings as SettingsIcon, X, Download, Upload, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAdminRole } from '@/hooks/useAdminRole';
import { AdminPanel } from '@/admin/AdminPanel';

// Settings interface
export interface GameSettings {
  autoRunDelay: number;      // ms for double-tap detection (100-500)
  autoRunSpeed: number;      // ms between auto-run steps (100-200)
  dungeonZoom: number;       // zoom level for dungeon tiles (50-400, 100 = default)
  showDamageNumbers: boolean;
  soundEnabled: boolean;
  // Overworld direction arrow overlays
  showHomeArrow: boolean;
  showHomeTowerArrow: boolean;
  showMajorDungeonArrows: boolean;
}

const DEFAULT_SETTINGS: GameSettings = {
  autoRunDelay: 200,         // Faster default (was 300)
  autoRunSpeed: 100,
  dungeonZoom: 100,          // 100% = default size
  showDamageNumbers: true,
  soundEnabled: true,
  showHomeArrow: true,
  showHomeTowerArrow: true,
  showMajorDungeonArrows: true,
};

// Settings Context
interface SettingsContextType {
  settings: GameSettings;
  updateSetting: <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('monster-roguelike-settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      } catch (e) {
        console.error('Failed to load settings:', e);
      }
    }
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem('monster-roguelike-settings', JSON.stringify(settings));
  }, [settings]);

  const updateSetting = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

// Settings Panel Component
interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { settings, updateSetting, resetSettings } = useSettings();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportSave = () => {
    try {
      const saveData = localStorage.getItem('monster-roguelike-save');
      const settingsData = localStorage.getItem('monster-roguelike-settings');
      
      const backup = {
        version: 1,
        exportedAt: new Date().toISOString(),
        saveData: saveData ? JSON.parse(saveData) : null,
        settings: settingsData ? JSON.parse(settingsData) : null,
      };
      
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `monster-roguelike-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({ title: 'Backup exported!', description: 'Save file downloaded to your device.' });
    } catch (e) {
      toast({ title: 'Export failed', description: 'Could not export save data.', variant: 'destructive' });
    }
  };

  const handleImportSave = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const backup = JSON.parse(event.target?.result as string);
        
        if (!backup.version || !backup.saveData) {
          throw new Error('Invalid backup file');
        }
        
        localStorage.setItem('monster-roguelike-save', JSON.stringify(backup.saveData));
        if (backup.settings) {
          localStorage.setItem('monster-roguelike-settings', JSON.stringify(backup.settings));
        }
        
        toast({ title: 'Backup restored!', description: 'Refresh the page to load your save.' });
      } catch (e) {
        toast({ title: 'Import failed', description: 'Invalid or corrupted backup file.', variant: 'destructive' });
      }
    };
    reader.readAsText(file);
    
    // Reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <Card className="w-full max-w-md p-6 m-4 animate-scale-in max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <SettingsIcon className="w-5 h-5" />
            Settings
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-6">
          {/* Dungeon Zoom */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Dungeon Zoom</Label>
              <span className="text-sm text-muted-foreground">{settings.dungeonZoom}%</span>
            </div>
            <Slider
              value={[settings.dungeonZoom]}
              onValueChange={([value]) => updateSetting('dungeonZoom', value)}
              min={50}
              max={400}
              step={25}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Adjust tile size in the dungeon view
            </p>
          </div>

          {/* Auto-Run Double-Tap Delay */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Double-Tap Delay</Label>
              <span className="text-sm text-muted-foreground">{settings.autoRunDelay}ms</span>
            </div>
            <Slider
              value={[settings.autoRunDelay]}
              onValueChange={([value]) => updateSetting('autoRunDelay', value)}
              min={100}
              max={500}
              step={25}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Time window to detect double-tap for auto-run (lower = faster)
            </p>
          </div>

          {/* Auto-Run Speed */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Auto-Run Speed</Label>
              <span className="text-sm text-muted-foreground">{settings.autoRunSpeed}ms</span>
            </div>
            <Slider
              value={[settings.autoRunSpeed]}
              onValueChange={([value]) => updateSetting('autoRunSpeed', value)}
              min={100}
              max={200}
              step={10}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Time between steps when auto-running (lower = faster)
            </p>
          </div>

          {/* Backup/Restore Section */}
          <div className="space-y-3 pt-4 border-t">
            <Label className="text-base">Save Data</Label>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExportSave} className="flex-1">
                <Download className="w-4 h-4 mr-1" />
                Export Backup
              </Button>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="flex-1">
                <Upload className="w-4 h-4 mr-1" />
                Import Backup
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportSave}
                className="hidden"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Export your save to a file or restore from a backup. Refresh after importing.
            </p>
          </div>

          {/* Admin Panel Access */}
          <AdminPanelTrigger onOpenAdmin={() => {
            onClose();
            // Small delay to let settings close first, then open admin
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('open-admin-panel'));
            }, 50);
          }} />
        </div>

        <div className="flex gap-2 mt-6">
          <Button variant="outline" onClick={resetSettings} className="flex-1">
            Reset to Defaults
          </Button>
          <Button onClick={onClose} className="flex-1">
            Done
          </Button>
        </div>
      </Card>
    </div>
  );
}

// Admin Panel Trigger Button - only visible to admins (just the button, no dialog)
function AdminPanelTrigger({ onOpenAdmin }: { onOpenAdmin: () => void }) {
  const { isAdmin, loading } = useAdminRole();

  if (loading || !isAdmin) return null;

  return (
    <div className="space-y-3 pt-4 border-t">
      <Label className="text-base flex items-center gap-2">
        <Shield className="w-4 h-4 text-primary" />
        Admin Tools
      </Label>
      <Button variant="outline" className="w-full gap-2" onClick={onOpenAdmin}>
        <Shield className="w-4 h-4" />
        Open Admin Panel
      </Button>
      <p className="text-xs text-muted-foreground">
        Edit game data, sprites, and configurations
      </p>
    </div>
  );
}

// Standalone Admin Panel Dialog - lives outside settings
function AdminPanelDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl h-[90vh] p-0 overflow-hidden">
        <AdminPanel />
      </DialogContent>
    </Dialog>
  );
}

// Settings Button (for use in menus)
export function SettingsButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  // Listen for admin panel open event
  useEffect(() => {
    const handleOpenAdmin = () => setAdminOpen(true);
    window.addEventListener('open-admin-panel', handleOpenAdmin);
    return () => window.removeEventListener('open-admin-panel', handleOpenAdmin);
  }, []);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)} className="flex items-center gap-2">
        <SettingsIcon className="w-4 h-4" />
        Settings
      </Button>
      <SettingsPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />
      <AdminPanelDialog isOpen={adminOpen} onClose={() => setAdminOpen(false)} />
    </>
  );
}
