// Game Settings Component and Hook

import { useState, useEffect, createContext, useContext, ReactNode, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Settings as SettingsIcon, X, Download, Upload, Shield, Globe2, Dices, Home, Bug, Flag, Lightbulb } from 'lucide-react';
import { WaypointManager } from './WaypointManager';

import { ReportBugDialog } from './ReportBugDialog';
import { FeatureRequestDialog } from './FeatureRequestDialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAdminRole } from '@/hooks/useAdminRole';
import { AdminPanel } from '@/admin/AdminPanel';
import { useGame, buildProgressSnapshot } from './state';
import { useCloudSave } from '@/hooks/useCloudSave';
import { toast as sonnerToast } from 'sonner';
import { UsernameEditor } from './UsernameEditor';
import { DiscoveryLeaderboard } from './DiscoveryLeaderboard';
import { ExplorationLeaderboard } from './ExplorationLeaderboard';
import type { LevelDisplayMode } from './levelDisplay';

// Settings interface
export type ThemeMode = 'system' | 'light' | 'dark';

export interface GameSettings {
  autoRunDelay: number;      // ms for double-tap detection (100-500)
  autoRunSpeed: number;      // ms between auto-run steps (100-200)
  dungeonZoom: number;       // zoom level for dungeon tiles (50-400, 100 = default)
  showDamageNumbers: boolean;
  soundEnabled: boolean;
  theme: ThemeMode;          // light / dark / follow browser
  levelDisplayMode: LevelDisplayMode;
  // Overworld direction arrow overlays
  showHomeArrow: boolean;
  showHomeTowerArrow: boolean;
  showMajorDungeonArrows: boolean;
  // Per-dungeon waypoint pins (id → enabled). Used for procedural / minor
  // dungeons that don't have a global toggle. Right-click a dungeon to pin.
  dungeonWaypoints: Record<string, boolean>;
  // Optional player-supplied names for overworld dungeon waypoints (id → name)
  dungeonWaypointNames: Record<string, string>;

  // Auto-equip preferences (used by Equipment screens and pickup auto-equip)
  autoEquipFocus: import('./equipmentUtils').AutoEquipFocus;
  autoEquipOnPickup: boolean;

  // Keep mining an adjacent rock until it's exhausted or a visible enemy
  // appears. Mirrors the auto-run "halt on enemy spotted" behaviour.
  autoMine: boolean;

  /** Opt-in: when true, defeats inside an Item World tower wipe the run's
   *  gold/materials/items/equipment (the "greed risk" from the design bible).
   *  Default OFF for beta so testers aren't punished for experimenting. */
  itemWorldTowerGreedRisk: boolean;
}

const DEFAULT_SETTINGS: GameSettings = {
  autoRunDelay: 200,         // Faster default (was 300)
  autoRunSpeed: 100,
  dungeonZoom: 100,          // 100% = default size
  showDamageNumbers: true,
  soundEnabled: true,
  theme: 'system',
  levelDisplayMode: 'letters',
  showHomeArrow: true,
  showHomeTowerArrow: true,
  showMajorDungeonArrows: true,
  dungeonWaypoints: {},
  dungeonWaypointNames: {},

  autoEquipFocus: 'class',
  autoEquipOnPickup: false,

  autoMine: false,

  itemWorldTowerGreedRisk: false,
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

  useEffect(() => {
    const onImportSettings = (event: Event) => {
      const detail = (event as CustomEvent<Partial<GameSettings> | null>).detail;
      if (!detail) return;
      setSettings({ ...DEFAULT_SETTINGS, ...detail });
    };
    window.addEventListener('menagerie-import-settings', onImportSettings);
    return () => window.removeEventListener('menagerie-import-settings', onImportSettings);
  }, []);

  // Apply theme to <html> — light/dark/system (follows browser preference)
  useEffect(() => {
    const root = document.documentElement;
    const apply = (mode: ThemeMode) => {
      const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
      const isDark = mode === 'dark' || (mode === 'system' && prefersDark);
      root.classList.toggle('dark', isDark);
    };
    apply(settings.theme);
    if (settings.theme === 'system' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => apply('system');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [settings.theme]);

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
    // Fallback: don't crash the tree if a hot-reloaded module instance loses
    // its provider link. Reads from localStorage so values still reflect the
    // user's saved prefs; writes are best-effort (no live re-render).
    if (typeof console !== 'undefined') {
      console.warn('[useSettings] No SettingsProvider in tree — using fallback.');
    }
    let saved: GameSettings = DEFAULT_SETTINGS;
    try {
      const raw = typeof localStorage !== 'undefined'
        ? localStorage.getItem('monster-roguelike-settings')
        : null;
      if (raw) saved = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return {
      settings: saved,
      updateSetting: <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
        try {
          const next = { ...saved, [key]: value };
          localStorage.setItem('monster-roguelike-settings', JSON.stringify(next));
        } catch { /* ignore */ }
      },
      resetSettings: () => {
        try { localStorage.removeItem('monster-roguelike-settings'); } catch { /* ignore */ }
      },
    } as SettingsContextType;
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
  const { state, dispatch } = useGame();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [bugOpen, setBugOpen] = useState(false);
  const [featureOpen, setFeatureOpen] = useState(false);
  const [waypointMgrOpen, setWaypointMgrOpen] = useState(false);


  // Listen for admin panel open event (dispatched from the Admin Tools button)
  useEffect(() => {
    const handleOpenAdmin = () => setAdminOpen(true);
    window.addEventListener('open-admin-panel', handleOpenAdmin);
    return () => window.removeEventListener('open-admin-panel', handleOpenAdmin);
  }, []);

  const handleExportSave = () => {
    try {
      const liveSave = buildProgressSnapshot(state.saveData, state.run, state.saveData.overworldState);
      
      const backup = {
        version: 1,
        exportedAt: new Date().toISOString(),
        saveData: liveSave,
        settings,
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

  const handleShareBackup = async () => {
    try {
      const liveSave = buildProgressSnapshot(state.saveData, state.run, state.saveData.overworldState);
      const backup = {
        version: 1,
        exportedAt: new Date().toISOString(),
        saveData: liveSave,
        settings,
      };

      const file = new File(
        [JSON.stringify(backup, null, 2)],
        `monster-roguelike-backup-${new Date().toISOString().split('T')[0]}.json`,
        { type: 'application/json' },
      );

      if (typeof navigator === 'undefined' || !('share' in navigator)) {
        throw new Error('Sharing not supported');
      }

      await (navigator as Navigator & { share: (data: ShareData) => Promise<void> }).share({
        title: 'Menagerie Backup',
        text: 'Game backup',
        files: [file],
      });

      toast({ title: 'Backup ready to send!', description: 'You can save it to Google Drive from the share menu.' });
    } catch (e) {
      toast({ title: 'Share unavailable', description: 'Use Export Backup if your device does not support file sharing.', variant: 'destructive' });
    }
  };

  const handleImportSave = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onerror = () => {
      console.error('[Import] FileReader error', reader.error);
      toast({ title: 'Import failed', description: `Could not read file: ${reader.error?.message ?? 'unknown error'}`, variant: 'destructive' });
    };
    reader.onload = (event) => {
      const raw = event.target?.result;
      if (typeof raw !== 'string' || raw.length === 0) {
        console.error('[Import] Empty file contents');
        toast({ title: 'Import failed', description: 'Backup file was empty.', variant: 'destructive' });
        return;
      }

      // Parse JSON
      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        console.error('[Import] JSON.parse failed', err, raw.slice(0, 200));
        toast({ title: 'Import failed', description: 'File is not valid JSON.', variant: 'destructive' });
        return;
      }

      // Accept both wrapped backups ({ version, saveData, settings }) and
      // bare SaveData exports (older builds / manual copies).
      const backup = parsed && typeof parsed === 'object' && parsed.saveData
        ? parsed
        : { version: 1, saveData: parsed, settings: undefined };

      if (!backup.saveData || typeof backup.saveData !== 'object') {
        console.error('[Import] Missing saveData field', Object.keys(parsed ?? {}));
        toast({ title: 'Import failed', description: 'Backup is missing save data.', variant: 'destructive' });
        return;
      }

      try {
        localStorage.setItem('monster-roguelike-save', JSON.stringify(backup.saveData));
        dispatch({ type: 'LOAD_SAVE', saveData: backup.saveData });
        if (backup.settings) {
          localStorage.setItem('monster-roguelike-settings', JSON.stringify(backup.settings));
          window.dispatchEvent(new CustomEvent('menagerie-import-settings', { detail: backup.settings }));
        }
        toast({ title: 'Backup restored!', description: 'Save and settings were restored immediately.' });
      } catch (err) {
        console.error('[Import] Applying backup failed', err);
        toast({ title: 'Import failed', description: err instanceof Error ? err.message : 'Could not apply backup.', variant: 'destructive' });
      }
    };
    reader.readAsText(file);

    // Reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!isOpen) return null;

  return (
    <>
    <div className={`fixed inset-0 bg-black/50 flex items-center justify-center z-[100] ${adminOpen ? 'hidden' : ''}`}>

      <Card className="w-full max-w-md p-6 m-4 animate-scale-in max-h-[calc(100dvh-1.5rem)] overflow-y-auto">
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

          {/* Theme */}
          <div className="space-y-2 pt-4 border-t">
            <Label className="text-base">Theme</Label>
            <div className="grid grid-cols-3 gap-2">
              {(['system', 'light', 'dark'] as const).map((mode) => (
                <Button
                  key={mode}
                  variant={settings.theme === mode ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateSetting('theme', mode)}
                  className="capitalize"
                >
                  {mode === 'system' ? 'Browser' : mode}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              "Browser" follows your OS / browser preference.
            </p>
          </div>

          {/* Level Display */}
          <div className="space-y-2 pt-4 border-t">
            <Label htmlFor="level-display-mode" className="text-base">Level Display</Label>
            <select
              id="level-display-mode"
              value={settings.levelDisplayMode}
              onChange={(e) => updateSetting('levelDisplayMode', e.target.value as LevelDisplayMode)}
              className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="letters">Letters — Lv 1.99 aa</option>
              <option value="exponent">Exponent — Lv 1.99^6</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Compact notation is used automatically for very high monster levels.
            </p>
          </div>

          {/* Overworld Direction Arrows */}
          <div className="space-y-3 pt-4 border-t">
            <Label className="text-base">Overworld Arrows</Label>
            <p className="text-xs text-muted-foreground -mt-1">
              Edge-of-screen arrows pointing toward off-screen landmarks.
            </p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">🏠</span>
                <Label htmlFor="arrow-home" className="cursor-pointer">Starting Town / Home</Label>
              </div>
              <Switch
                id="arrow-home"
                checked={settings.showHomeArrow}
                onCheckedChange={(v) => updateSetting('showHomeArrow', v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">🗼</span>
                <Label htmlFor="arrow-home-tower" className="cursor-pointer">Tower of the Infinite</Label>
              </div>
              <Switch
                id="arrow-home-tower"
                checked={settings.showHomeTowerArrow}
                onCheckedChange={(v) => updateSetting('showHomeTowerArrow', v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">🏰</span>
                <Label htmlFor="arrow-majors" className="cursor-pointer">Major Dungeon Towers</Label>
              </div>
              <Switch
                id="arrow-majors"
                checked={settings.showMajorDungeonArrows}
                onCheckedChange={(v) => updateSetting('showMajorDungeonArrows', v)}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2"
              onClick={() => setWaypointMgrOpen(true)}
            >
              <Flag className="w-4 h-4 mr-2" /> Manage Waypoints
            </Button>
            <p className="text-xs text-muted-foreground -mt-1">
              Rename or remove individual dungeon-floor and overworld waypoints.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                resetDockPosition();
                toast({ title: 'Dock position reset', description: 'The floating dock is back at its default spot.' });
              }}
            >
              ⋮⋮ Reset Dock Position
            </Button>
            <p className="text-xs text-muted-foreground -mt-1">
              Moves the floating button dock back to the right edge if you've dragged it off-screen.
            </p>
          </div>



          {/* Auto-Equip Preferences */}
          <div className="space-y-3 pt-4 border-t">
            <Label className="text-base">Auto-Equip</Label>
            <p className="text-xs text-muted-foreground -mt-1">
              Pick how the <strong>Auto-Equip</strong> button optimises gear, and
              whether new pickups should auto-equip themselves to your active
              monster when they're an upgrade.
            </p>
            <div className="space-y-1">
              <Label htmlFor="auto-equip-focus" className="text-sm">Focus</Label>
              <select
                id="auto-equip-focus"
                value={settings.autoEquipFocus}
                onChange={(e) => updateSetting('autoEquipFocus', e.target.value as GameSettings['autoEquipFocus'])}
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="class">Class Optimal (default)</option>
                <option value="tank">Tank — defense / HP</option>
                <option value="dps">DPS — attack / special</option>
                <option value="aoe">AoE — special / stamina</option>
                <option value="speed">Speed — speed / dodge</option>
                <option value="support">Support — stamina / utility</option>
                <option value="set">Build Sets — favor set pieces</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <Label htmlFor="auto-equip-pickup" className="cursor-pointer">Auto-equip on pickup</Label>
                <span className="text-xs text-muted-foreground">
                  Equip new items to your active monster if they beat the current piece under the focus above.
                </span>
              </div>
              <Switch
                id="auto-equip-pickup"
                checked={settings.autoEquipOnPickup}
                onCheckedChange={(v) => updateSetting('autoEquipOnPickup', v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <Label htmlFor="auto-mine" className="cursor-pointer">Auto-Harvest</Label>
                <span className="text-xs text-muted-foreground">
                  Keep harvesting an adjacent resource (rock, tree, metal, etc.) until depleted or a visible enemy appears. Also makes a regular tap on a harvestable auto-harvest it.
                </span>
              </div>
              <Switch
                id="auto-mine"
                checked={settings.autoMine}
                onCheckedChange={(v) => updateSetting('autoMine', v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <Label htmlFor="iw-greed-risk" className="cursor-pointer">Item World greed risk</Label>
                <span className="text-xs text-muted-foreground">
                  When ON, getting wiped inside an Item World tower (Prototyping / Training / Skill Forge) costs you everything you found that run. OFF during beta — losses are forgiven like other towers.
                </span>
              </div>
              <Switch
                id="iw-greed-risk"
                checked={settings.itemWorldTowerGreedRisk}
                onCheckedChange={(v) => updateSetting('itemWorldTowerGreedRisk', v)}
              />
            </div>
          </div>


          {/* Public Username (for tower leaderboards) */}
          <UsernameEditor />


          {/* Global discovery leaderboard (top 10 by unique monsters unlocked) */}
          <DiscoveryLeaderboard limit={10} />

          {/* Global exploration leaderboard (top 10 by overworld tiles explored) */}
          <ExplorationLeaderboard limit={10} />

          {/* Overworld Rebuild Section */}
          <RebuildOverworldSection />

          {/* Cloud save history — restore any of the last 5 snapshots */}
          <CloudSaveHistorySection onClose={onClose} />

          {/* Return to Main Menu — only shown when a run is active. Suspends
              the run (no progress lost) and switches to the main menu. */}
          <ReturnToMainMenuSection onClose={onClose} />



          <div className="space-y-3 pt-4 border-t">
            <Label className="text-base">Save Data</Label>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={handleExportSave} className="flex-1">
                <Download className="w-4 h-4 mr-1" />
                Export Backup
              </Button>
              <Button variant="outline" size="sm" onClick={handleShareBackup} className="flex-1">
                <Download className="w-4 h-4 mr-1" />
                Share Backup
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
              Export to a local file, share to apps like Google Drive on supported devices, or restore from a backup.
            </p>
          </div>

          {/* Report a Bug */}
          <div className="pt-2 border-t space-y-2">
            <Button variant="outline" className="w-full" onClick={() => setBugOpen(true)}>
              <Bug className="w-4 h-4 mr-2" /> Report a Bug
            </Button>
            <Button variant="outline" className="w-full" onClick={() => setFeatureOpen(true)}>
              <Lightbulb className="w-4 h-4 mr-2" /> Suggest a Feature
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Send a bug report or feature idea to the dev team. Sign-in required.
            </p>
          </div>

          {/* Admin Panel Access — open the dialog directly (don't close settings first,
              or the listener unmounts before the event fires). */}
          <AdminPanelTrigger onOpenAdmin={() => setAdminOpen(true)} />

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
      <ReportBugDialog isOpen={bugOpen} onClose={() => setBugOpen(false)} />
      <FeatureRequestDialog isOpen={featureOpen} onClose={() => setFeatureOpen(false)} />
    </div>
    <AdminPanelDialog isOpen={adminOpen} onClose={() => setAdminOpen(false)} />
    <WaypointManager isOpen={waypointMgrOpen} onClose={() => setWaypointMgrOpen(false)} />
    </>

  );
}


// ─── Rebuild Overworld ───
// Lets the player wipe the procedural map (terrain, biomes, dungeons, nests,
// roads, placed buildings, fog-of-war) and regenerate it under a new seed,
// while keeping their monsters, items, gold, recipes, and equipment intact.
// A blank seed rolls a random one. Same seed = same world (shareable).
interface PopularSeed {
  world_seed: number;
  explorers: number;
  best_tiles: number;
}

function RebuildOverworldSection() {
  const { toast } = useToast();
  const { state, dispatch } = useGame();
  const [seedInput, setSeedInput] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [popular, setPopular] = useState<PopularSeed[] | null>(null);
  const [loadingPopular, setLoadingPopular] = useState(false);

  // Read the live seed from in-memory game state so it stays accurate after
  // rebuilding without needing a refresh.
  const currentSeed = state.saveData?.overworldState?.worldSeed ?? 0;

  // Pull top exploration entries and aggregate by world_seed to find the
  // most-explored shared worlds players are jumping into.
  useEffect(() => {
    let cancelled = false;
    setLoadingPopular(true);
    supabase
      .rpc('get_exploration_leaderboard', { _limit: 100 })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setPopular([]);
          setLoadingPopular(false);
          return;
        }
        const agg = new Map<number, PopularSeed>();
        for (const row of data as Array<{ world_seed: number | null; tiles_explored: number }>) {
          if (row.world_seed == null || row.world_seed === 0) continue;
          const existing = agg.get(row.world_seed);
          if (existing) {
            existing.explorers += 1;
            existing.best_tiles = Math.max(existing.best_tiles, row.tiles_explored);
          } else {
            agg.set(row.world_seed, {
              world_seed: row.world_seed,
              explorers: 1,
              best_tiles: row.tiles_explored,
            });
          }
        }
        const sorted = Array.from(agg.values())
          .sort((a, b) => b.explorers - a.explorers || b.best_tiles - a.best_tiles)
          .slice(0, 5);
        setPopular(sorted);
        setLoadingPopular(false);
      });
    return () => { cancelled = true; };
  }, []);

  const doRebuild = (overrideSeedNumber?: number) => {
    import('./overworld').then(({ hashSeedString, randomWorldSeed, regenerateOverworld }) => {
      let seed: number;
      let label: string;
      if (overrideSeedNumber != null) {
        seed = overrideSeedNumber >>> 0;
        label = String(seed);
      } else {
        const trimmed = seedInput.trim();
        if (trimmed) {
          // Allow either pure numeric seed or a string label
          const asNum = Number(trimmed);
          seed = Number.isFinite(asNum) && /^\d+$/.test(trimmed) ? (asNum >>> 0) : hashSeedString(trimmed);
          label = trimmed;
        } else {
          seed = randomWorldSeed();
          label = `random (${seed})`;
        }
      }
      const fresh = regenerateOverworld(seed);
      dispatch({ type: 'UPDATE_OVERWORLD', overworld: fresh });
      window.dispatchEvent(new CustomEvent('menagerie-rebuild-overworld', {
        detail: { seed, label, overworld: fresh },
      }));
      toast({
        title: '🌍 Overworld rebuilt',
        description: `New seed: ${label}`,
      });
      setConfirming(false);
      setSeedInput('');
    });
  };

  return (
    <div className="space-y-3 pt-4 border-t">
      <Label className="text-base flex items-center gap-2">
        <Globe2 className="w-4 h-4 text-primary" />
        Overworld
      </Label>
      <p className="text-xs text-muted-foreground -mt-1">
        Rebuild the world map under a new seed. Keeps your monsters, gold,
        materials, equipment, and recipes — wipes terrain, dungeons, nests,
        roads, and placed buildings.
      </p>

      <div className="space-y-2">
        <Label htmlFor="world-seed-input" className="text-xs">Seed (optional)</Label>
        <div className="flex gap-2">
          <Input
            id="world-seed-input"
            value={seedInput}
            onChange={(e) => setSeedInput(e.target.value)}
            placeholder="Leave blank for random"
            className="flex-1 h-9 text-sm"
            maxLength={64}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSeedInput(`world-${Math.floor(Math.random() * 99999)}`)}
            title="Roll a random seed name"
          >
            <Dices className="w-4 h-4" />
          </Button>
        </div>
        {currentSeed !== 0 && (
          <p className="text-[11px] text-muted-foreground">
            Current world seed: <span className="font-mono text-foreground">{currentSeed}</span>
          </p>
        )}
      </div>

      {/* Popular shared seeds aggregated from exploration leaderboard */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Popular shared worlds</Label>
        {loadingPopular && (
          <p className="text-[11px] text-muted-foreground italic">Loading…</p>
        )}
        {!loadingPopular && popular && popular.length === 0 && (
          <p className="text-[11px] text-muted-foreground italic">No shared worlds yet.</p>
        )}
        {!loadingPopular && popular && popular.length > 0 && (
          <ul className="space-y-1">
            {popular.map(p => (
              <li key={p.world_seed} className="flex items-center justify-between gap-2 text-xs rounded border bg-background/40 px-2 py-1">
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="font-mono truncate">🌱{p.world_seed}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {p.explorers} explorer{p.explorers === 1 ? '' : 's'} · best {p.best_tiles.toLocaleString()}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-[11px]"
                  onClick={() => setSeedInput(String(p.world_seed))}
                  title="Load this seed into the input"
                >
                  Use
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!confirming ? (

        <Button
          variant="destructive"
          size="sm"
          className="w-full"
          onClick={() => setConfirming(true)}
        >
          🌍 Rebuild Overworld
        </Button>
      ) : (
        <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/10 p-2">
          <p className="text-xs">
            This wipes terrain, dungeons, nests, roads, and placed buildings.
            Your monsters, gold, materials, equipment, and recipes are kept.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" className="flex-1" onClick={() => doRebuild()}>
              Confirm Rebuild
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Admin Panel Trigger Button - only visible to admins (just the button, no dialog)
function AdminPanelTrigger({ onOpenAdmin }: { onOpenAdmin: () => void }) {
  const { isAdmin, loading } = useAdminRole();
  const { state, dispatch } = useGame();
  const [creative, setCreative] = useState(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem('menagerie_creative_mode') === '1';
  });
  const [compass, setCompass] = useState(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem('menagerie_admin_compass') === '1';
  });

  if (loading || !isAdmin) return null;

  const refillResources = () => {
    // Bump gold + every crafting material to 999 so creative-mode builds/crafts
    // never hit an empty stockpile. Wood/stone live in overworldState — patch
    // that persisted blob directly since there's no dedicated reducer action.
    const goldMissing = Math.max(0, 999999 - (state.saveData.gold || 0));
    if (goldMissing > 0) dispatch({ type: 'ADD_GOLD', amount: goldMissing });
    void Promise.all([
      import('./equipment').then(({ CRAFTING_MATERIALS }) => {
        const have = state.saveData.materials || {};
        for (const m of CRAFTING_MATERIALS) {
          const need = Math.max(0, 999 - (have[m.id] || 0));
          if (need > 0) dispatch({ type: 'ADD_MATERIAL', materialId: m.id, quantity: need });
        }
      }),
    ]);
    const ow = state.saveData.overworldState;
    if (ow) {
      dispatch({ type: 'UPDATE_OVERWORLD', overworld: {
        ...ow,
        woodCollected: Math.max(ow.woodCollected || 0, 9999),
        stoneCollected: Math.max(ow.stoneCollected || 0, 9999),
      } });
    }

    sonnerToast.success('🛠️ Refilled: 999,999 gold · 9,999 wood/stone · 999 of every material');
  };

  const toggleCreative = (next: boolean) => {
    setCreative(next);
    import('./creativeMode').then(({ setCreativeMode }) => setCreativeMode(next));
    if (next) refillResources();
  };

  const toggleCompass = (next: boolean) => {
    setCompass(next);
    import('./adminCompass').then(({ setAdminCompass }) => setAdminCompass(next));
  };

  return (
    <div className="space-y-3 pt-4 border-t">
      <Label className="text-base flex items-center gap-2">
        <Shield className="w-4 h-4 text-primary" />
        Admin Tools
      </Label>

      <div className="flex items-center justify-between rounded-md border border-border p-3">
        <div className="flex-1">
          <Label className="text-sm font-semibold">🛠️ Creative Mode</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Skips resource & material costs and refills your stockpile to 999+ of everything on toggle. Resets when the tab closes.
          </p>
        </div>
        <Switch checked={creative} onCheckedChange={toggleCreative} />
      </div>

      {creative && (
        <Button variant="outline" size="sm" className="w-full" onClick={refillResources}>
          🔄 Refill Resources Now
        </Button>
      )}


      <div className="flex items-center justify-between rounded-md border border-border p-3">
        <div className="flex-1">
          <Label className="text-sm font-semibold">🧭 Always-On Dungeon Compass</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Permanently reveal the exit staircase on every dungeon floor. Resets when the tab closes.
          </p>
        </div>
        <Switch checked={compass} onCheckedChange={toggleCompass} />
      </div>

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

// ─── Return to Main Menu ───
// Suspends the active run (no progress lost) and switches phases. Saves to
// cloud first when signed in. Hidden when no run is in progress, since the
// user is already on the main menu.
function ReturnToMainMenuSection({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useGame();
  const { saveToCloud } = useCloudSave();
  const [saving, setSaving] = useState(false);

  if (!state.run) return null;

  const handleReturn = async () => {
    setSaving(true);
    const snapshot = buildProgressSnapshot(state.saveData, state.run, null);
    dispatch({ type: 'SNAPSHOT_RUN_PROGRESS', overworld: null });
    try {
      const result = await saveToCloud(snapshot);
      if (result.success) {
        sonnerToast.success('☁️ Saved — returning to menu');
      } else {
        // Not signed in or cloud failed — local autosave still applies.
        sonnerToast.success('💾 Saved locally — returning to menu');
      }
    } catch {
      sonnerToast.success('💾 Saved locally — returning to menu');
    }
    setSaving(false);
    onClose();
    dispatch({ type: 'SET_PHASE', phase: 'main_menu' });
  };

  return (
    <div className="space-y-2 pt-4 border-t">
      <Label className="text-base flex items-center gap-2">
        <Home className="w-4 h-4 text-primary" />
        Main Menu
      </Label>
      <p className="text-xs text-muted-foreground">
        Save your progress and return to the main menu. You can resume right
        where you left off from the menu.
      </p>
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={handleReturn}
        disabled={saving}
      >
        <Home className="w-4 h-4 mr-1" />
        {saving ? 'Saving…' : 'Return to Main Menu'}
      </Button>
    </div>
  );
}

// ─── Cloud Save History ───
// Rolling last-5 snapshots from `game_save_snapshots`. Lets the user restore
// any recent cloud save after a mistake (e.g. accidental QA-fixture overwrite).
function CloudSaveHistorySection({ onClose }: { onClose: () => void }) {
  const { dispatch } = useGame();
  const { listSnapshots, restoreSnapshot, saveToCloud, isAuthenticated } = useCloudSave();
  const [snapshots, setSnapshots] = useState<Array<{ id: string; created_at: string; kind: string; label: string | null }>>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const refresh = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    const res = await listSnapshots();
    if (res.success) setSnapshots(res.snapshots);
    setLoading(false);
  };

  useEffect(() => {
    if (open) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isAuthenticated]);

  if (!isAuthenticated) return null;

  const handleRestore = async (id: string, when: string) => {
    if (!window.confirm(`Restore save from ${new Date(when).toLocaleString()}? Your current progress will be replaced (a snapshot of the current state is saved first).`)) return;
    // Snapshot current state before overwriting, so restore itself is undoable.
    try {
      const { state } = (window as any).__menagerie ?? {};
      if (state?.saveData) {
        await saveToCloud(state.saveData, { skipPreflight: true, snapshotKind: 'manual', snapshotLabel: 'Before restore' });
      }
    } catch {}
    const res = await restoreSnapshot(id);
    if (!res.success || !res.data) {
      sonnerToast.error(`Restore failed: ${res.error ?? 'unknown error'}`);
      return;
    }
    dispatch({ type: 'LOAD_SAVE', saveData: res.data });
    sonnerToast.success('☁️ Save restored');
    onClose();
  };

  return (
    <div className="space-y-2 pt-4 border-t">
      <Label className="text-base flex items-center gap-2">
        <Download className="w-4 h-4 text-primary" />
        Cloud Save History
      </Label>
      <p className="text-xs text-muted-foreground">
        The last 5 cloud saves are kept automatically. Restore any of them if something goes wrong.
      </p>
      <Button variant="outline" size="sm" className="w-full" onClick={() => setOpen(o => !o)}>
        {open ? 'Hide history' : 'Show history'}
      </Button>
      {open && (
        <div className="space-y-1">
          {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
          {!loading && snapshots.length === 0 && (
            <p className="text-xs text-muted-foreground">No snapshots yet — they'll appear here after your next cloud save.</p>
          )}
          {snapshots.map(s => (
            <div key={s.id} className="flex items-center justify-between gap-2 border rounded p-2 text-xs">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{new Date(s.created_at).toLocaleString()}</div>
                <div className="text-muted-foreground">
                  {s.kind}{s.label ? ` · ${s.label}` : ''}
                </div>
              </div>
              <Button size="sm" variant="secondary" onClick={() => handleRestore(s.id, s.created_at)}>
                Restore
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// Standalone Admin Panel Dialog - lives outside settings
function AdminPanelDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-6xl h-[90vh] p-0 overflow-hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
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
