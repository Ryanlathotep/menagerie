/**
 * Max-level "everything unlocked" save fixture.
 *
 * Used by:
 *   - QA invariants that need to exercise endgame code paths
 *     (mastered moves, full-set equipment, deep inventory).
 *   - `window.__menagerie.loadMaxLevelSave()` for manual smoke testing.
 *   - The autobattle QA invariant as a stable, deterministic team source.
 *
 * NOT loaded into any player save automatically. Callers must dispatch
 * `LOAD_SAVE` explicitly.
 */
import type {
  SaveData,
  UnlockedMonster,
  Monster,
  SpeciesType,
  ClassType,
  ElementType,
  DungeonEntrance,
} from '@/game/types';
import {
  SPECIES_DATA,
  createAllThemedTowers,
  HOME_TOWER_ID,
} from '@/game/types';
import { createMonster } from '@/game/utils';
import {
  createEmptyEquipment,
  type EquipmentItem,
  type EquipmentSlot,
  type MonsterEquipment,
  CONSUMABLE_RECIPES,
} from '@/game/equipment';
import { getMonsterMoves } from '@/game/moves';

const ALL_SPECIES: SpeciesType[] = Object.keys(SPECIES_DATA) as SpeciesType[];
const ALL_ELEMENTS: ElementType[] = ['normal', 'fire', 'water', 'earth', 'air', 'void'];
const ALL_CLASSES: ClassType[] = ['normal', 'kinetic', 'energy', 'biological', 'chemical', 'political'];

const MAX_LEVEL = 100;

const ALL_SLOTS: EquipmentSlot[] = [
  'helmet', 'armor', 'gloves', 'boots',
  'mainHand', 'offHand', 'accessory', 'back',
];

/**
 * Cheap gear factory — we only need shape + stats + level so equip-checks
 * and set-bonus math run through their real code paths without the fixture
 * having to know about crafting internals.
 */
function fixtureGear(slot: EquipmentSlot, index: number, comboId: string): EquipmentItem {
  return {
    id: `qa_gear_${comboId}_${slot}_${index}`,
    name: `QA ${slot} #${index}`,
    slot,
    rarity: 'legendary',
    level: MAX_LEVEL,
    icon: slot,
    stats: {
      maxHp: 50,
      attack: 25,
      defense: 25,
      speed: 10,
      dodge: 10,
      special: 25,
      stamina: 20,
    },
  } as unknown as EquipmentItem;
}

function fullEquipmentFor(comboId: string): MonsterEquipment {
  const eq = createEmptyEquipment();
  ALL_SLOTS.forEach((slot, i) => {
    (eq as unknown as Record<string, EquipmentItem>)[slot] = fixtureGear(slot, i, comboId);
  });
  return eq;
}

/**
 * Build the moveMastery map for a monster with EVERY currently-known move at
 * the Omega tier + AoE unlocked + 999 uses (well past any threshold).
 */
function omegaMasteryFor(
  species: SpeciesType,
  element: ElementType,
  classType: ClassType,
): NonNullable<Monster['moveMastery']> {
  const moves = getMonsterMoves(species, element, classType, MAX_LEVEL);
  const out: NonNullable<Monster['moveMastery']> = {};
  for (const m of moves) {
    out[m.id] = { uses: 999, currentTier: 'omega', hasAoE: true };
  }
  return out;
}

function comboIdOf(species: SpeciesType, element: ElementType, classType: ClassType): string {
  return `${species}_${element}_${classType}`;
}

/**
 * Build every combo (species × element × class) as an UnlockedMonster at
 * MAX_LEVEL with full mastery + equipment. That's 20 × 6 × 6 = 720 entries,
 * which is heavy but still cheap to serialize/deserialize in-memory.
 */
function buildAllUnlockedMonsters(): UnlockedMonster[] {
  const out: UnlockedMonster[] = [];
  for (const species of ALL_SPECIES) {
    for (const element of ALL_ELEMENTS) {
      for (const classType of ALL_CLASSES) {
        const comboId = comboIdOf(species, element, classType);
        out.push({
          comboId,
          species,
          element,
          classType,
          level: MAX_LEVEL,
          experience: 0,
          moveMastery: omegaMasteryFor(species, element, classType),
          equipment: fullEquipmentFor(comboId),
        });
      }
    }
  }
  return out;
}

/**
 * A rotating tier-5 slate of spare gear so equipment-inventory tests have
 * material to work with beyond what's equipped on monsters.
 */
function buildStoredEquipment(): EquipmentItem[] {
  const items: EquipmentItem[] = [];
  for (let i = 0; i < 3; i++) {
    for (const slot of ALL_SLOTS) {
      items.push(fixtureGear(slot, 100 + i, 'store'));
    }
  }
  return items;
}

/** One of every consumable + a stack of portal-related utility items. */
function buildStoredItems() {
  const items = CONSUMABLE_RECIPES.map((r, i) => ({
    id: `${r.resultId}_qa_${i}`,
    name: r.name,
    type: 'potion' as const,
    quantity: 5,
    value: 0,
    effect: r.effect,
  }));
  items.push({
    id: 'town_portal_scroll_qa',
    name: 'Town Portal Scroll',
    type: 'potion' as const,
    quantity: 5,
    value: 0,
    effect: 'town_portal',
  });
  for (let i = 0; i < 3; i++) {
    items.push({
      id: `portal_stairs_kit_qa_${i}`,
      name: 'Portal Stairs Kit',
      type: 'potion' as const,
      quantity: 1,
      value: 0,
      // effect is a runtime string, but the shared ConsumableEffect union
      // doesn't (yet) list 'place_portal_stairs' — cast to keep the runtime
      // wiring honest without leaking a fixture-only type into the shared union.
      effect: 'place_portal_stairs' as unknown as (typeof items)[number]['effect'],
    });
  }
  return items;
}

function buildDungeonEntrances(): Record<string, DungeonEntrance> {
  // Reuse the canonical themed tower registry so every element/class/species
  // tower is present + discovered + battle-tested to deep floors.
  const base = createAllThemedTowers();
  const out: Record<string, DungeonEntrance> = {};
  for (const [id, e] of Object.entries(base)) {
    out[id] = { ...e, discovered: true, deepestFloor: 100 };
  }
  // Guarantee HOME_TOWER is present + discovered even if createAllThemedTowers
  // ever omits it (defensive against future refactors).
  if (!out[HOME_TOWER_ID]) {
    out[HOME_TOWER_ID] = {
      id: HOME_TOWER_ID,
      worldX: 0,
      worldY: -3,
      seed: 1337,
      deepestFloor: 100,
      difficulty: 1,
      name: 'Tower of the Infinite',
      discovered: true,
      isHome: true,
    };
  }
  return out;
}

/**
 * Build a fully-unlocked SaveData snapshot. Deterministic given the same
 * `seed` (only affects a small handful of tie-breakers today; kept as an
 * arg so future randomised loot in the fixture stays reproducible).
 */
export function buildMaxLevelSave(_seed: number = 1): SaveData {
  const unlockedMonsters = buildAllUnlockedMonsters();
  const unlockedRecipes = CONSUMABLE_RECIPES.map(r => r.id);
  return {
    unlockedSpecies: [...ALL_SPECIES],
    unlockedCombos: unlockedMonsters.map(u => u.comboId),
    unlockedMonsters,
    highestFloor: 100,
    totalRuns: 999,
    totalEnemiesDefeated: 99999,
    gold: 999999,
    materials: {
      wood: 9999,
      stone: 9999,
      copper_ore: 999,
      iron_ore: 999,
      gold_ore: 999,
      mithril_ore: 999,
      healing_herb: 999,
      stamina_root: 999,
      mana_blossom: 999,
      antidote_leaf: 999,
      revive_moss: 999,
      golden_ginseng: 999,
      phoenix_flower: 999,
      panacea_petal: 999,
      miracle_lotus: 999,
      fire_pepper: 999,
      ice_mint: 999,
    },
    storedEquipment: buildStoredEquipment(),
    storedItems: buildStoredItems(),
    unlockedRecipes,
    dungeonEntrances: buildDungeonEntrances(),
    tools: {
      pickaxe: 'mithril',
      shovel: 'mithril',
    } as SaveData['tools'],
    itemWorldTowerState: {},
    taughtMoves: {},
  } as SaveData;
}

/**
 * A balanced 4-monster party built from the max-level save: tank, DPS,
 * support, ranger. Full HP/stamina; equipment is bound-cloned from the
 * UnlockedMonster records so run + persist round-trips work.
 */
export function buildMaxLevelParty(save: SaveData): Monster[] {
  const picks: Array<{ species: SpeciesType; element: ElementType; classType: ClassType }> = [
    { species: 'golem',    element: 'earth', classType: 'kinetic' },      // tank
    { species: 'dragon',   element: 'fire',  classType: 'kinetic' },      // dps
    { species: 'wisp',     element: 'air',   classType: 'energy' },       // support
    { species: 'crow',     element: 'void',  classType: 'political' },    // ranger
  ];
  const party: Monster[] = [];
  for (const p of picks) {
    const comboId = comboIdOf(p.species, p.element, p.classType);
    const unlocked = save.unlockedMonsters.find(u => u.comboId === comboId);
    const m = createMonster(
      p.species,
      p.classType,
      p.element,
      MAX_LEVEL,
      unlocked?.equipment,
      unlocked?.experience ?? 0,
      unlocked?.moveMastery,
    );
    party.push(m);
  }
  return party;
}

/** Handy for tests: two distinct 4-monster teams built from the fixture. */
export function buildTwoMaxLevelTeams(save: SaveData): { teamA: Monster[]; teamB: Monster[] } {
  const teamA = buildMaxLevelParty(save);
  // Rotate species so team B is different enough to make combat interesting.
  const teamB: Monster[] = [
    createMonster('skeleton', 'kinetic',    'void',  MAX_LEVEL, undefined, 0, omegaMasteryFor('skeleton', 'void',  'kinetic')),
    createMonster('shark',    'biological', 'water', MAX_LEVEL, undefined, 0, omegaMasteryFor('shark',    'water', 'biological')),
    createMonster('mushroom', 'chemical',   'earth', MAX_LEVEL, undefined, 0, omegaMasteryFor('mushroom', 'earth', 'chemical')),
    createMonster('jellyfish','energy',     'water', MAX_LEVEL, undefined, 0, omegaMasteryFor('jellyfish','water', 'energy')),
  ];
  return { teamA, teamB };
}
