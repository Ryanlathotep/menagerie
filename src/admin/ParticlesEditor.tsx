// Admin "Particles" tab — manage particle templates, effects, defaults.
//
// Persistence model (all live in game_data_overrides):
//   data_type='particle_template' / data_key=<id> / data_value=<ParticleTemplate>
//   data_type='particle_effect'   / data_key=<id> / data_value=<ParticleEffect>
//   data_type='particle_default'  / data_key='element:fire' | 'class:mage' |
//                                            'species:slime' | 'move:<id>'
//                                  / data_value={ effectId }
//
// Live preview pane plays the selected effect on a 5x5 grid so admins can
// iterate motion/template combos in isolation.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Plus, Upload, Play, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useGameDataOverrides } from '@/hooks/useGameDataOverrides';
import {
  getAllTemplates,
  getAllEffects,
  getAllDefaults,
  upsertTemplate,
  deleteTemplate as registryDeleteTemplate,
  upsertEffect,
  deleteEffect as registryDeleteEffect,
  setDefault as registrySetDefault,
} from '@/game/particles/registry';
import { MOTION_OPTIONS } from '@/game/particles/motions';
import type {
  ParticleTemplate, ParticleEffect, ParticleShape, ParticleMotion,
} from '@/game/particles/types';
import { ParticleGlyph } from '@/game/particles/ParticleGlyph';
import { ParticleLayer } from '@/game/particles/ParticleLayer';
import { playParticleEffect } from '@/game/particles/api';
import { ELEMENT_COLORS, CLASS_STATS, SPECIES_DATA } from '@/game/types';
import type { ElementType, ClassType, SpeciesType } from '@/game/types';

const SHAPE_OPTIONS: ParticleShape[] = [
  'circle', 'spark', 'star', 'diamond', 'droplet', 'flame',
  'leaf', 'snowflake', 'rune', 'bolt', 'cross', 'ring',
];

const BUCKET = 'game-assets';

function slugId(prefix: string, name: string) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return `${prefix}_${slug || Date.now().toString(36)}`;
}

// ── Live preview ───────────────────────────────────────────────────────────
function PreviewBoard({ playKey }: { playKey: number }) {
  // 5x5 grid, caster at (1,2), target at (3,2)
  const tileSize = 48;
  return (
    <div className="relative bg-card border rounded-md overflow-hidden" style={{ width: 5 * tileSize, height: 5 * tileSize }}>
      {Array.from({ length: 25 }).map((_, i) => (
        <div
          key={i}
          className="absolute border border-border/30"
          style={{
            left: (i % 5) * tileSize, top: Math.floor(i / 5) * tileSize,
            width: tileSize, height: tileSize,
            background: i === (2 * 5 + 1) ? 'hsl(var(--primary) / 0.25)'
                       : i === (2 * 5 + 3) ? 'hsl(var(--destructive) / 0.25)'
                       : undefined,
          }}
        />
      ))}
      <div className="absolute" style={{ inset: 0 }}>
        <ParticleLayer surface="dungeon" tileSize={tileSize} />
      </div>
      <div className="absolute top-1 left-1 text-[10px] text-muted-foreground bg-background/70 px-1 rounded">caster</div>
      <div className="absolute top-1 right-1 text-[10px] text-muted-foreground bg-background/70 px-1 rounded">target</div>
    </div>
  );
}

// ── Templates editor ───────────────────────────────────────────────────────
function TemplatesPanel({ onChanged }: { onChanged: () => void }) {
  const { saveOverride, deleteOverride } = useGameDataOverrides('particle_template');
  const [list, setList] = useState<ParticleTemplate[]>(getAllTemplates());
  const [editing, setEditing] = useState<ParticleTemplate | null>(null);
  const refresh = () => setList(getAllTemplates());

  const startNew = () => setEditing({
    id: slugId('tpl', 'custom_' + Date.now().toString(36)),
    name: 'New template',
    shape: 'spark',
    color: '#ff8800',
    glow: '#ffaa55',
    size: 7,
    opacity: 0.95,
  });

  const save = async () => {
    if (!editing) return;
    upsertTemplate(editing);
    const ok = await saveOverride('particle_template', editing.id, editing as unknown as Record<string, unknown>);
    if (ok) { refresh(); onChanged(); toast.success('Template saved'); }
  };

  const remove = async (id: string) => {
    registryDeleteTemplate(id);
    await deleteOverride('particle_template', id);
    if (editing?.id === id) setEditing(null);
    refresh(); onChanged();
  };

  const fileRef = useRef<HTMLInputElement>(null);
  const uploadImage = async (file: File) => {
    if (!editing) return;
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const path = `particles/${editing.id}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type });
    if (error) { toast.error(`Upload failed: ${error.message}`); return; }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    setEditing({ ...editing, imageUrl: data.publicUrl });
    toast.success('Image uploaded');
  };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card className="p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm">Templates ({list.length})</h3>
          <Button size="sm" onClick={startNew}><Plus className="w-3 h-3 mr-1" />New</Button>
        </div>
        <ScrollArea className="h-[60vh]">
          <div className="grid grid-cols-2 gap-2">
            {list.map((t) => (
              <button
                key={t.id}
                onClick={() => setEditing({ ...t })}
                className={`text-left p-2 rounded border flex items-center gap-2 hover:bg-accent ${editing?.id === t.id ? 'bg-accent border-primary' : 'border-border'}`}
              >
                <div className="w-8 h-8 grid place-items-center bg-background rounded">
                  <ParticleGlyph template={t} color={t.color === 'auto' ? '#888' : t.color} size={Math.min(28, t.size * 3)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{t.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{t.id}</div>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </Card>

      <Card className="p-3">
        {editing ? (
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Edit template</h3>
            <div>
              <Label className="text-xs">ID</Label>
              <Input value={editing.id} onChange={(e) => setEditing({ ...editing, id: e.target.value })} className="h-8 text-xs font-mono" />
            </div>
            <div>
              <Label className="text-xs">Name</Label>
              <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs">Shape</Label>
              <Select value={editing.shape} onValueChange={(v) => setEditing({ ...editing, shape: v as ParticleShape })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SHAPE_OPTIONS.map((s) => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Color (hex or 'auto')</Label>
                <Input value={editing.color} onChange={(e) => setEditing({ ...editing, color: e.target.value })} className="h-8 text-xs font-mono" />
              </div>
              <div>
                <Label className="text-xs">Glow</Label>
                <Input value={editing.glow ?? ''} onChange={(e) => setEditing({ ...editing, glow: e.target.value })} className="h-8 text-xs font-mono" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Size px</Label>
                <Input type="number" value={editing.size} onChange={(e) => setEditing({ ...editing, size: Number(e.target.value) || 6 })} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs">Opacity</Label>
                <Input type="number" step="0.05" min="0" max="1" value={editing.opacity ?? 1} onChange={(e) => setEditing({ ...editing, opacity: Number(e.target.value) })} className="h-8 text-xs" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Image (optional — replaces shape)</Label>
              <div className="flex items-center gap-2">
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); }} />
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                  <Upload className="w-3 h-3 mr-1" />Upload
                </Button>
                {editing.imageUrl && (
                  <>
                    <img src={editing.imageUrl} alt="" className="w-8 h-8 border rounded" />
                    <Button size="sm" variant="ghost" onClick={() => setEditing({ ...editing, imageUrl: undefined })}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-3 border-t">
              <Button size="sm" onClick={save}>Save</Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button size="sm" variant="ghost" className="ml-auto text-destructive" onClick={() => remove(editing.id)}>
                <Trash2 className="w-3 h-3 mr-1" />Delete
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground p-4 text-center">Select a template or click New.</div>
        )}
      </Card>
    </div>
  );
}

// ── Effects editor (template + motion + params, with preview) ──────────────
function EffectsPanel({ onChanged }: { onChanged: () => void }) {
  const { saveOverride, deleteOverride } = useGameDataOverrides('particle_effect');
  const [list, setList] = useState<ParticleEffect[]>(getAllEffects());
  const [templates, setTemplates] = useState<ParticleTemplate[]>(getAllTemplates());
  const [editing, setEditing] = useState<ParticleEffect | null>(null);
  const [playKey, setPlayKey] = useState(0);

  const refresh = () => { setList(getAllEffects()); setTemplates(getAllTemplates()); };

  const startNew = () => setEditing({
    id: slugId('fx', 'custom_' + Date.now().toString(36)),
    name: 'New effect',
    templateId: templates[0]?.id ?? 'tpl_generic',
    motion: 'projectile',
    count: 16,
    duration: 600,
    jitter: 0.3,
  });

  const save = async () => {
    if (!editing) return;
    upsertEffect(editing);
    const ok = await saveOverride('particle_effect', editing.id, editing as unknown as Record<string, unknown>);
    if (ok) { refresh(); onChanged(); toast.success('Effect saved'); }
  };

  const remove = async (id: string) => {
    registryDeleteEffect(id);
    await deleteOverride('particle_effect', id);
    if (editing?.id === id) setEditing(null);
    refresh(); onChanged();
  };

  const play = () => {
    if (!editing) return;
    upsertEffect(editing);
    playParticleEffect({
      surface: 'dungeon',
      effect: editing,
      from: { x: 1, y: 2 },
      to: { x: 3, y: 2 },
      affected: [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 1 }, { x: 3, y: 3 }],
    });
    setPlayKey((k) => k + 1);
  };

  return (
    <div className="grid md:grid-cols-3 gap-4">
      <Card className="p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm">Effects ({list.length})</h3>
          <Button size="sm" onClick={startNew}><Plus className="w-3 h-3 mr-1" />New</Button>
        </div>
        <ScrollArea className="h-[60vh]">
          <div className="space-y-1">
            {list.map((e) => (
              <button
                key={e.id}
                onClick={() => setEditing({ ...e })}
                className={`w-full text-left p-2 rounded border text-xs hover:bg-accent ${editing?.id === e.id ? 'bg-accent border-primary' : 'border-border'}`}
              >
                <div className="font-medium truncate">{e.name}</div>
                <div className="text-[10px] text-muted-foreground truncate">{e.motion} · {e.templateId}</div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </Card>

      <Card className="p-3">
        {editing ? (
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Edit effect</h3>
            <div>
              <Label className="text-xs">ID</Label>
              <Input value={editing.id} onChange={(e) => setEditing({ ...editing, id: e.target.value })} className="h-8 text-xs font-mono" />
            </div>
            <div>
              <Label className="text-xs">Name</Label>
              <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs">Template</Label>
              <Select value={editing.templateId} onValueChange={(v) => setEditing({ ...editing, templateId: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {templates.map((t) => <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Motion pattern</Label>
              <Select value={editing.motion} onValueChange={(v) => setEditing({ ...editing, motion: v as ParticleMotion })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MOTION_OPTIONS.map((m) => (
                    <SelectItem key={m.value} value={m.value} className="text-xs">
                      <div className="flex flex-col">
                        <span>{m.label}</span>
                        <span className="text-[10px] text-muted-foreground">{m.desc}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Count</Label>
                <Input type="number" min="1" max="80" value={editing.count ?? 16} onChange={(e) => setEditing({ ...editing, count: Number(e.target.value) || 1 })} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs">Duration ms</Label>
                <Input type="number" min="100" max="3000" value={editing.duration ?? 600} onChange={(e) => setEditing({ ...editing, duration: Number(e.target.value) || 600 })} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs">Jitter 0–1</Label>
                <Input type="number" step="0.05" min="0" max="1" value={editing.jitter ?? 0.3} onChange={(e) => setEditing({ ...editing, jitter: Number(e.target.value) })} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs">Color override</Label>
                <Input value={editing.colorOverride ?? ''} placeholder="auto / #hex" onChange={(e) => setEditing({ ...editing, colorOverride: e.target.value || undefined })} className="h-8 text-xs font-mono" />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-3 border-t">
              <Button size="sm" onClick={save}>Save</Button>
              <Button size="sm" variant="secondary" onClick={play}><Play className="w-3 h-3 mr-1" />Preview</Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button size="sm" variant="ghost" className="ml-auto text-destructive" onClick={() => remove(editing.id)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground p-4 text-center">Select an effect or click New.</div>
        )}
      </Card>

      <Card className="p-3 flex flex-col items-center gap-3">
        <h3 className="font-semibold text-sm self-start">Live preview</h3>
        <PreviewBoard playKey={playKey} />
        <Button size="sm" onClick={play} disabled={!editing}>
          <Play className="w-3 h-3 mr-1" />Replay
        </Button>
        <p className="text-[11px] text-muted-foreground text-center px-2">
          Caster (left) fires at target (right). AoE tiles are sampled from a small cross.
        </p>
      </Card>
    </div>
  );
}

// ── Defaults editor (element / class / species → effect) ───────────────────
function DefaultsPanel({ onChanged }: { onChanged: () => void }) {
  const { saveOverride, deleteOverride } = useGameDataOverrides('particle_default');
  const [effects, setEffects] = useState<ParticleEffect[]>(getAllEffects());
  const [map, setMap] = useState<Record<string, string>>(getAllDefaults());
  useEffect(() => { setMap(getAllDefaults()); setEffects(getAllEffects()); }, []);

  const setOne = async (key: string, effectId: string | null) => {
    registrySetDefault(key, effectId);
    setMap(getAllDefaults());
    if (effectId) await saveOverride('particle_default', key, { effectId });
    else await deleteOverride('particle_default', key);
    onChanged();
  };

  const Section = ({ title, keys }: { title: string; keys: { key: string; label: string }[] }) => (
    <Card className="p-3">
      <h3 className="font-semibold text-sm mb-2">{title}</h3>
      <div className="space-y-1">
        {keys.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-2">
            <div className="w-24 text-xs">{label}</div>
            <Select value={map[key] ?? ''} onValueChange={(v) => setOne(key, v || null)}>
              <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="(unset)" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {effects.map((e) => <SelectItem key={e.id} value={e.id} className="text-xs">{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" variant="ghost" onClick={() => setOne(key, null)} title="Revert to built-in">
              <RotateCcw className="w-3 h-3" />
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );

  return (
    <div className="grid md:grid-cols-3 gap-4">
      <Section title="By Element" keys={(Object.keys(ELEMENT_COLORS) as ElementType[]).map((k) => ({ key: `element:${k}`, label: k }))} />
      <Section title="By Class" keys={(Object.keys(CLASS_STATS) as ClassType[]).map((k) => ({ key: `class:${k}`, label: k }))} />
      <Section title="By Species" keys={(Object.keys(SPECIES_DATA) as SpeciesType[]).map((k) => ({ key: `species:${k}`, label: SPECIES_DATA[k].name }))} />
    </div>
  );
}

// ── Root tab ───────────────────────────────────────────────────────────────
export function ParticlesEditor() {
  const [bump, setBump] = useState(0);
  const onChanged = () => setBump((b) => b + 1);
  return (
    <div className="space-y-3" key={bump}>
      <Tabs defaultValue="effects">
        <TabsList>
          <TabsTrigger value="effects">Effects</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="defaults">Defaults</TabsTrigger>
        </TabsList>
        <TabsContent value="effects" className="mt-3"><EffectsPanel onChanged={onChanged} /></TabsContent>
        <TabsContent value="templates" className="mt-3"><TemplatesPanel onChanged={onChanged} /></TabsContent>
        <TabsContent value="defaults" className="mt-3"><DefaultsPanel onChanged={onChanged} /></TabsContent>
      </Tabs>
    </div>
  );
}
