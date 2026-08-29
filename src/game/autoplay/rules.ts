// Autoplay behaviour engine.
//
// A tiny, pure if/then rule engine that decides what an automated monster
// should do on its turn. Auto-Hunt / Auto-Search / Auto-Harvest all feed it a
// snapshot of the situation and act on the returned action. The Arena will
// reuse the exact same profiles to script team behaviour, so nothing in here
// may depend on dungeon/overworld state types — only plain numbers and the
// element/class enums.

import { ElementType, ClassType, Monster } from '../types';
import { getElementMultiplier, getClassMultiplier } from '../combat';
import { Move } from '../moves';

// ───────────────────────────── Rule vocabulary ─────────────────────────────

export type AutoplayConditionKind =
  | 'always'
  | 'hp_below'
  | 'hp_above'
  | 'stamina_below'
  | 'enemy_within'
  | 'enemy_beyond'
  | 'enemy_resists_me'
  | 'enemy_weak_to_me'
  | 'enemy_level_above';

export interface AutoplayCondition {
  kind: AutoplayConditionKind;
  /** Threshold: percent for hp/stamina, tiles for range, levels for level. */
  value?: number;
}

export type AutoplayActionKind =
  | 'switch_best_matchup'
  | 'attack_ranged'
  | 'attack_melee'
  | 'attack_aoe'
  | 'attack_single'
  | 'attack_strongest'
  | 'attack_cheapest'
  | 'attack_pinned'
  | 'heal_item'
  | 'retreat'
  | 'stop_automation';

export interface AutoplayRule {
  id: string;
  enabled: boolean;
  condition: AutoplayCondition;
  action: AutoplayActionKind;
  /** Move name for `attack_pinned`. */
  moveName?: string;
}

/** What automation does when it walks into an enemy it can reach. */
export type AutoplayEngageMode = 'stop' | 'ask' | 'fight';

/** Tie-breaker applied to every attack ordering. */
export type AutoplayAoePreference = 'aoe' | 'single' | 'off';

export interface AutoplayProfile {
  /** Evaluated top-to-bottom; the first matching enabled rule wins. */
  rules: AutoplayRule[];
  engage: AutoplayEngageMode;
  /** Halt every automation loop when active HP drops below this percent. */
  stopHpPercent: number;
  /** Swap in the best-matchup party member before engaging. */
  switchBestMatchup: boolean;
  /** Prefer splash moves (default), single-target moves, or neither. */
  aoePreference: AutoplayAoePreference;
}

export const CONDITION_LABELS: Record<AutoplayConditionKind, string> = {
  always: 'Always',
  hp_below: 'My HP below %',
  hp_above: 'My HP above %',
  stamina_below: 'My stamina below %',
  enemy_within: 'Enemy within N tiles',
  enemy_beyond: 'Enemy farther than N tiles',
  enemy_resists_me: 'Enemy resists my type',
  enemy_weak_to_me: 'Enemy is weak to me',
  enemy_level_above: 'Enemy level above mine by N',
};

export const ACTION_LABELS: Record<AutoplayActionKind, string> = {
  switch_best_matchup: 'Switch to best matchup',
  attack_ranged: 'Attack with ranged move',
  attack_melee: 'Attack with melee move',
  attack_strongest: 'Attack with strongest move',
  attack_cheapest: 'Attack with cheapest move',
  attack_pinned: 'Attack with a specific move',
  heal_item: 'Use a healing item',
  retreat: 'Step away from the enemy',
  stop_automation: 'Stop automation',
};

/** Conditions that take a numeric threshold. */
export function conditionNeedsValue(kind: AutoplayConditionKind): boolean {
  return kind !== 'always' && kind !== 'enemy_resists_me' && kind !== 'enemy_weak_to_me';
}

// ───────────────────────────── Evaluation ─────────────────────────────

export interface AutoplayContext {
  hpPercent: number;        // 0-100
  staminaPercent: number;   // 0-100
  /** Manhattan distance to the enemy being considered. */
  distance: number;
  myElement: ElementType;
  myClass: ClassType;
  myLevel: number;
  enemyElement: ElementType;
  enemyClass: ClassType;
  enemyLevel: number;
  hasHealItem: boolean;
  /** True when a better-matchup party member is available to swap in. */
  canSwitch: boolean;
}

function conditionMatches(c: AutoplayCondition, ctx: AutoplayContext): boolean {
  const v = c.value ?? 0;
  switch (c.kind) {
    case 'always': return true;
    case 'hp_below': return ctx.hpPercent < v;
    case 'hp_above': return ctx.hpPercent > v;
    case 'stamina_below': return ctx.staminaPercent < v;
    case 'enemy_within': return ctx.distance <= v;
    case 'enemy_beyond': return ctx.distance > v;
    case 'enemy_resists_me':
      return getElementMultiplier(ctx.myElement, ctx.enemyElement) < 1
        || getClassMultiplier(ctx.myClass, ctx.enemyClass) < 1;
    case 'enemy_weak_to_me':
      return getElementMultiplier(ctx.myElement, ctx.enemyElement) > 1
        || getClassMultiplier(ctx.myClass, ctx.enemyClass) > 1;
    case 'enemy_level_above': return ctx.enemyLevel - ctx.myLevel > v;
    default: return false;
  }
}

/** Can this action actually be carried out right now? */
function actionAvailable(rule: AutoplayRule, ctx: AutoplayContext): boolean {
  if (rule.action === 'heal_item') return ctx.hasHealItem;
  if (rule.action === 'switch_best_matchup') return ctx.canSwitch;
  return true;
}

/**
 * First enabled rule whose condition matches AND whose action is currently
 * possible. Skipping impossible actions keeps a "heal below 50%" rule from
 * stalling the whole loop when there are no potions left.
 */
export function evaluateAutoplay(
  profile: AutoplayProfile,
  ctx: AutoplayContext,
): AutoplayRule | null {
  for (const rule of profile.rules) {
    if (!rule.enabled) continue;
    if (!conditionMatches(rule.condition, ctx)) continue;
    if (!actionAvailable(rule, ctx)) continue;
    return rule;
  }
  return null;
}

/**
 * Order affordable attack moves the way the action asks. Callers then walk the
 * list and fire the first move that can actually reach the target tile.
 */
export function orderMovesForAction(
  moves: Move[],
  action: AutoplayActionKind,
  pinnedName?: string,
): Move[] {
  const attacks = moves.filter(m => m.type === 'melee' || m.type === 'ranged' || m.power > 0);
  switch (action) {
    case 'attack_pinned': {
      const pinned = attacks.filter(m => m.name === pinnedName);
      return pinned.length > 0 ? pinned : [];
    }
    case 'attack_ranged': {
      const ranged = attacks.filter(m => m.type === 'ranged');
      const rest = attacks.filter(m => m.type !== 'ranged');
      return [...ranged.sort((a, b) => (b.power || 0) - (a.power || 0)), ...rest];
    }
    case 'attack_melee': {
      const melee = attacks.filter(m => m.type === 'melee');
      const rest = attacks.filter(m => m.type !== 'melee');
      return [...melee.sort((a, b) => (b.power || 0) - (a.power || 0)), ...rest];
    }
    case 'attack_cheapest':
      return [...attacks].sort((a, b) => (a.staminaCost || 0) - (b.staminaCost || 0));
    default:
      return [...attacks].sort((a, b) => (b.power || 0) - (a.power || 0));
  }
}

/**
 * Matchup score of `candidate` against `enemy` — higher is better. Used by the
 * "switch to best matchup" action and shared with the Arena strategy layer.
 */
export function matchupScore(candidate: Monster, enemy: Monster): number {
  const off = getElementMultiplier(candidate.element, enemy.element)
    * getClassMultiplier(candidate.class, enemy.class);
  const def = getElementMultiplier(enemy.element, candidate.element)
    * getClassMultiplier(enemy.class, candidate.class);
  const hpRatio = (candidate.stats.currentHp ?? 0) / Math.max(1, candidate.stats.maxHp);
  if (hpRatio <= 0) return -Infinity;
  return off / Math.max(0.25, def) + hpRatio * 0.5;
}

/**
 * Index of the party member with the best matchup against `enemy`, or null
 * when the current active monster is already the best pick.
 */
export function bestMatchupIndex(
  party: Monster[],
  activeIndex: number,
  enemy: Monster,
): number | null {
  let bestIdx = activeIndex;
  let bestScore = -Infinity;
  party.forEach((m, i) => {
    if (!m || (m.stats.currentHp ?? 0) <= 0) return;
    const score = matchupScore(m, enemy) + (i === activeIndex ? 0.15 : 0); // stickiness
    if (score > bestScore) { bestScore = score; bestIdx = i; }
  });
  return bestIdx === activeIndex ? null : bestIdx;
}

// ───────────────────────────── Persistence ─────────────────────────────

const STORAGE_KEY = 'menagerie.autoplay.v1';
export const AUTOPLAY_EVENT = 'menagerie:autoplay-changed';

let ruleSeq = 0;
export function newRule(partial: Partial<AutoplayRule> = {}): AutoplayRule {
  ruleSeq += 1;
  return {
    id: `rule_${Date.now().toString(36)}_${ruleSeq}`,
    enabled: true,
    condition: { kind: 'always' },
    action: 'attack_strongest',
    ...partial,
  };
}

export function defaultProfile(): AutoplayProfile {
  return {
    engage: 'fight',
    stopHpPercent: 30,
    switchBestMatchup: true,
    rules: [
      newRule({ condition: { kind: 'hp_below', value: 50 }, action: 'heal_item' }),
      newRule({ condition: { kind: 'enemy_resists_me' }, action: 'switch_best_matchup' }),
      newRule({ condition: { kind: 'enemy_beyond', value: 1 }, action: 'attack_ranged' }),
      newRule({ condition: { kind: 'always' }, action: 'attack_strongest' }),
    ],
  };
}

interface AutoplayStore {
  default: AutoplayProfile;
  byCombo: Record<string, AutoplayProfile>;
}

let cache: AutoplayStore | null = null;

function readStore(): AutoplayStore {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<AutoplayStore>) : {};
    cache = {
      default: { ...defaultProfile(), ...(parsed.default ?? {}) },
      byCombo: parsed.byCombo ?? {},
    };
  } catch {
    cache = { default: defaultProfile(), byCombo: {} };
  }
  return cache!;
}

function writeStore(store: AutoplayStore) {
  cache = store;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (e) {
    console.error('Failed to save autoplay profile:', e);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTOPLAY_EVENT));
  }
}

/** Per-character profile when one exists, otherwise the shared default. */
export function getAutoplayProfile(comboId?: string | null): AutoplayProfile {
  const store = readStore();
  const own = comboId ? store.byCombo[comboId] : undefined;
  const base = own ?? store.default;
  return { ...defaultProfile(), ...base, rules: base.rules ?? defaultProfile().rules };
}

export function hasOwnAutoplayProfile(comboId: string): boolean {
  return !!readStore().byCombo[comboId];
}

export function saveAutoplayProfile(comboId: string | null, profile: AutoplayProfile) {
  const store = readStore();
  if (comboId) {
    writeStore({ ...store, byCombo: { ...store.byCombo, [comboId]: profile } });
  } else {
    writeStore({ ...store, default: profile });
  }
}

export function clearAutoplayProfile(comboId: string) {
  const store = readStore();
  const next = { ...store.byCombo };
  delete next[comboId];
  writeStore({ ...store, byCombo: next });
}
