// Character menu — the full character sheet shown in the in-game HUD.
//
// Four tabs: Stats (base vs equipped, species growth, matchups), Abilities
// (species passive + toggleable hidden abilities), Forms (shiny and future
// variants) and Keys (per-character move + consumable keybinds).
// Every edit persists immediately (localStorage via characterCustomization /
// keybinds), so nothing here needs a save button.

import { useEffect, useMemo, useState } from 'react';
import { Swords, Shield, Wind, Target, Footprints, Sparkles, Keyboard, Palette, BarChart3 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MonsterSprite } from './sprites';
import {
  Monster,
  Item,
  MonsterEquipment,
  SPECIES_DATA,
  ELEMENT_ADVANTAGES,
  CLASS_ADVANTAGES_CORRECTED,
} from './types';
import type { Move } from './moves';
import { calculateEquipmentBonuses, calculateSetBonusStats } from './equipment';
import { isCreativeMode } from './creativeMode';
import {
  FORMS,
  abilitiesFor,
  activeFormFilter,
  clearItemKeybind,
  comboIdOf,
  formById,
  getProfile,
  grantAbility,
  isAbilityEnabled,
  isAbilityUnlocked,
  isFormUnlocked,
  lockForm,
  onCustomizationChange,
  setAbilityEnabled,
  setActiveForm,
  setItemKeybind,
  unlockForm,
  type AbilityContext,
} from './characterCustomization';
import {
  VALID_KEYBIND_KEYS,
  getKeyLabel,
  getMonsterKeybinds,
  loadKeybinds,
  removeMoveKeybind,
  saveKeybinds,
  setMoveKeybind,
} from './keybinds';

interface CharacterMenuProps {
  monster: Monster;
  levelLabel: string;
  equipment?: MonsterEquipment | null;
  currentHp: number;
  maxHp: number;
  currentStamina: number;
  maxStamina: number;
  experience: number;
  experienceToNext: number;
  moves: Move[];
  inventory: Item[];
}

const NONE = '__none__';

export function CharacterMenu({
  monster,
  levelLabel,
  equipment,
  currentHp,
  maxHp,
  currentStamina,
  maxStamina,
  experience,
  experienceToNext,
  moves,
  inventory,
}: CharacterMenuProps) {
  const comboId = comboIdOf(monster.species, monster.element, monster.class);
  const [, forceRender] = useState(0);
  const bump = () => forceRender(n => n + 1);

  // Keep in sync when another surface edits the same profile.
  useEffect(() => onCustomizationChange(bump), []);

  const [keybindData, setKeybindData] = useState(() => loadKeybinds());
  const monsterBinds = getMonsterKeybinds(keybindData, comboId);

  const speciesData = SPECIES_DATA[monster.species];
  const profile = getProfile(comboId);
  const ctx: AbilityContext = {
    species: monster.species,
    element: monster.element,
    classType: monster.class,
    level: monster.level,
  };
  const abilities = useMemo(() => abilitiesFor(ctx), [monster.species, monster.level, monster.element, monster.class]);
  const spriteFilter = activeFormFilter(comboId);
  const creative = isCreativeMode();

  const equipBonuses = equipment ? calculateEquipmentBonuses(equipment) : null;
  const setBonuses = equipment ? calculateSetBonusStats(equipment) : null;

  const baseAtk = monster.stats.attack;
  const baseDef = monster.stats.defense;
  const baseSpd = monster.stats.speed;
  const baseDodge = monster.stats.dodge ?? Math.floor(monster.stats.speed * 0.5);
  const baseSpecial = monster.stats.special;

  const eq = (k: 'attack' | 'defense' | 'speed' | 'dodge' | 'special' | 'maxHp' | 'stamina') =>
    ((equipBonuses as Record<string, number> | null)?.[k] ?? 0) + ((setBonuses as Record<string, number> | null)?.[k] ?? 0);

  const elementStrong = ELEMENT_ADVANTAGES[monster.element] || [];
  const elementWeak = (Object.entries(ELEMENT_ADVANTAGES) as [string, string[]][])
    .filter(([, targets]) => targets.includes(monster.element))
    .map(([el]) => el);
  const classStrong = CLASS_ADVANTAGES_CORRECTED[monster.class] || [];
  const classWeak = (Object.entries(CLASS_ADVANTAGES_CORRECTED) as [string, string[]][])
    .filter(([, targets]) => targets.includes(monster.class))
    .map(([cl]) => cl);

  const hpPercent = maxHp > 0 ? (currentHp / maxHp) * 100 : 0;
  const staminaPercent = maxStamina > 0 ? (currentStamina / maxStamina) * 100 : 0;
  const xpPercent = experienceToNext > 0 ? (experience / experienceToNext) * 100 : 0;

  const StatRow = ({ label, icon, base, bonus, color }: { label: string; icon: React.ReactNode; base: number; bonus: number; color: string }) => (
    <div className="flex items-center gap-1 text-[10px]">
      <span className={`w-3 h-3 ${color}`}>{icon}</span>
      <span className="w-8 text-muted-foreground">{label}</span>
      <span className="font-mono font-bold w-8 text-right">{base + bonus}</span>
      {bonus !== 0 && (
        <span className={`font-mono text-[9px] ${bonus > 0 ? 'text-green-400' : 'text-red-400'}`}>
          ({bonus > 0 ? '+' : ''}{bonus})
        </span>
      )}
    </div>
  );

  const consumables = inventory.filter(item => item.type === 'potion' || item.effect);

  const applyMoveKey = (moveId: string, key: string) => {
    const next = key === NONE
      ? removeMoveKeybind(keybindData, comboId, moveId)
      : setMoveKeybind(keybindData, comboId, moveId, key);
    saveKeybinds(next);
    setKeybindData(next);
  };

  return (
    <Tabs defaultValue="stats" className="space-y-2">
      <TabsList className="grid grid-cols-4 h-8 w-full">
        <TabsTrigger value="stats" className="text-[10px] gap-1"><BarChart3 className="w-3 h-3" />Stats</TabsTrigger>
        <TabsTrigger value="abilities" className="text-[10px] gap-1"><Sparkles className="w-3 h-3" />Abilities</TabsTrigger>
        <TabsTrigger value="forms" className="text-[10px] gap-1"><Palette className="w-3 h-3" />Forms</TabsTrigger>
        <TabsTrigger value="keys" className="text-[10px] gap-1"><Keyboard className="w-3 h-3" />Keys</TabsTrigger>
      </TabsList>

      {/* ============ STATS ============ */}
      <TabsContent value="stats" className="space-y-2 mt-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className="bg-muted/30 rounded-lg p-2 flex items-center gap-2">
            <div style={{ filter: spriteFilter }}>
              <MonsterSprite species={monster.species} element={monster.element} classType={monster.class} size={40} equipment={equipment ?? null} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-xs truncate">{monster.name}</p>
              <p className="text-[10px] text-muted-foreground">{levelLabel} {speciesData.name}</p>
              <div className="flex gap-1 flex-wrap mt-0.5">
                <span className={`element-badge element-${monster.element} text-[8px] px-1 py-0`}>{monster.element}</span>
                <span className="text-[8px] px-1 py-0 rounded-full bg-muted">{monster.class}</span>
                {profile.activeForm !== 'normal' && (
                  <span className="text-[8px] px-1 py-0 rounded-full bg-primary/20 text-primary">{formById(profile.activeForm).name}</span>
                )}
              </div>
            </div>
          </div>

          <div className="bg-primary/10 border border-primary/30 rounded-lg p-2">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-sm">✨</span>
              <p className="text-xs font-bold text-primary">{speciesData.passiveAbility}</p>
            </div>
            <p className="text-[10px] text-muted-foreground leading-snug">{speciesData.passiveDescription}</p>
          </div>
        </div>

        {/* Resource bars */}
        <div className="bg-muted/30 rounded-lg p-2 space-y-1">
          <div className="flex justify-between text-[10px]">
            <span>HP</span>
            <span className="font-mono">{currentHp}/{maxHp}{eq('maxHp') > 0 ? ` (+${eq('maxHp')})` : ''}</span>
          </div>
          <Progress value={hpPercent} className="h-1.5" />
          <div className="flex justify-between text-[10px]">
            <span>STA</span>
            <span className="font-mono">{currentStamina}/{maxStamina}{eq('stamina') > 0 ? ` (+${eq('stamina')})` : ''}</span>
          </div>
          <Progress value={staminaPercent} className="h-1.5 [&>div]:bg-stat-special" />
          <div className="flex justify-between text-[10px]">
            <span>XP</span>
            <span className="font-mono">{experience}/{experienceToNext}</span>
          </div>
          <Progress value={xpPercent} className="h-1.5 [&>div]:bg-secondary" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-muted/30 rounded-lg p-2">
            <p className="text-[9px] text-muted-foreground uppercase mb-1">Offense</p>
            <div className="space-y-0.5">
              <StatRow label="ATK" icon={<Swords className="w-3 h-3" />} base={baseAtk} bonus={eq('attack')} color="text-orange-500" />
              <StatRow label="SPC" icon={<Target className="w-3 h-3" />} base={baseSpecial} bonus={eq('special')} color="text-yellow-500" />
            </div>
          </div>
          <div className="bg-muted/30 rounded-lg p-2">
            <p className="text-[9px] text-muted-foreground uppercase mb-1">Defense / Mobility</p>
            <div className="space-y-0.5">
              <StatRow label="DEF" icon={<Shield className="w-3 h-3" />} base={baseDef} bonus={eq('defense')} color="text-stat-defense" />
              <StatRow label="DDG" icon={<Footprints className="w-3 h-3" />} base={baseDodge} bonus={eq('dodge')} color="text-emerald-500" />
              <StatRow label="SPD" icon={<Wind className="w-3 h-3" />} base={baseSpd} bonus={eq('speed')} color="text-stat-speed" />
            </div>
          </div>
        </div>

        {/* Species base stats (level 1 boosts) vs current */}
        <div className="bg-muted/30 rounded-lg p-2">
          <p className="text-[9px] text-muted-foreground uppercase mb-1">Species base stats (Lv 1) → growth</p>
          <div className="grid grid-cols-5 gap-1 text-[10px] text-center">
            {([
              ['HP', speciesData.baseStats.hp, monster.stats.maxHp],
              ['ATK', speciesData.baseStats.attack, baseAtk],
              ['DEF', speciesData.baseStats.defense, baseDef],
              ['SPD', speciesData.baseStats.speed, baseSpd],
              ['SPC', speciesData.baseStats.special, baseSpecial],
            ] as [string, number, number][]).map(([label, base, current]) => (
              <div key={label} className="bg-background/40 rounded p-1">
                <p className="text-[8px] text-muted-foreground">{label}</p>
                <p className="font-mono">{base}</p>
                <p className="font-mono text-[9px] text-green-400">+{Math.max(0, current - base)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Matchups */}
        <div className="bg-muted/30 rounded-lg p-2">
          <p className="text-[9px] text-muted-foreground uppercase mb-1">Matchups</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
            {elementStrong.length > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-green-400">▲</span>
                <span className="text-muted-foreground">Elem:</span>
                <span className="capitalize text-green-400">{elementStrong.join(', ')}</span>
              </div>
            )}
            {elementWeak.length > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-red-400">▼</span>
                <span className="text-muted-foreground">Elem:</span>
                <span className="capitalize text-red-400">{elementWeak.join(', ')}</span>
              </div>
            )}
            {classStrong.length > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-green-400">▲</span>
                <span className="text-muted-foreground">Class:</span>
                <span className="capitalize text-green-400">{classStrong.join(', ')}</span>
              </div>
            )}
            {classWeak.length > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-red-400">▼</span>
                <span className="text-muted-foreground">Class:</span>
                <span className="capitalize text-red-400">{classWeak.join(', ')}</span>
              </div>
            )}
          </div>
        </div>
      </TabsContent>

      {/* ============ ABILITIES ============ */}
      <TabsContent value="abilities" className="space-y-2 mt-0">
        <p className="text-[10px] text-muted-foreground">
          Species passives are always active. Unlocked hidden abilities can be toggled — changes save instantly.
        </p>
        {abilities.map(ability => {
          const unlocked = isAbilityUnlocked(comboId, ability, ctx);
          const enabled = unlocked && isAbilityEnabled(comboId, ability);
          return (
            <div
              key={ability.id}
              className={`rounded-lg p-2 border flex items-start gap-2 ${
                unlocked ? 'bg-muted/30 border-border' : 'bg-muted/10 border-dashed border-border/60'
              }`}
            >
              <span className="text-base leading-none mt-0.5">{unlocked ? ability.icon : '🔒'}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 flex-wrap">
                  <p className={`text-xs font-bold ${unlocked ? '' : 'text-muted-foreground'}`}>{ability.name}</p>
                  <span className="text-[8px] px-1 rounded-full bg-muted uppercase text-muted-foreground">
                    {ability.source === 'species' ? 'passive' : 'hidden'}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-snug">{ability.description}</p>
                {!unlocked && ability.unlockHint && (
                  <p className="text-[10px] text-amber-500 mt-0.5">🔓 {ability.unlockHint}</p>
                )}
              </div>
              {unlocked && ability.toggleable ? (
                <Switch
                  checked={enabled}
                  onCheckedChange={v => { setAbilityEnabled(comboId, ability.id, v); }}
                  aria-label={`Toggle ${ability.name}`}
                />
              ) : unlocked ? (
                <span className="text-[9px] text-green-400 whitespace-nowrap">Always on</span>
              ) : creative ? (
                <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => grantAbility(comboId, ability.id)}>
                  Grant
                </Button>
              ) : null}
            </div>
          );
        })}
      </TabsContent>

      {/* ============ FORMS ============ */}
      <TabsContent value="forms" className="space-y-2 mt-0">
        <p className="text-[10px] text-muted-foreground">
          Pick the appearance used everywhere for this monster. Locked forms show how to obtain them.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {FORMS.map(form => {
            const unlocked = isFormUnlocked(comboId, form);
            const active = profile.activeForm === form.id && unlocked;
            return (
              <div
                key={form.id}
                className={`rounded-lg p-2 border text-center ${
                  active ? 'bg-primary/10 border-primary' : unlocked ? 'bg-muted/30 border-border' : 'bg-muted/10 border-dashed border-border/60'
                }`}
              >
                <div className="flex justify-center mb-1" style={{ filter: unlocked ? form.spriteFilter : 'grayscale(1) opacity(0.5)' }}>
                  <MonsterSprite species={monster.species} element={monster.element} classType={monster.class} size={48} animated={false} />
                </div>
                <p className="text-xs font-bold">{form.icon} {form.name}</p>
                <p className="text-[10px] text-muted-foreground leading-snug">{form.description}</p>
                {form.id === 'shiny' && (
                  <p className={`text-[10px] mt-0.5 ${unlocked ? 'text-green-400' : 'text-muted-foreground'}`}>
                    {unlocked ? '✓ Shiny unlocked' : 'Shiny not yet unlocked'}
                  </p>
                )}
                {!unlocked && form.unlockHint && (
                  <p className="text-[10px] text-amber-500 mt-0.5">🔓 {form.unlockHint}</p>
                )}
                <div className="mt-1 flex gap-1 justify-center">
                  {unlocked ? (
                    <Button
                      size="sm"
                      variant={active ? 'secondary' : 'outline'}
                      className="h-6 text-[10px]"
                      disabled={active}
                      onClick={() => setActiveForm(comboId, form.id)}
                    >
                      {active ? 'Active' : 'Use'}
                    </Button>
                  ) : creative ? (
                    <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => unlockForm(comboId, form.id)}>
                      Unlock
                    </Button>
                  ) : null}
                  {creative && unlocked && !form.alwaysUnlocked && (
                    <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => lockForm(comboId, form.id)}>
                      Lock
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </TabsContent>

      {/* ============ KEYBINDS ============ */}
      <TabsContent value="keys" className="space-y-2 mt-0">
        <p className="text-[10px] text-muted-foreground">
          Keys are saved per character. Assigning a key that is already in use moves it to the new entry.
        </p>

        <div className="bg-muted/30 rounded-lg p-2 space-y-1">
          <p className="text-[9px] text-muted-foreground uppercase mb-1">Moves</p>
          {moves.length === 0 && <p className="text-[10px] text-muted-foreground">No moves learned yet.</p>}
          {moves.map(move => (
            <div key={move.id} className="flex items-center gap-2">
              <span className="text-xs flex-1 min-w-0 truncate">{move.name}</span>
              <Select value={monsterBinds[move.id] ?? NONE} onValueChange={v => applyMoveKey(move.id, v)}>
                <SelectTrigger className="h-6 w-20 text-[10px]">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent className="max-h-60 z-[200]">
                  <SelectItem value={NONE} className="text-[10px]">None</SelectItem>
                  {VALID_KEYBIND_KEYS.map(key => (
                    <SelectItem key={key} value={key} className="text-[10px]">{getKeyLabel(key)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        <div className="bg-muted/30 rounded-lg p-2 space-y-1">
          <p className="text-[9px] text-muted-foreground uppercase mb-1">Potions & consumables</p>
          {consumables.length === 0 && <p className="text-[10px] text-muted-foreground">No consumables carried.</p>}
          {consumables.map(item => (
            <div key={item.id} className="flex items-center gap-2">
              <span className="text-xs flex-1 min-w-0 truncate">{item.name}{item.quantity > 1 ? ` x${item.quantity}` : ''}</span>
              <Select
                value={profile.itemKeybinds[item.id] ?? NONE}
                onValueChange={v => (v === NONE ? clearItemKeybind(comboId, item.id) : setItemKeybind(comboId, item.id, v))}
              >
                <SelectTrigger className="h-6 w-20 text-[10px]">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent className="max-h-60 z-[200]">
                  <SelectItem value={NONE} className="text-[10px]">None</SelectItem>
                  {VALID_KEYBIND_KEYS.map(key => (
                    <SelectItem key={key} value={key} className="text-[10px]">{getKeyLabel(key)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );
}
