// Per-character customization: hidden abilities, alternate forms (shiny etc.)
// and per-character item keybinds.
//
// All of this is keyed by comboId (species_element_class) so it follows the
// monster across runs, exactly like UnlockedMonster progress does. Everything
// is persisted to localStorage on every edit and broadcast so open panels
// re-render immediately.

import { SpeciesType, ElementType, ClassType, SPECIES_DATA } from './types';

const STORAGE_KEY = 'menagerie.character-customization.v1';
const EVENT_NAME = 'menagerie:character-customization-changed';

export function comboIdOf(species: SpeciesType, element: ElementType, classType: ClassType): string {
  return `${species}_${element}_${classType}`;
}

// ============= ABILITIES =============

export type AbilitySource = 'species' | 'hidden';

export interface AbilityDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  source: AbilitySource;
  /** Can the player turn this on/off? Species passives are always on. */
  toggleable: boolean;
  /** How the ability is obtained (shown when still locked). */
  unlockHint?: string;
  /** Auto-unlock rule. Return true when the monster qualifies. */
  isUnlocked?: (ctx: AbilityContext) => boolean;
  /** Enabled by default once unlocked. */
  defaultEnabled?: boolean;
}

export interface AbilityContext {
  species: SpeciesType;
  element: ElementType;
  classType: ClassType;
  level: number;
}

/** Species passive, surfaced as an always-on ability entry. */
export function speciesAbility(species: SpeciesType): AbilityDef {
  const data = SPECIES_DATA[species];
  return {
    id: `species:${species}`,
    name: data.passiveAbility,
    description: data.passiveDescription,
    icon: '✨',
    source: 'species',
    toggleable: false,
    defaultEnabled: true,
    isUnlocked: () => true,
  };
}

/**
 * Hidden abilities. Add new entries here — the character menu, save format and
 * toggles all pick them up automatically, and any ability the player has not
 * met the requirement for shows as locked with its hint.
 */
export const HIDDEN_ABILITIES: AbilityDef[] = [
  {
    id: 'hidden:veterans_grit',
    name: "Veteran's Grit",
    description: 'Takes 10% less damage while below half HP.',
    icon: '🛡️',
    source: 'hidden',
    toggleable: true,
    unlockHint: 'Reach level 10 with this monster',
    isUnlocked: ctx => ctx.level >= 10,
    defaultEnabled: true,
  },
  {
    id: 'hidden:second_wind',
    name: 'Second Wind',
    description: 'Recovers 5 extra stamina at the start of each floor.',
    icon: '🌬️',
    source: 'hidden',
    toggleable: true,
    unlockHint: 'Reach level 25 with this monster',
    isUnlocked: ctx => ctx.level >= 25,
    defaultEnabled: true,
  },
  {
    id: 'hidden:elemental_echo',
    name: 'Elemental Echo',
    description: 'Matching elemental terrain grants +5% move power.',
    icon: '🌀',
    source: 'hidden',
    toggleable: true,
    unlockHint: 'Reach level 50 with this monster',
    isUnlocked: ctx => ctx.level >= 50,
    defaultEnabled: false,
  },
];

/** Full ability list for a monster: species passive first, then hidden ones. */
export function abilitiesFor(ctx: AbilityContext): AbilityDef[] {
  return [speciesAbility(ctx.species), ...HIDDEN_ABILITIES];
}

// ============= FORMS =============

export interface FormDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  /** CSS filter applied to the sprite for this form. */
  spriteFilter?: string;
  /** True for the fallback form every monster owns. */
  alwaysUnlocked?: boolean;
  unlockHint?: string;
}

/**
 * Alternate forms. Add entries here for future variants (albino, corrupted,
 * seasonal...) — the menu, unlock tracking and persistence need no changes.
 */
export const FORMS: FormDef[] = [
  {
    id: 'normal',
    name: 'Normal',
    description: 'The standard appearance.',
    icon: '🎨',
    alwaysUnlocked: true,
  },
  {
    id: 'shiny',
    name: 'Shiny',
    description: 'Rare sparkling coloration with a subtle glow.',
    icon: '🌟',
    spriteFilter: 'hue-rotate(150deg) saturate(1.6) brightness(1.12)',
    unlockHint: 'Recruit a shiny of this monster',
  },
];

export function formById(id: string): FormDef {
  return FORMS.find(f => f.id === id) ?? FORMS[0];
}

// ============= PROFILE STORE =============

export interface CharacterProfile {
  /** abilityId -> enabled. Missing = use the ability default. */
  abilities: Record<string, boolean>;
  /** Hidden abilities granted manually (in addition to rule-based unlocks). */
  grantedAbilities: string[];
  /** Form ids the player owns for this monster. 'normal' is implicit. */
  unlockedForms: string[];
  activeForm: string;
  /** itemId -> key, for consumable hotkeys bound per character. */
  itemKeybinds: Record<string, string>;
}

export const EMPTY_PROFILE: CharacterProfile = {
  abilities: {},
  grantedAbilities: [],
  unlockedForms: ['normal'],
  activeForm: 'normal',
  itemKeybinds: {},
};

type Store = Record<string, CharacterProfile>;

let cache: Store | null = null;

function readStore(): Store {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    cache = {};
  }
  return cache!;
}

function writeStore(store: Store) {
  cache = store;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (e) {
    console.error('Failed to save character customization:', e);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  }
}

export function getProfile(comboId: string): CharacterProfile {
  const stored = readStore()[comboId];
  return stored ? { ...EMPTY_PROFILE, ...stored } : { ...EMPTY_PROFILE };
}

function updateProfile(comboId: string, patch: Partial<CharacterProfile>) {
  const store = { ...readStore() };
  store[comboId] = { ...getProfile(comboId), ...patch };
  writeStore(store);
}

export function onCustomizationChange(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => cb();
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}

// --- abilities ---

export function isAbilityUnlocked(comboId: string, ability: AbilityDef, ctx: AbilityContext): boolean {
  if (ability.source === 'species') return true;
  if (getProfile(comboId).grantedAbilities.includes(ability.id)) return true;
  return ability.isUnlocked ? ability.isUnlocked(ctx) : false;
}

export function isAbilityEnabled(comboId: string, ability: AbilityDef): boolean {
  const stored = getProfile(comboId).abilities[ability.id];
  if (stored !== undefined) return stored;
  return ability.defaultEnabled ?? true;
}

export function setAbilityEnabled(comboId: string, abilityId: string, enabled: boolean) {
  const profile = getProfile(comboId);
  updateProfile(comboId, { abilities: { ...profile.abilities, [abilityId]: enabled } });
}

export function grantAbility(comboId: string, abilityId: string) {
  const profile = getProfile(comboId);
  if (profile.grantedAbilities.includes(abilityId)) return;
  updateProfile(comboId, { grantedAbilities: [...profile.grantedAbilities, abilityId] });
}

/** Active ability ids for gameplay code to consult. */
export function activeAbilities(comboId: string, ctx: AbilityContext): string[] {
  return abilitiesFor(ctx)
    .filter(a => isAbilityUnlocked(comboId, a, ctx) && isAbilityEnabled(comboId, a))
    .map(a => a.id);
}

// --- forms ---

export function isFormUnlocked(comboId: string, form: FormDef): boolean {
  if (form.alwaysUnlocked) return true;
  return getProfile(comboId).unlockedForms.includes(form.id);
}

export function unlockForm(comboId: string, formId: string) {
  const profile = getProfile(comboId);
  if (profile.unlockedForms.includes(formId)) return;
  updateProfile(comboId, { unlockedForms: [...profile.unlockedForms, formId] });
}

export function lockForm(comboId: string, formId: string) {
  const profile = getProfile(comboId);
  updateProfile(comboId, {
    unlockedForms: profile.unlockedForms.filter(f => f !== formId),
    activeForm: profile.activeForm === formId ? 'normal' : profile.activeForm,
  });
}

export function isShinyUnlocked(comboId: string): boolean {
  return getProfile(comboId).unlockedForms.includes('shiny');
}

export function setActiveForm(comboId: string, formId: string) {
  updateProfile(comboId, { activeForm: formId });
}

export function activeFormFilter(comboId: string): string | undefined {
  const profile = getProfile(comboId);
  const form = formById(profile.activeForm);
  if (!isFormUnlocked(comboId, form)) return undefined;
  return form.spriteFilter;
}

// --- item keybinds ---

export function setItemKeybind(comboId: string, itemId: string, key: string) {
  const profile = getProfile(comboId);
  const next: Record<string, string> = {};
  // A key is unique per character, so drop any other item holding it.
  for (const [id, k] of Object.entries(profile.itemKeybinds)) {
    if (k !== key) next[id] = k;
  }
  next[itemId] = key;
  updateProfile(comboId, { itemKeybinds: next });
}

export function clearItemKeybind(comboId: string, itemId: string) {
  const profile = getProfile(comboId);
  const next = { ...profile.itemKeybinds };
  delete next[itemId];
  updateProfile(comboId, { itemKeybinds: next });
}

export function getItemForKey(comboId: string, key: string): string | null {
  const binds = getProfile(comboId).itemKeybinds;
  for (const [itemId, k] of Object.entries(binds)) {
    if (k === key) return itemId;
  }
  return null;
}
