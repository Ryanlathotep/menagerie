// Compact autoplay rule editor.
//
// Shows the shared default profile plus (optionally) a per-character override
// for whichever monster is active. Rules are evaluated top-to-bottom, so the
// list is reorderable with the ▲ / ▼ buttons and each row has an on/off switch.
// Everything saves immediately to localStorage via src/game/autoplay/rules.ts.

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import {
  ACTION_LABELS,
  AUTOPLAY_EVENT,
  AutoplayActionKind,
  AutoplayConditionKind,
  AutoplayEngageMode,
  AutoplayProfile,
  CONDITION_LABELS,
  clearAutoplayProfile,
  conditionNeedsValue,
  defaultProfile,
  getAutoplayProfile,
  hasOwnAutoplayProfile,
  newRule,
  saveAutoplayProfile,
} from './rules';

interface Props {
  /** comboId of the active monster, enabling the per-character tab. */
  comboId?: string | null;
  /** Friendly name for the per-character tab. */
  characterName?: string;
}

export function AutoplayRulesPanel({ comboId, characterName }: Props) {
  // null target = shared default profile.
  const [target, setTarget] = useState<string | null>(null);
  const [profile, setProfile] = useState<AutoplayProfile>(() => getAutoplayProfile(null));

  const reload = useCallback(() => setProfile(getAutoplayProfile(target)), [target]);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    const h = () => reload();
    window.addEventListener(AUTOPLAY_EVENT, h);
    return () => window.removeEventListener(AUTOPLAY_EVENT, h);
  }, [reload]);

  const commit = (next: AutoplayProfile) => {
    setProfile(next);
    saveAutoplayProfile(target, next);
  };

  const patchRule = (id: string, patch: Partial<AutoplayProfile['rules'][number]>) =>
    commit({ ...profile, rules: profile.rules.map(r => (r.id === id ? { ...r, ...patch } : r)) });

  const move = (index: number, dir: -1 | 1) => {
    const next = [...profile.rules];
    const to = index + dir;
    if (to < 0 || to >= next.length) return;
    [next[index], next[to]] = [next[to], next[index]];
    commit({ ...profile, rules: next });
  };

  const overridden = !!comboId && hasOwnAutoplayProfile(comboId);

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="cursor-default">Autoplay behaviour</Label>
        <p className="text-xs text-muted-foreground">
          If/then rules used by Auto-Hunt, Auto-Search and Auto-Harvest when an enemy is in
          reach. The first matching rule wins, so put your emergency rules on top.
        </p>
      </div>

      {/* Profile selector */}
      {comboId && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={target === null ? 'default' : 'outline'} onClick={() => setTarget(null)}>
            Default (all monsters)
          </Button>
          <Button size="sm" variant={target === comboId ? 'default' : 'outline'} onClick={() => setTarget(comboId)}>
            {characterName || 'This monster'}{overridden ? ' •' : ''}
          </Button>
          {target === comboId && overridden && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { clearAutoplayProfile(comboId); setProfile(getAutoplayProfile(null)); setTarget(null); }}
            >
              Use default
            </Button>
          )}
        </div>
      )}

      {/* Engage mode */}
      <div className="space-y-2">
        <Label className="cursor-default text-xs">When automation reaches an enemy</Label>
        <div className="grid grid-cols-3 gap-2">
          {([
            { key: 'fight', label: 'Fight it out' },
            { key: 'ask', label: 'Ask me' },
            { key: 'stop', label: 'Just stop' },
          ] as { key: AutoplayEngageMode; label: string }[]).map(opt => (
            <Button
              key={opt.key}
              size="sm"
              variant={profile.engage === opt.key ? 'default' : 'outline'}
              onClick={() => commit({ ...profile, engage: opt.key })}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <Label htmlFor="ap-switch" className="cursor-pointer text-xs">Switch to best matchup</Label>
          <span className="text-[11px] text-muted-foreground">
            Swap in the party member with the best species/element/class matchup before engaging,
            then follow that monster&apos;s own autoplay rules.
          </span>
        </div>
        <Switch
          id="ap-switch"
          checked={profile.switchBestMatchup}
          onCheckedChange={v => commit({ ...profile, switchBestMatchup: v })}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <Label htmlFor="ap-hp" className="cursor-pointer text-xs">Halt automation below HP %</Label>
          <span className="text-[11px] text-muted-foreground">
            Every automation loop stops when the active monster drops under this.
          </span>
        </div>
        <Input
          id="ap-hp"
          type="number"
          min={0}
          max={100}
          className="h-8 w-20"
          value={profile.stopHpPercent}
          onChange={e => commit({ ...profile, stopHpPercent: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
        />
      </div>

      {/* Rule list */}
      <div className="space-y-2">
        {profile.rules.length === 0 && (
          <p className="text-xs italic text-muted-foreground">No rules — automation will just stop at enemies.</p>
        )}
        {profile.rules.map((rule, i) => (
          <div key={rule.id} className="rounded-md border bg-card p-2 space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">{i + 1}</Badge>
              <span className="text-[11px] font-semibold text-muted-foreground">IF</span>
              <select
                className="h-7 flex-1 min-w-0 rounded border bg-background px-1 text-xs"
                value={rule.condition.kind}
                onChange={e => patchRule(rule.id, {
                  condition: { kind: e.target.value as AutoplayConditionKind, value: rule.condition.value ?? 50 },
                })}
              >
                {(Object.keys(CONDITION_LABELS) as AutoplayConditionKind[]).map(k => (
                  <option key={k} value={k}>{CONDITION_LABELS[k]}</option>
                ))}
              </select>
              {conditionNeedsValue(rule.condition.kind) && (
                <Input
                  type="number"
                  className="h-7 w-16 text-xs"
                  value={rule.condition.value ?? 0}
                  onChange={e => patchRule(rule.id, {
                    condition: { ...rule.condition, value: Number(e.target.value) || 0 },
                  })}
                />
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-muted-foreground pl-6">THEN</span>
              <select
                className="h-7 flex-1 min-w-0 rounded border bg-background px-1 text-xs"
                value={rule.action}
                onChange={e => patchRule(rule.id, { action: e.target.value as AutoplayActionKind })}
              >
                {(Object.keys(ACTION_LABELS) as AutoplayActionKind[]).map(k => (
                  <option key={k} value={k}>{ACTION_LABELS[k]}</option>
                ))}
              </select>
              {rule.action === 'attack_pinned' && (
                <Input
                  className="h-7 w-28 text-xs"
                  placeholder="Move name"
                  value={rule.moveName ?? ''}
                  onChange={e => patchRule(rule.id, { moveName: e.target.value })}
                />
              )}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(i, -1)} aria-label="Move rule up">
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(i, 1)} aria-label="Move rule down">
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive"
                  onClick={() => commit({ ...profile, rules: profile.rules.filter(r => r.id !== rule.id) })}
                  aria-label="Delete rule"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <label className="flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer">
                Enabled
                <Switch checked={rule.enabled} onCheckedChange={v => patchRule(rule.id, { enabled: v })} />
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => commit({ ...profile, rules: [...profile.rules, newRule()] })}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add rule
        </Button>
        <Button size="sm" variant="ghost" onClick={() => commit(defaultProfile())}>
          Reset to defaults
        </Button>
      </div>
    </div>
  );
}
