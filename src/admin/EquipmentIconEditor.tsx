import { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Search, Save, RotateCcw, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useGameDataOverrides } from '@/hooks/useGameDataOverrides';
import {
  listEquipmentIconKeys,
  getBuiltInEquipmentIcon,
  type EquipmentIconDef,
} from '@/game/equipmentUtils';
import { setSingleEquipmentIconOverride } from '@/game/equipmentIconOverrides';
import { CopyFromPicker } from './CopyFromPicker';

/**
 * Admin editor for the SVG overlay path used by each equipment piece.
 * Stored as `game_data_overrides` rows of type 'sprites', keyed by the
 * equipment name (matches `EQUIPMENT_ICONS` lookup in equipmentUtils).
 */
export function EquipmentIconEditor() {
  const { overrides, saveOverride, deleteOverride, getOverride, loading } =
    useGameDataOverrides('sprites');
  const [search, setSearch] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<EquipmentIconDef>({
    path: '',
    viewBox: '0 0 100 100',
  });

  const allKeys = useMemo(() => listEquipmentIconKeys().sort(), []);

  const filteredKeys = useMemo(() => {
    if (!search) return allKeys;
    const q = search.toLowerCase();
    return allKeys.filter((k) => k.toLowerCase().includes(q));
  }, [allKeys, search]);

  // When the selection changes, hydrate the draft from override-or-default.
  const loadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedKey) {
      loadedFor.current = null;
      return;
    }
    if (loadedFor.current === selectedKey) return;
    loadedFor.current = selectedKey;
    const ovr = getOverride('sprites', selectedKey) as Partial<EquipmentIconDef> | null;
    const base = getBuiltInEquipmentIcon(selectedKey);
    setDraft({
      path: (ovr?.path as string) ?? base?.path ?? '',
      viewBox: (ovr?.viewBox as string) ?? base?.viewBox ?? '0 0 100 100',
      strokeWidth:
        typeof ovr?.strokeWidth === 'number'
          ? ovr.strokeWidth
          : base?.strokeWidth,
    });
  }, [selectedKey, getOverride]);

  const hasOverride = selectedKey ? !!getOverride('sprites', selectedKey) : false;
  const builtIn = selectedKey ? getBuiltInEquipmentIcon(selectedKey) : undefined;

  const handleSave = async () => {
    if (!selectedKey) return;
    if (!draft.path.trim() || !draft.viewBox.trim()) {
      toast.error('Path and viewBox are required');
      return;
    }
    const payload: EquipmentIconDef = {
      path: draft.path.trim(),
      viewBox: draft.viewBox.trim(),
      ...(typeof draft.strokeWidth === 'number' ? { strokeWidth: draft.strokeWidth } : {}),
    };
    const ok = await saveOverride('sprites', selectedKey, payload as unknown as Record<string, unknown>);
    if (ok) {
      setSingleEquipmentIconOverride(selectedKey, payload);
      toast.success(`Saved overlay for ${selectedKey}`);
    }
  };

  const handleReset = async () => {
    if (!selectedKey) return;
    const ok = await deleteOverride('sprites', selectedKey);
    if (ok) {
      setSingleEquipmentIconOverride(selectedKey, null);
      const base = getBuiltInEquipmentIcon(selectedKey);
      if (base) setDraft({ ...base });
      toast.success(`Reset ${selectedKey} to default overlay`);
    }
  };

  const previewViewBox = draft.viewBox || '0 0 100 100';

  if (loading) return <div className="text-muted-foreground p-4">Loading icons...</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* List */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search equipment by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
        </div>

        <ScrollArea className="h-[480px]">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {filteredKeys.map((key) => {
              const ovr = getOverride('sprites', key) as Partial<EquipmentIconDef> | null;
              const base = getBuiltInEquipmentIcon(key);
              const def: EquipmentIconDef = {
                path: (ovr?.path as string) ?? base?.path ?? '',
                viewBox: (ovr?.viewBox as string) ?? base?.viewBox ?? '0 0 100 100',
                strokeWidth:
                  typeof ovr?.strokeWidth === 'number'
                    ? ovr.strokeWidth
                    : base?.strokeWidth,
              };
              const isSelected = selectedKey === key;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedKey(key)}
                  className={`group flex flex-col items-center gap-1 p-2 rounded border text-xs transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:bg-muted'
                  }`}
                  title={key}
                >
                  <svg
                    width={48}
                    height={48}
                    viewBox={def.viewBox}
                    className="text-foreground"
                  >
                    <path
                      d={def.path}
                      fill="currentColor"
                      stroke="hsl(var(--foreground) / 0.8)"
                      strokeWidth={def.strokeWidth ?? 1.5}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="truncate w-full text-center">{key}</span>
                  {!!ovr && (
                    <span className="text-[9px] bg-primary/20 text-primary px-1 rounded">
                      mod
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </ScrollArea>

        <div className="mt-2 text-xs text-muted-foreground">
          {filteredKeys.length} pieces • {overrides.length} overrides
        </div>
      </Card>

      {/* Editor */}
      <Card className="p-4">
        {selectedKey ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                {selectedKey}
              </h3>
              {hasOverride && (
                <span className="text-xs bg-amber-500/20 text-amber-500 px-2 py-1 rounded">
                  Has Override
                </span>
              )}
            </div>

            <CopyFromPicker
              sources={allKeys.map((k) => ({ id: k, name: k }))}
              excludeId={selectedKey}
              onPick={(sourceId) => {
                const ovr = getOverride('sprites', sourceId) as Partial<EquipmentIconDef> | null;
                const base = getBuiltInEquipmentIcon(sourceId);
                const src: EquipmentIconDef = {
                  path: (ovr?.path as string) ?? base?.path ?? '',
                  viewBox: (ovr?.viewBox as string) ?? base?.viewBox ?? '0 0 100 100',
                  strokeWidth:
                    typeof ovr?.strokeWidth === 'number'
                      ? ovr.strokeWidth
                      : base?.strokeWidth,
                };
                setDraft({ ...src });
              }}
              label={`Copy overlay into "${selectedKey}" from`}
            />

            {/* Live preview vs built-in */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border bg-muted/30 p-3 flex flex-col items-center gap-2">
                <div className="text-xs font-semibold text-muted-foreground">Preview</div>
                <svg
                  width={140}
                  height={140}
                  viewBox={previewViewBox}
                  className="text-primary"
                >
                  <rect
                    x={0}
                    y={0}
                    width="100%"
                    height="100%"
                    fill="hsl(var(--muted) / 0.4)"
                  />
                  <path
                    d={draft.path || 'M0,0'}
                    fill="currentColor"
                    stroke="hsl(var(--foreground) / 0.8)"
                    strokeWidth={draft.strokeWidth ?? 1.5}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="text-[10px] font-mono text-muted-foreground">
                  viewBox: {previewViewBox}
                </div>
              </div>
              <div className="rounded-md border bg-muted/30 p-3 flex flex-col items-center gap-2">
                <div className="text-xs font-semibold text-muted-foreground">Built-in</div>
                {builtIn ? (
                  <svg
                    width={140}
                    height={140}
                    viewBox={builtIn.viewBox}
                    className="text-muted-foreground"
                  >
                    <rect
                      x={0}
                      y={0}
                      width="100%"
                      height="100%"
                      fill="hsl(var(--muted) / 0.4)"
                    />
                    <path
                      d={builtIn.path}
                      fill="currentColor"
                      stroke="hsl(var(--foreground) / 0.6)"
                      strokeWidth={builtIn.strokeWidth ?? 1.5}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  </svg>
                ) : (
                  <div className="h-[140px] flex items-center justify-center text-xs text-muted-foreground">
                    (no built-in)
                  </div>
                )}
                <div className="text-[10px] font-mono text-muted-foreground">
                  {builtIn?.viewBox ?? '—'}
                </div>
              </div>
            </div>

            <div>
              <Label>SVG Path (d attribute)</Label>
              <Textarea
                value={draft.path}
                rows={6}
                onChange={(e) => setDraft({ ...draft, path: e.target.value })}
                className="font-mono text-xs"
                placeholder="M50,15 L80,50 L50,85 L20,50 Z"
              />
              <div className="text-[11px] text-muted-foreground mt-1">
                Standard SVG path commands (M, L, Q, A, Z…). The preview updates as you type.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>viewBox</Label>
                <Input
                  value={draft.viewBox}
                  onChange={(e) => setDraft({ ...draft, viewBox: e.target.value })}
                  placeholder="0 0 100 100"
                  className="font-mono text-xs"
                />
              </div>
              <div>
                <Label>Stroke Width (optional)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={draft.strokeWidth ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setDraft({
                      ...draft,
                      strokeWidth: raw === '' ? undefined : parseFloat(raw),
                    });
                  }}
                  placeholder="1.5"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} className="flex-1 gap-2">
                <Save className="w-4 h-4" />
                Save Overlay
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
          <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
            Select an equipment piece to edit its overlay.
          </div>
        )}
      </Card>
    </div>
  );
}
