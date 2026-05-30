import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useGameDataOverrides } from '@/hooks/useGameDataOverrides';

import {
  DEFAULT_WORLD_GEN,
  setWorldGenOverrides,
  type WorldGenOverworld,
} from '@/game/worldGenConfig';
import { Globe2, RotateCcw, Save, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

// Deep clone via JSON — config is plain data.
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

interface NumFieldProps {
  label: string;
  hint?: string;
  value: number;
  step?: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}
function NumField({ label, hint, value, step = 0.01, min, max, onChange }: NumFieldProps) {
  return (
    <div className="grid grid-cols-[1fr_120px] gap-2 items-center">
      <div>
        <Label className="text-sm">{label}</Label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          if (!Number.isNaN(n)) onChange(n);
        }}
      />
    </div>
  );
}

export function WorldGenEditor() {
  const { overrides, saveOverride, deleteOverride, loading, refetch } = useGameDataOverrides('world_gen');
  const [draft, setDraft] = useState<WorldGenOverworld>(clone(DEFAULT_WORLD_GEN.overworld));
  const [dirty, setDirty] = useState(false);

  // Load saved override into the form when fetched.
  useEffect(() => {
    const ov = overrides.find((o) => o.data_key === 'overworld');
    if (ov && ov.data_value) {
      // Merge with defaults so newly added fields show up.
      const merged: any = clone(DEFAULT_WORLD_GEN.overworld);
      const patch = ov.data_value as any;
      for (const k of Object.keys(patch)) {
        if (patch[k] && typeof patch[k] === 'object' && !Array.isArray(patch[k])) {
          merged[k] = { ...merged[k], ...patch[k] };
        } else {
          merged[k] = patch[k];
        }
      }
      setDraft(merged);
    } else {
      setDraft(clone(DEFAULT_WORLD_GEN.overworld));
    }
    setDirty(false);
  }, [overrides]);

  const update = <K extends keyof WorldGenOverworld>(section: K, patch: Partial<WorldGenOverworld[K]>) => {
    setDraft((d) => ({ ...d, [section]: { ...(d[section] as any), ...patch } }));
    setDirty(true);
  };

  const updateNested = (path: string[], value: number) => {
    setDraft((d) => {
      const next: any = clone(d);
      let cur = next;
      for (let i = 0; i < path.length - 1; i++) cur = cur[path[i]];
      cur[path[path.length - 1]] = value;
      return next;
    });
    setDirty(true);
  };

  const onSave = async () => {
    const ok = await saveOverride('world_gen', 'overworld', draft as any);
    if (ok) {
      // Apply immediately to the running session so a Rebuild Overworld picks it up.
      setWorldGenOverrides([{ data_key: 'overworld', data_value: draft as any }]);
      setDirty(false);
    }
  };

  const onReset = async () => {
    if (!confirm('Reset overworld generation back to built-in defaults?')) return;
    await deleteOverride('world_gen', 'overworld');
    setWorldGenOverrides([]);
    setDraft(clone(DEFAULT_WORLD_GEN.overworld));
    setDirty(false);
  };

  const onResetForm = () => {
    setDraft(clone(DEFAULT_WORLD_GEN.overworld));
    setDirty(true);
    toast.info('Form reset to built-in defaults — click Save to apply.');
  };

  const onRebuild = () => {
    window.dispatchEvent(new CustomEvent('menagerie-rebuild-overworld'));
    toast.success('Overworld rebuilding…');
  };

  if (loading) return <div className="p-4 text-muted-foreground">Loading…</div>;

  const biomes = ['water', 'earth', 'fire', 'air', 'void'] as const;
  const treeBiomes = ['grass', 'water', 'earth', 'fire', 'air', 'void'] as const;
  const stoneTiers: Array<keyof WorldGenOverworld['stoneTierRolls']> = ['copper', 'iron', 'gold', 'mithril'];
  const treeTiers: Array<keyof WorldGenOverworld['treeTierRolls']> = ['maple', 'elderOak'];

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Globe2 className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-bold">World Generation</h3>
              <p className="text-xs text-muted-foreground">
                Tune non-engine-breaking overworld knobs. Save, then Rebuild Overworld to see results.
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={onResetForm}>
              <RotateCcw className="w-4 h-4 mr-1" /> Defaults
            </Button>
            <Button variant="outline" size="sm" onClick={onReset}>
              Clear Saved Override
            </Button>
            <Button variant="outline" size="sm" onClick={onRebuild}>
              <RefreshCw className="w-4 h-4 mr-1" /> Rebuild Overworld
            </Button>
            <Button size="sm" onClick={onSave} disabled={!dirty}>
              <Save className="w-4 h-4 mr-1" /> Save
            </Button>
          </div>
        </div>
      </Card>

      {(() => {
        const Section = ({ title, open = false, children }: { title: string; open?: boolean; children: React.ReactNode }) => (
          <details open={open} className="group border rounded-md bg-card">
            <summary className="cursor-pointer select-none px-4 py-3 font-semibold text-sm hover:bg-muted/50 rounded-md">
              {title}
            </summary>
            <div className="px-4 pb-4 pt-2 space-y-3">{children}</div>
          </details>
        );
        const Hr = () => <hr className="my-2 border-border" />;
        return (
          <div className="space-y-2">
            <Section title="Spawn safety (fixes giant ore at home base)" open>
              <NumField label="Home bias radius" hint="Tiles around (0,0) where elevation is pulled toward target."
                value={draft.spawn.homeBiasRadius} step={1} min={0} max={20}
                onChange={(v) => update('spawn', { homeBiasRadius: v })} />
              <NumField label="Target elevation" hint="Mid value pulled toward (between water and stone cutoffs). Default 0.55."
                value={draft.spawn.targetElev} min={0} max={1}
                onChange={(v) => update('spawn', { targetElev: v })} />
              <NumField label="Bias strength" hint="0 = no pull, 1 = fully replace elevation at center."
                value={draft.spawn.biasStrength} min={0} max={1}
                onChange={(v) => update('spawn', { biasStrength: v })} />
            </Section>

            <Section title="Elevation cutoffs (water vs stone)" open>
              <NumField label="Default waterCutoff" value={draft.elevation.waterCutoff} min={0} max={1}
                onChange={(v) => update('elevation', { waterCutoff: v })} />
              <NumField label="Default stoneCutoff" value={draft.elevation.stoneCutoff} min={0} max={1}
                onChange={(v) => update('elevation', { stoneCutoff: v })} />
              <Hr />
              {biomes.map((b) => {
                const ov = draft.elevation.biome[b] ?? {};
                return (
                  <div key={b} className="space-y-2">
                    <h4 className="text-sm font-semibold capitalize">{b} biome</h4>
                    <NumField label={`${b} waterCutoff`} value={ov.waterCutoff ?? draft.elevation.waterCutoff}
                      min={0} max={1}
                      onChange={(v) => {
                        const biome = { ...draft.elevation.biome, [b]: { ...ov, waterCutoff: v } };
                        update('elevation', { biome });
                      }} />
                    <NumField label={`${b} stoneCutoff`} value={ov.stoneCutoff ?? draft.elevation.stoneCutoff}
                      min={0} max={1}
                      onChange={(v) => {
                        const biome = { ...draft.elevation.biome, [b]: { ...ov, stoneCutoff: v } };
                        update('elevation', { biome });
                      }} />
                  </div>
                );
              })}
            </Section>

            <Section title="Tree density">
              {treeBiomes.map((b) => (
                <NumField key={b} label={`${b} base chance`} value={draft.trees.baseChance[b]} min={0} max={1}
                  onChange={(v) => update('trees', { baseChance: { ...draft.trees.baseChance, [b]: v } })} />
              ))}
              <Hr />
              <NumField label="Forest cluster threshold" hint="Noise above this clusters into forests."
                value={draft.trees.forestThreshold} min={0} max={1}
                onChange={(v) => update('trees', { forestThreshold: v })} />
              <NumField label="Forest cluster gain" value={draft.trees.forestGain} min={0} max={4}
                onChange={(v) => update('trees', { forestGain: v })} />
            </Section>

            <Section title="Stone tier rolls (copper / iron / gold / mithril)" open>
              {stoneTiers.map((tier) => (
                <div key={tier} className="space-y-2">
                  <h4 className="text-sm font-semibold capitalize">{tier}</h4>
                  <NumField label="Min distance" value={draft.stoneTierRolls[tier].minDist} step={1} min={0} max={500}
                    onChange={(v) => updateNested(['stoneTierRolls', tier, 'minDist'], v)} />
                  <NumField label="Chance" value={draft.stoneTierRolls[tier].chance} min={0} max={1}
                    onChange={(v) => updateNested(['stoneTierRolls', tier, 'chance'], v)} />
                </div>
              ))}
            </Section>

            <Section title="Tree tier rolls (maple / elder oak)">
              {treeTiers.map((tier) => (
                <div key={tier} className="space-y-2">
                  <h4 className="text-sm font-semibold capitalize">{tier}</h4>
                  <NumField label="Min distance" value={draft.treeTierRolls[tier].minDist} step={1} min={0} max={500}
                    onChange={(v) => updateNested(['treeTierRolls', tier, 'minDist'], v)} />
                  <NumField label="Chance" value={draft.treeTierRolls[tier].chance} min={0} max={1}
                    onChange={(v) => updateNested(['treeTierRolls', tier, 'chance'], v)} />
                </div>
              ))}
            </Section>

            <Section title="Enemy spawns">
              <NumField label="Base chance" value={draft.enemies.baseChance} min={0} max={1}
                onChange={(v) => update('enemies', { baseChance: v })} />
              <NumField label="Per-difficulty bonus" value={draft.enemies.perDifficulty} min={0} max={0.2}
                onChange={(v) => update('enemies', { perDifficulty: v })} />
              <NumField label="Max chance (cap)" value={draft.enemies.maxChance} min={0} max={1}
                onChange={(v) => update('enemies', { maxChance: v })} />
            </Section>

            <Section title="Difficulty scaling">
              <NumField label="Tiles per +1 difficulty" value={draft.difficulty.tilesPerLevel} step={1} min={1} max={100}
                onChange={(v) => update('difficulty', { tilesPerLevel: v })} />
              <NumField label="Starting difficulty" value={draft.difficulty.starting} step={1} min={1} max={100}
                onChange={(v) => update('difficulty', { starting: v })} />
              <p className="text-xs text-muted-foreground">
                Note: difficulty scaling values are stored now and will be wired into the live overworld
                difficulty formula in a follow-up pass (currently still uses Manhattan distance / 10).
              </p>
            </Section>
          </div>
        );
      })()}
    </div>
  );
}

