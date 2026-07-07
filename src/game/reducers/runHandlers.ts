// Reducer handlers for the three persistence-critical run lifecycle actions:
// START_RUN, END_RUN, FLEE_DUNGEON. Extracted from state.ts so that the
// memory-locked invariants (XP/mastery persistence, unified inventory
// mirroring, no-death-losses parity between END_RUN and FLEE_DUNGEON,
// pre-run unequip recovery) live in one focused file that's easier to audit
// and harder to regress.
//
// IMPORTANT: every behavioral rule here is covered by an invariant in
// src/dev/qaInvariants.ts. Do not change semantics without updating those.

import {
  GameState,
  GamePhase,
  Monster,
  InventoryItem,
  snapshotDungeonToEntrance,
} from '../types';
import {
  createEmptyEquipment,
  EquipmentItem,
  EquipmentSlot,
  MonsterEquipment,
  getRecipeFromEquipment,
  getConsumableRecipeFromItem,
} from '../equipment';
import { findNearestEmptyOverworldTile } from '../overworld';
import { persistRunPartyProgress } from '../state';

const EQUIPMENT_SLOTS: EquipmentSlot[] = [
  'helmet',
  'armor',
  'mainHand',
  'offHand',
  'gloves',
  'boots',
  'accessory',
  'back',
];

export interface StartRunAction {
  type: 'START_RUN';
  monster: Monster;
  party?: Monster[];
  preEquipped?: MonsterEquipment;
  partyPreEquipped?: MonsterEquipment[];
  withdrawnIds?: string[];
  preSelectedItems?: InventoryItem[];
  destination?: 'dungeon' | 'overworld';
}

export interface EndRunAction {
  type: 'END_RUN';
  victory: boolean;
}

export interface FleeDungeonAction {
  type: 'FLEE_DUNGEON';
}

export function handleStartRun(state: GameState, action: StartRunAction): GameState {
  // Remove withdrawn equipment from storage and mark as bound
  const remainingStorage = action.withdrawnIds
    ? state.saveData.storedEquipment.filter(item => !action.withdrawnIds!.includes(item.id))
    : state.saveData.storedEquipment;

  // Mark pre-equipped items as bound (they came from town storage)
  const boundPreEquipped: MonsterEquipment = action.preEquipped
    ? (Object.fromEntries(
        Object.entries(action.preEquipped).map(([slot, item]) => [
          slot,
          item ? { ...item, bound: true } : null,
        ])
      ) as MonsterEquipment)
    : createEmptyEquipment();

  // Unified inventory: run inventory is a live view of town storage.
  // Picking up items in a dungeon also adds to town storage and vice versa.
  // On run start we mirror whatever's in storedItems so the player has access
  // to everything they own.
  const startingInventory: InventoryItem[] = (state.saveData.storedItems || []).map(i => ({ ...i }));

  // Build full party
  const fullParty = action.party && action.party.length > 0 ? action.party : [action.monster];

  // Build equipment sets for each party member
  const fullPartyEquipment = action.partyPreEquipped && action.partyPreEquipped.length > 0
    ? action.partyPreEquipped.map(eq => {
        return Object.fromEntries(
          Object.entries(eq).map(([slot, item]) => [
            slot,
            item ? { ...item, bound: true } : null,
          ])
        ) as MonsterEquipment;
      })
    : [boundPreEquipped];

  // RECOVER UNEQUIPPED PERSISTED GEAR.
  // A monster brought into the run may carry equipment persisted on its
  // UnlockedMonster record (NOT in town storage). If the player unequipped
  // any of that gear in the Pre-Run screen, the item would be silently lost.
  // Compare each member's incoming persisted equipment against their new
  // selection and return any removed items to the shared equipment pool.
  const finalEquippedIds = new Set<string>();
  for (const eq of fullPartyEquipment) {
    for (const item of Object.values(eq)) {
      if (item) finalEquippedIds.add(item.id);
    }
  }
  const recoveredFromUnequip: EquipmentItem[] = [];
  for (const member of fullParty) {
    if (!member.equipment) continue;
    for (const item of Object.values(member.equipment)) {
      if (
        item &&
        !finalEquippedIds.has(item.id) &&
        !remainingStorage.some(s => s.id === item.id) &&
        !recoveredFromUnequip.some(r => r.id === item.id)
      ) {
        recoveredFromUnequip.push({ ...item, bound: undefined });
      }
    }
  }
  const mergedStorage = [...remainingStorage, ...recoveredFromUnequip];

  // Unified equipment inventory: same pattern as items.
  const startingEquipmentInventory: EquipmentItem[] = mergedStorage.map(i => ({ ...i }));

  // partyEffects matches party size
  const partyEffects = fullParty.map(() => ({ statusEffects: [] as any[], statModifiers: [] as any[] }));

  return {
    ...state,
    phase: action.destination || 'dungeon',
    run: {
      currentMonster: fullParty[0],
      party: fullParty,
      activePartyIndex: 0,
      dungeon: null,
      battle: null,
      gold: 0,
      experience: 0,
      itemsCollected: [],
      inventory: startingInventory,
      equipmentInventory: startingEquipmentInventory,
      partyEquipment: fullPartyEquipment,
      runMaterials: {},
      enemiesDefeated: 0,
      moveOrder: [],
      hiddenMoves: [],
      partyEffects,
      battleStats: undefined,
    },
    saveData: {
      ...state.saveData,
      totalRuns: state.saveData.totalRuns + 1,
      storedEquipment: mergedStorage,
    },
  };
}

export function handleEndRun(state: GameState, _action: EndRunAction): GameState {
  // Death no longer causes losses. Treat END_RUN like FLEE_DUNGEON:
  // preserve gold, materials, items, equipped gear, and unlocked recipes.
  // The only difference is the next phase and that the player is teleported
  // back to (0,0).
  if (!state.run) {
    return { ...state, phase: 'run_summary' };
  }

  // Run inventory IS town storage now (kept in sync via ADD/USE/DROP_ITEM).
  // Don't merge again or items will duplicate.
  const storedItems = state.saveData.storedItems || [];

  // Materials are already mirrored to saveData.materials at pickup time
  // (unified inventory — see inventoryReducer ADD_MATERIAL). Don't re-merge
  // run.runMaterials here or picked-up materials will double on END_RUN.
  const mergedMaterials = { ...state.saveData.materials };

  // Run gold is added to town gold (no loss on death).
  const newTownGold = (state.saveData.gold || 0) + state.run.gold;

  // Recipes unlock from any equipment seen this run.
  const newUnlockedRecipes = [...(state.saveData.unlockedRecipes || [])];
  const allSeenEquipment: EquipmentItem[] = [...state.run.equipmentInventory];
  if (state.run.partyEquipment) {
    for (const memberEquipment of state.run.partyEquipment) {
      for (const slot of EQUIPMENT_SLOTS) {
        const item = memberEquipment[slot];
        if (item) allSeenEquipment.push(item);
      }
    }
  }
  for (const item of allSeenEquipment) {
    const matchingRecipe = getRecipeFromEquipment(item);
    if (matchingRecipe && !newUnlockedRecipes.includes(matchingRecipe.id)) {
      newUnlockedRecipes.push(matchingRecipe.id);
    }
  }
  // Also unlock consumable recipes for items returned to town.
  for (const item of state.run.inventory) {
    if (item.type === 'potion') {
      const matchingRecipe = getConsumableRecipeFromItem(item);
      if (matchingRecipe && !newUnlockedRecipes.includes(matchingRecipe.id)) {
        newUnlockedRecipes.push(matchingRecipe.id);
      }
    }
  }

  // Persist level + XP + mastery + equipment for each party member.
  const updatedUnlockedMonsters = persistRunPartyProgress(state.saveData, state.run);

  // Update dungeon entrance depth tracking
  const activeDungeonId = typeof window !== 'undefined' ? localStorage.getItem('menagerie_active_dungeon_id') : null;
  const updatedDungeonEntrances = { ...(state.saveData.dungeonEntrances || {}) };
  if (activeDungeonId && updatedDungeonEntrances[activeDungeonId] && state.run.dungeon) {
    const currentFloor = state.run.dungeon.floor;
    const base = {
      ...updatedDungeonEntrances[activeDungeonId],
      deepestFloor: Math.max(updatedDungeonEntrances[activeDungeonId].deepestFloor || 0, currentFloor),
    };
    updatedDungeonEntrances[activeDungeonId] = snapshotDungeonToEntrance(base, state.run.dungeon);
  }

  // Respawn the overworld player at the nearest empty tile to the town (0,0)
  // so a wiped party reappears at home rather than where they fell.
  let updatedOverworld = state.saveData.overworldState;
  if (updatedOverworld) {
    const respawn = findNearestEmptyOverworldTile(updatedOverworld, 0, 0);
    updatedOverworld = {
      ...updatedOverworld,
      playerPosition: respawn,
    };
  }

  return {
    ...state,
    phase: 'run_summary',
    saveData: {
      ...state.saveData,
      highestFloor: state.run.dungeon
        ? Math.max(state.saveData.highestFloor, state.run.dungeon.floor)
        : state.saveData.highestFloor,
      totalEnemiesDefeated: state.saveData.totalEnemiesDefeated + state.run.enemiesDefeated,
      gold: newTownGold,
      materials: mergedMaterials,
      // Already mirrored throughout the run — don't append again.
      storedEquipment: state.saveData.storedEquipment,
      storedItems,
      unlockedMonsters: updatedUnlockedMonsters,
      unlockedRecipes: newUnlockedRecipes,
      dungeonEntrances: updatedDungeonEntrances,
      overworldState: updatedOverworld,
    },
  };
}

export function handleFleeDungeon(state: GameState, _action: FleeDungeonAction): GameState {
  // Flee safely - keep materials, gold, and items by storing them.
  // Equipment stays equipped to each party member (persisted onto UnlockedMonster).
  if (!state.run) return state;

  // Merge run materials with saved materials
  const mergedMaterials = { ...state.saveData.materials };
  for (const [materialId, quantity] of Object.entries(state.run.runMaterials)) {
    mergedMaterials[materialId] = (mergedMaterials[materialId] || 0) + quantity;
  }

  // Add run gold to town gold
  const newTownGold = (state.saveData.gold || 0) + state.run.gold;

  // Unified inventory: run.inventory IS already mirrored into storedItems.
  const storedItems = state.saveData.storedItems || [];

  // Canonical persist helper — same as END_RUN — keeps the two reducers
  // symmetric (mastery max-uses, XP, recruits, equipment fallback).
  const updatedUnlockedMonsters = persistRunPartyProgress(state.saveData, state.run);

  // Unlock recipes for any equipment seen this run.
  const newUnlockedRecipes = [...(state.saveData.unlockedRecipes || [])];
  const allFleeEquipment: EquipmentItem[] = [...state.run.equipmentInventory];
  for (const memberEquipment of state.run.partyEquipment) {
    for (const slot of EQUIPMENT_SLOTS) {
      const item = memberEquipment[slot];
      if (item) allFleeEquipment.push(item);
    }
  }
  for (const item of allFleeEquipment) {
    const matchingRecipe = getRecipeFromEquipment(item);
    if (matchingRecipe && !newUnlockedRecipes.includes(matchingRecipe.id)) {
      newUnlockedRecipes.push(matchingRecipe.id);
      console.log('[Recipe Unlock] Equipment:', item.name, '->', matchingRecipe.id);
    }
  }

  // Unlock consumable recipes for potions/items brought back
  for (const item of state.run.inventory) {
    if (item.type === 'potion') {
      const matchingRecipe = getConsumableRecipeFromItem(item);
      if (matchingRecipe && !newUnlockedRecipes.includes(matchingRecipe.id)) {
        newUnlockedRecipes.push(matchingRecipe.id);
        console.log('[Recipe Unlock] Consumable:', item.name, '->', matchingRecipe.id);
      }
    }
  }

  // Update dungeon entrance depth tracking
  const fleeDungeonId = typeof window !== 'undefined' ? localStorage.getItem('menagerie_active_dungeon_id') : null;
  const fleeRunOrigin = typeof window !== 'undefined' ? localStorage.getItem('menagerie_run_origin') : null;
  const fleeUpdatedEntrances = { ...(state.saveData.dungeonEntrances || {}) };
  if (fleeDungeonId && fleeUpdatedEntrances[fleeDungeonId] && state.run.dungeon) {
    const fleeFloor = state.run.dungeon.floor;
    const base = {
      ...fleeUpdatedEntrances[fleeDungeonId],
      deepestFloor: Math.max(fleeUpdatedEntrances[fleeDungeonId].deepestFloor || 0, fleeFloor),
    };
    fleeUpdatedEntrances[fleeDungeonId] = snapshotDungeonToEntrance(base, state.run.dungeon);
  }

  // If the run launched from the overworld, respawn near the dungeon entrance.
  let fleeUpdatedOverworld = state.saveData.overworldState;
  if (fleeRunOrigin === 'overworld' && fleeUpdatedOverworld && fleeDungeonId) {
    const entrance = fleeUpdatedEntrances[fleeDungeonId];
    if (entrance && typeof entrance.worldX === 'number' && typeof entrance.worldY === 'number') {
      const respawn = findNearestEmptyOverworldTile(fleeUpdatedOverworld, entrance.worldX + 1, entrance.worldY);
      fleeUpdatedOverworld = {
        ...fleeUpdatedOverworld,
        playerPosition: respawn,
      };
    }
  }

  const fleeNextPhase: GamePhase = fleeRunOrigin === 'overworld' ? 'overworld' : 'run_summary';

  return {
    ...state,
    phase: fleeNextPhase,
    saveData: {
      ...state.saveData,
      highestFloor: state.run.dungeon
        ? Math.max(state.saveData.highestFloor, state.run.dungeon.floor)
        : state.saveData.highestFloor,
      totalEnemiesDefeated: state.saveData.totalEnemiesDefeated + state.run.enemiesDefeated,
      gold: newTownGold,
      // Already mirrored throughout the run — don't append again.
      storedEquipment: state.saveData.storedEquipment,
      storedItems,
      materials: mergedMaterials,
      unlockedMonsters: updatedUnlockedMonsters,
      unlockedRecipes: newUnlockedRecipes,
      dungeonEntrances: fleeUpdatedEntrances,
      overworldState: fleeUpdatedOverworld,
    },
  };
}
