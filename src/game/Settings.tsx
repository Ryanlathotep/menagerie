// Game Settings Component and Hook

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Settings as SettingsIcon, X } from 'lucide-react';

// Settings interface
export interface GameSettings {
  autoRunDelay: number;      // ms for double-tap detection (100-500)
  autoRunSpeed: number;      // ms between auto-run steps (50-200)
  dungeonZoom: number;       // zoom level for dungeon tiles (50-400, 100 = default)
  showDamageNumbers: boolean;
  soundEnabled: boolean;
}

const DEFAULT_SETTINGS: GameSettings = {
  autoRunDelay: 200,         // Faster default (was 300)
  autoRunSpeed: 100,
  dungeonZoom: 100,          // 100% = default size
  showDamageNumbers: true,
  soundEnabled: true,
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <Card className="w-full max-w-md p-6 m-4 animate-scale-in">
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
              min={50}
              max={200}
              step={10}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Time between steps when auto-running (lower = faster)
            </p>
          </div>
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

// Settings Button (for use in menus)
export function SettingsButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)} className="flex items-center gap-2">
        <SettingsIcon className="w-4 h-4" />
        Settings
      </Button>
      <SettingsPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
