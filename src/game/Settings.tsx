// Game Settings Component and Hook

import { useState, useEffect, createContext, useContext, ReactNode, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Settings as SettingsIcon, X, Download, Upload, Shield, Globe2, Dices, Home, Bug } from 'lucide-react';
import { ReportBugDialog } from './ReportBugDialog';
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

// Settings interface
export type ThemeMode = 'system' | 'light' | 'dark';

export interface GameSettings {
  autoRunDelay: number;      // ms for double-tap detection (100-500)
  autoRunSpeed: number;      // ms between auto-run steps (100-200)
  dungeonZoom: number;       // zoom level for dungeon tiles (50-400, 100 = default)
  showDamageNumbers: boolean;
  soundEnabled: boolean;
  theme: ThemeMode;          // light / dark / follow browser
  // Overworld direction arrow overlays
  showHomeArrow: boolean;
  showHomeTowerArrow: boolean;
  showMajorDungeonArrows: boolean;
  // Per-dungeon waypoint pins (id → enabled). Used for procedural / minor
  // dungeons that don't have a global toggle. Right-click a dungeon to pin.
  dungeonWaypoints: Record<string, boolean>;
}

const DEFAULT_SETTINGS: GameSettings = {
  autoRunDelay: 200,         // Faster default (was 300)
  autoRunSpeed: 100,
  dungeonZoom: 100,          // 100% = default size
  showDamageNumbers: true,
  soundEnabled: true,
  theme: 'system',
  showHomeArrow: true,
  showHomeTowerArrow: true,
  showMajorDungeonArrows: true,
  dungeonWaypoints: {},
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
  const { state, dispatch } = useGame();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [bugOpen, setBugOpen] = useState(false);

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
    reader.onload = (event) => {
      try {
        const backup = JSON.parse(event.target?.result as string);
        
         if (!backup.version || !backup.saveData) {
          throw new Error('Invalid backup file');
        }
        
        localStorage.setItem('monster-roguelike-save', JSON.stringify(backup.saveData));
         dispatch({ type: 'LOAD_SAVE', saveData: backup.saveData });
        if (backup.settings) {
          localStorage.setItem('monster-roguelike-settings', JSON.stringify(backup.settings));
           window.dispatchEvent(new CustomEvent('menagerie-import-settings', { detail: backup.settings }));
        }
        
         toast({ title: 'Backup restored!', description: 'Save and settings were restored immediately.' });
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
    <>
    <div className={`fixed inset-0 bg-black/50 flex items-center justify-center z-[100] ${adminOpen ? 'hidden' : ''}`}>

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
          </div>

          {/* Public Username (for tower leaderboards) */}
          <UsernameEditor />

          {/* Global discovery leaderboard (top 10 by unique monsters unlocked) */}
          <DiscoveryLeaderboard limit={10} />

          {/* Global exploration leaderboard (top 10 by overworld tiles explored) */}
          <ExplorationLeaderboard limit={10} />

          {/* Overworld Rebuild Section */}
          <RebuildOverworldSection />

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
          <div className="pt-2 border-t">
            <Button variant="outline" className="w-full" onClick={() => setBugOpen(true)}>
              <Bug className="w-4 h-4 mr-2" /> Report a Bug
            </Button>
            <p className="text-xs text-muted-foreground mt-1 text-center">
              Send a bug report to the dev team. No account required.
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
      <AdminPanelDialog isOpen={adminOpen} onClose={() => setAdminOpen(false)} />
      <ReportBugDialog isOpen={bugOpen} onClose={() => setBugOpen(false)} />
    </div>
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
  const [creative, setCreative] = useState(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem('menagerie_creative_mode') === '1';
  });
  const [compass, setCompass] = useState(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem('menagerie_admin_compass') === '1';
  });

  if (loading || !isAdmin) return null;

  const toggleCreative = (next: boolean) => {
    setCreative(next);
    // Lazy import to avoid pulling creativeMode into Settings' module graph
    // before admin check passes.
    import('./creativeMode').then(({ setCreativeMode }) => setCreativeMode(next));
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
            Skip resource & material costs for building, roads, and crafting. Resets when the tab closes.
          </p>
        </div>
        <Switch checked={creative} onCheckedChange={toggleCreative} />
      </div>

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
