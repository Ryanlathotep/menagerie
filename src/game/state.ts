// Game state management with React context

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { 
  GameState, 
  GamePhase, 
  SaveData, 
  Monster,
  DungeonState,
  BattleState,
  SpeciesType,
  UnlockedMonster,
  InventoryItem,
  PartyEffects,
  HOME_TOWER_ID,
  createHomeTowerEntrance,
  createAllThemedTowers,
  snapshotDungeonToEntrance,
} from './types';
import { createEmptyEquipment, EquipmentItem, MonsterEquipment, EquipmentSlot, dismantleEquipment, getRecipeFromEquipment, getConsumableRecipeFromItem } from './equipment';
import type { PickaxeTier, ShovelTier } from './tools';
import { xpToNextLevel } from './combat';
import { calculateStats } from './utils';
import { findNearestEmptyOverworldTile, slimOverworldForSave } from './overworld';

// Starting monster - Normal Normal Slime
const STARTER_MONSTER = {
  comboId: 'slime_normal_normal',
  species: 'slime' as SpeciesType,
  element: 'normal' as const,
  classType: 'normal' as const,
  level: 1,
};

// Initial save data (stored in localStorage)
const DEFAULT_SAVE_DATA: SaveData = {
  unlockedSpecies: ['slime'], // Keep for backwards compat
  unlockedCombos: ['slime_water_biological'], // Legacy
  unlockedMonsters: [STARTER_MONSTER], // Start with biological water slime
  highestFloor: 0,
  totalRuns: 0,
  totalEnemiesDefeated: 0,
  gold: 0,                    // Town gold
  materials: {},              // Crafting materials
  storedEquipment: [],        // Equipment storage
  storedItems: [
    { id: 'town_portal_scroll', name: 'Town Portal Scroll', quantity: 1, type: 'potion', effect: 'town_portal', value: 0 },
  ],            // Town item storage (starter Town Portal Scroll)
  unlockedRecipes: [],        // Unlocked crafting recipes
  dungeonEntrances: createAllThemedTowers(), // Tower of the Infinite + element/class/species towers
  tools: {},                  // Singleton tools (pickaxe, etc.) - undefined until crafted
};

// Initial game state
const INITIAL_STATE: GameState = {
  phase: 'main_menu',
  run: null,
  saveData: DEFAULT_SAVE_DATA,
};

const EQUIPMENT_SLOTS: EquipmentSlot[] = ['helmet', 'armor', 'mainHand', 'offHand', 'gloves', 'boots', 'accessory', 'back'];

function stripBoundEquipment(equipment?: MonsterEquipment): MonsterEquipment | undefined {
  if (!equipment) return undefined;

  return Object.fromEntries(
    Object.entries(equipment).map(([slot, item]) => [
      slot,
      item ? { ...item, bound: undefined } : null,
    ])
  ) as MonsterEquipment;
}

function persistRunPartyProgress(saveData: SaveData, run: GameState['run']): SaveData['unlockedMonsters'] {
  if (!run) return saveData.unlockedMonsters;

  const updatedUnlockedMonsters = [...saveData.unlockedMonsters];

  run.party.forEach((partyMember, idx) => {
    const comboId = `${partyMember.species}_${partyMember.element}_${partyMember.class}`;
    const cleanedEquipment = stripBoundEquipment(run.partyEquipment[idx]);
    const existingIdx = updatedUnlockedMonsters.findIndex(m => m.comboId === comboId);

    if (existingIdx !== -1) {
      const existing = updatedUnlockedMonsters[existingIdx];
      const currentLevel = partyMember.level;
      const existingLevel = existing.level;
      const useCurrent = currentLevel >= existingLevel;

      // Merge mastery: keep highest uses per move
      const mergedMastery: typeof partyMember.moveMastery = { ...(existing.moveMastery || {}) };
      if (partyMember.moveMastery) {
        for (const [moveId, current] of Object.entries(partyMember.moveMastery)) {
          const prev = mergedMastery[moveId];
          if (!prev || (current?.uses ?? 0) > (prev.uses ?? 0)) {
            mergedMastery[moveId] = current;
          }
        }
      }

      updatedUnlockedMonsters[existingIdx] = {
        ...existing,
        level: Math.max(existingLevel, currentLevel),
        // If we leveled up, take current XP; otherwise keep the higher of the two
        experience: useCurrent
          ? (partyMember.experience ?? 0)
          : Math.max(existing.experience ?? 0, partyMember.experience ?? 0),
        moveMastery: mergedMastery,
        // Equipment: prefer current (bound to active monster), fall back to existing
        equipment: cleanedEquipment ?? existing.equipment,
      };
      return;
    }

    updatedUnlockedMonsters.push({
      comboId,
      species: partyMember.species,
      element: partyMember.element,
      classType: partyMember.class,
      level: partyMember.level,
      experience: partyMember.experience ?? 0,
      moveMastery: partyMember.moveMastery,
      equipment: cleanedEquipment,
    });
  });

  return updatedUnlockedMonsters;
}

export function buildProgressSnapshot(
  saveData: SaveData,
  run: GameState['run'],
  overworld?: import('./overworld').OverworldState,
): SaveData {
  const nextSaveData: SaveData = {
    ...saveData,
    unlockedMonsters: persistRunPartyProgress(saveData, run),
  };

  if (run?.dungeon) {
    nextSaveData.highestFloor = Math.max(saveData.highestFloor, run.dungeon.floor);
    const activeDungeonId = typeof window !== 'undefined' ? localStorage.getItem('menagerie_active_dungeon_id') : null;
    if (activeDungeonId && nextSaveData.dungeonEntrances[activeDungeonId]) {
      const baseEntrance = {
        ...nextSaveData.dungeonEntrances[activeDungeonId],
        deepestFloor: Math.max(nextSaveData.dungeonEntrances[activeDungeonId].deepestFloor || 0, run.dungeon.floor),
      };
      nextSaveData.dungeonEntrances = {
        ...nextSaveData.dungeonEntrances,
        [activeDungeonId]: snapshotDungeonToEntrance(baseEntrance, run.dungeon),
      };
    }
  }

  if (overworld) {
    nextSaveData.overworldState = overworld;
    nextSaveData.dungeonEntrances = {
      ...nextSaveData.dungeonEntrances,
      ...(overworld.dungeonEntrances || {}),
    };
  }

  return nextSaveData;
}

// Action types
type GameAction =
  | { type: 'SET_PHASE'; phase: GamePhase }
  | { type: 'START_RUN'; monster: Monster; party?: Monster[]; preEquipped?: MonsterEquipment; partyPreEquipped?: MonsterEquipment[]; withdrawnIds?: string[]; preSelectedItems?: InventoryItem[]; destination?: 'dungeon' | 'overworld' }
  | { type: 'END_RUN'; victory: boolean }
  | { type: 'FLEE_DUNGEON' }  // Flee safely - keeps materials and equipment
  | { type: 'SET_DUNGEON'; dungeon: DungeonState }
  | { type: 'UPDATE_DUNGEON'; dungeon: Partial<DungeonState> }
  | { type: 'TOGGLE_DUNGEON_WAYPOINT'; x: number; y: number }
  | { type: 'RENAME_DUNGEON_WAYPOINT'; x: number; y: number; name: string }
  | { type: 'REMOVE_DUNGEON_WAYPOINT'; x: number; y: number }
  | { type: 'CLEAR_DUNGEON_WAYPOINTS' }

  | { type: 'DISARM_TRAP'; x: number; y: number; success: boolean }
  | { type: 'START_BATTLE'; enemy: Monster }
  | { type: 'UPDATE_BATTLE'; battle: Partial<BattleState> }
  | { type: 'END_BATTLE'; victory: boolean }
  | { type: 'UNLOCK_SPECIES'; species: SpeciesType }
  | { type: 'UNLOCK_COMBO'; comboId: string }
  | { type: 'UNLOCK_MONSTER'; monster: UnlockedMonster }
  | { type: 'UPDATE_PLAYER_MONSTER'; monster: Monster }
  | { type: 'ADD_GOLD'; amount: number }
  | { type: 'ADD_XP'; amount: number }
  | { type: 'ADD_ITEM'; item: InventoryItem }
  | { type: 'USE_ITEM'; itemId: string }
  | { type: 'DROP_ITEM'; itemId: string; quantity?: number }
  | { type: 'SET_MOVE_ORDER'; order: string[] }
  | { type: 'TOGGLE_HIDE_MOVE'; moveId: string }
  | { type: 'ADD_EQUIPMENT'; item: EquipmentItem }
  | { type: 'EQUIP_ITEM'; item: EquipmentItem; partyIndex?: number }
  | { type: 'UNEQUIP_ITEM'; slot: EquipmentSlot; partyIndex?: number }
  | { type: 'DROP_EQUIPMENT'; itemId: string }
  | { type: 'BULK_EQUIP'; partyIndex: number; equipment: MonsterEquipment; usedIds: string[] }
  | { type: 'ADD_MATERIAL'; materialId: string; quantity: number }
  | { type: 'USE_MATERIALS'; materials: { materialId: string; quantity: number }[] }
  | { type: 'STORE_EQUIPMENT'; item: EquipmentItem }
  | { type: 'WITHDRAW_EQUIPMENT'; itemId: string }
  | { type: 'SELL_EQUIPMENT'; itemId: string; price: number }  // Sell equipment for gold
  | { type: 'DISMANTLE_EQUIPMENT'; itemId: string }  // Break equipment into materials
  | { type: 'UNLOCK_RECIPE'; recipeId: string }      // Unlock a crafting recipe
  | { type: 'ADD_TOWN_GOLD'; amount: number }        // Add gold to town storage
  | { type: 'SPEND_TOWN_GOLD'; amount: number }      // Spend town gold
  | { type: 'STORE_ITEM'; item: InventoryItem }      // Store item in town
  | { type: 'SNAPSHOT_RUN_PROGRESS'; overworld?: import('./overworld').OverworldState }
  | { type: 'LOAD_SAVE'; saveData: SaveData }
  | { type: 'RESET_SAVE' }
  // Party management
  | { type: 'SWITCH_ACTIVE_MONSTER'; index: number }
  | { type: 'SWITCH_ACTIVE_IN_BATTLE'; index: number }  // Switch during battle (updates battle.playerMonster too)
  | { type: 'ADD_TO_PARTY'; monster: Monster }
  | { type: 'UPDATE_PARTY_MONSTER'; index: number; monster: Monster }
  | { type: 'ADD_PARTY_XP'; xpGained: number; excludeActiveIndex: number }
  | { type: 'REVIVE_PARTY_MEMBER'; index: number; hpPercent: number }  // Revive a fainted party member
  // Elevator - send party member back to town
  | { type: 'SEND_PARTY_MEMBER_TO_TOWN'; partyIndex: number }
  // Battle tracking
  | { type: 'UPDATE_BATTLE_STATS'; stats: Partial<{ turnsUsed: number; overkillDamage: number; statusEffectsApplied: number; criticalHits: number }> }
  | { type: 'RESET_BATTLE_STATS' }
  // Party effects (buffs/debuffs for each party member)
  | { type: 'SET_PARTY_EFFECTS'; partyIndex: number; effects: PartyEffects }
  | { type: 'CLEAR_ALL_PARTY_EFFECTS' }
  // Overworld
  | { type: 'UPDATE_OVERWORLD'; overworld: import('./overworld').OverworldState }
  // Tools (singleton, upgradeable in place — sets pickaxe/shovel to a specific tier)
  | { type: 'SET_PICKAXE_TIER'; tier: PickaxeTier }
  | { type: 'SET_SHOVEL_TIER'; tier: ShovelTier }
  | { type: 'SET_WORKSTATION_OWNED' };

// Reducer
function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SET_PHASE':
      return { ...state, phase: action.phase };

    case 'SNAPSHOT_RUN_PROGRESS':
      return {
        ...state,
        saveData: buildProgressSnapshot(state.saveData, state.run, action.overworld),
      };
      
    case 'START_RUN': {
      // Remove withdrawn equipment from storage and mark as bound
      const withdrawnItems = action.withdrawnIds 
        ? state.saveData.storedEquipment.filter(item => action.withdrawnIds!.includes(item.id))
        : [];
      const remainingStorage = action.withdrawnIds 
        ? state.saveData.storedEquipment.filter(item => !action.withdrawnIds!.includes(item.id))
        : state.saveData.storedEquipment;
      
      // Mark pre-equipped items as bound (they came from town storage)
      const boundPreEquipped: MonsterEquipment = action.preEquipped 
        ? Object.fromEntries(
            Object.entries(action.preEquipped).map(([slot, item]) => [
              slot,
              item ? { ...item, bound: true } : null
            ])
          ) as MonsterEquipment
        : createEmptyEquipment();
      
      // Unified inventory: the run inventory is a live view of town storage.
      // Anything the player picks up in the dungeon is also added to town
      // storage (and vice versa). On run start we just mirror whatever's in
      // storedItems so the player has access to everything they own. The old
      // pre-selection flow is preserved as a no-op (items aren't removed from
      // town anymore).
      const startingInventory: InventoryItem[] = (state.saveData.storedItems || []).map(i => ({ ...i }));
      const remainingStoredItems = state.saveData.storedItems || [];

      // Build full party
      const fullParty = action.party && action.party.length > 0
        ? action.party
        : [action.monster];
      
      // Build equipment sets for each party member
      const fullPartyEquipment = action.partyPreEquipped && action.partyPreEquipped.length > 0
        ? action.partyPreEquipped.map(eq => {
            // Mark all pre-equipped items as bound
            return Object.fromEntries(
              Object.entries(eq).map(([slot, item]) => [
                slot,
                item ? { ...item, bound: true } : null
              ])
            ) as MonsterEquipment;
          })
        : [boundPreEquipped];

      // RECOVER UNEQUIPPED PERSISTED GEAR.
      // A monster brought into the run may carry equipment persisted on its
      // UnlockedMonster record (NOT in town storage). If the player unequipped
      // any of that gear in the Pre-Run screen, the item would be silently
      // lost — it's no longer bound to the monster and was never in storage.
      // Compare each member's incoming persisted equipment against their new
      // selection and return any removed items to the shared equipment pool
      // so they're available again.
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

      // Unified equipment inventory: same pattern as items. The run's loose
      // equipment IS the town's stored equipment — both lists are mirrored
      // by ADD/EQUIP/UNEQUIP/BULK_EQUIP/DROP/STORE/WITHDRAW/SELL/DISMANTLE.
      // Pre-equipped items (action.withdrawnIds) are bound to monsters and
      // therefore removed from the shared pool.
      const startingEquipmentInventory: EquipmentItem[] = mergedStorage.map(i => ({ ...i }));
      
      // Ensure partyEffects matches party size
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
      
    case 'END_RUN': {
      // Death no longer causes losses. Treat END_RUN like FLEE_DUNGEON:
      // preserve gold, materials, items, equipped gear, and unlocked recipes.
      // The only difference is the next phase ('run_summary' / 'defeat' instead
      // of 'overworld') and that the player is teleported back to (0,0).
      if (!state.run) {
        return { ...state, phase: 'run_summary' };
      }

      // Unified equipment inventory: run.equipmentInventory IS already mirrored
      // into storedEquipment by the equipment reducers. Don't re-append or
      // items will duplicate. Just clear `bound` flags on whatever is loose.
      const equipmentToStore: EquipmentItem[] = [];

      // Run inventory IS town storage now (kept in sync via ADD/USE/DROP_ITEM).
      // Don't merge again or items will duplicate.
      const storedItems = state.saveData.storedItems || [];

      // Merge run materials with saved materials.
      const mergedMaterials = { ...state.saveData.materials };
      for (const [materialId, quantity] of Object.entries(state.run.runMaterials)) {
        mergedMaterials[materialId] = (mergedMaterials[materialId] || 0) + quantity;
      }

      // Run gold is added to town gold (no loss on death).
      const newTownGold = (state.saveData.gold || 0) + state.run.gold;

      // Recipes unlock from any equipment seen this run (loose loot already in
      // storedEquipment via mirroring + currently equipped on party members).
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
      let updatedDungeonEntrances = { ...(state.saveData.dungeonEntrances || {}) };
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
    
    case 'FLEE_DUNGEON': {
      // Flee safely - keep materials, gold, and items by storing them.
      // Equipment stays equipped to each party member (persisted onto UnlockedMonster).
      if (!state.run) return state;
      
      // Unified equipment inventory: loose loot is already mirrored into
      // storedEquipment via ADD/EQUIP/UNEQUIP/etc. Don't re-append.
      const slots: EquipmentSlot[] = ['helmet', 'armor', 'mainHand', 'offHand', 'gloves', 'boots', 'accessory', 'back'];
      const equipmentToStore: EquipmentItem[] = [];
      
      // Merge run materials with saved materials
      const mergedMaterials = { ...state.saveData.materials };
      for (const [materialId, quantity] of Object.entries(state.run.runMaterials)) {
        mergedMaterials[materialId] = (mergedMaterials[materialId] || 0) + quantity;
      }
      
      // Add run gold to town gold
      const newTownGold = (state.saveData.gold || 0) + state.run.gold;

      // Unified inventory: run.inventory IS already mirrored into storedItems
      // by ADD/USE/DROP_ITEM. Don't merge again or items will duplicate.
      const storedItems = state.saveData.storedItems || [];
      
      // Update unlocked monsters: persist level AND equipment for each party member.
      let updatedUnlockedMonsters = [...state.saveData.unlockedMonsters];
      state.run.party.forEach((partyMember, idx) => {
        const comboId = `${partyMember.species}_${partyMember.element}_${partyMember.class}`;
        const memberEquipment = state.run!.partyEquipment[idx];
        const cleanedEquipment: MonsterEquipment | undefined = memberEquipment
          ? Object.fromEntries(
              Object.entries(memberEquipment).map(([slot, item]) => [
                slot,
                item ? { ...item, bound: undefined } : null,
              ])
            ) as MonsterEquipment
          : undefined;
        
        const existingIdx = updatedUnlockedMonsters.findIndex(m => m.comboId === comboId);
        if (existingIdx !== -1) {
          updatedUnlockedMonsters[existingIdx] = {
            ...updatedUnlockedMonsters[existingIdx],
            level: Math.max(updatedUnlockedMonsters[existingIdx].level, partyMember.level),
            // Persist banked XP and move-mastery progress so fleeing a
            // dungeon doesn't reset partial progression.
            experience: partyMember.experience ?? 0,
            moveMastery: partyMember.moveMastery,
            equipment: cleanedEquipment,
          };
        }
      });
      
      // Unlock recipes for any equipment seen this run (loose loot already in
      // storedEquipment via mirroring + currently equipped).
      const newUnlockedRecipes = [...(state.saveData.unlockedRecipes || [])];
      const allFleeEquipment: EquipmentItem[] = [...state.run.equipmentInventory];
      for (const memberEquipment of state.run.partyEquipment) {
        for (const slot of slots) {
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
      let fleeUpdatedEntrances = { ...(state.saveData.dungeonEntrances || {}) };
      if (fleeDungeonId && fleeUpdatedEntrances[fleeDungeonId] && state.run.dungeon) {
        const fleeFloor = state.run.dungeon.floor;
        if (fleeFloor > (fleeUpdatedEntrances[fleeDungeonId].deepestFloor || 0)) {
          fleeUpdatedEntrances[fleeDungeonId] = {
            ...fleeUpdatedEntrances[fleeDungeonId],
            deepestFloor: fleeFloor,
          };
        }
      }
      
      // If the run was launched from the overworld, respawn the player at the
      // nearest empty tile adjacent to the dungeon entrance they came out of.
      let fleeUpdatedOverworld = state.saveData.overworldState;
      if (fleeRunOrigin === 'overworld' && fleeUpdatedOverworld && fleeDungeonId) {
        const entrance = fleeUpdatedEntrances[fleeDungeonId];
        if (entrance && typeof entrance.worldX === 'number' && typeof entrance.worldY === 'number') {
          // Try tiles around the entrance (entrance tile itself isn't standable).
          let respawn = findNearestEmptyOverworldTile(fleeUpdatedOverworld, entrance.worldX + 1, entrance.worldY);
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
          storedItems: storedItems,
          materials: mergedMaterials,
          unlockedMonsters: updatedUnlockedMonsters,
          unlockedRecipes: newUnlockedRecipes,
          dungeonEntrances: fleeUpdatedEntrances,
          overworldState: fleeUpdatedOverworld,
        },
      };
    }
      
    case 'SET_DUNGEON':
      if (!state.run) return state;
      return {
        ...state,
        run: { ...state.run, dungeon: action.dungeon },
      };
      
    case 'UPDATE_DUNGEON':
      if (!state.run || !state.run.dungeon) return state;
      return {
        ...state,
        run: {
          ...state.run,
          dungeon: { ...state.run.dungeon, ...action.dungeon },
        },
      };

    case 'TOGGLE_DUNGEON_WAYPOINT': {
      if (!state.run || !state.run.dungeon) return state;
      const existing = state.run.dungeon.compassWaypoints || [];
      const idx = existing.findIndex(p => p.x === action.x && p.y === action.y);
      const next = idx >= 0
        ? existing.filter((_, i) => i !== idx)
        : [...existing, { x: action.x, y: action.y }];
      return {
        ...state,
        run: {
          ...state.run,
          dungeon: { ...state.run.dungeon, compassWaypoints: next },
        },
      };
    }

    case 'RENAME_DUNGEON_WAYPOINT': {
      if (!state.run || !state.run.dungeon) return state;
      const existing = state.run.dungeon.compassWaypoints || [];
      const trimmed = action.name.trim().slice(0, 32);
      const next = existing.map(p =>
        p.x === action.x && p.y === action.y
          ? { ...p, name: trimmed || undefined }
          : p
      );
      return {
        ...state,
        run: {
          ...state.run,
          dungeon: { ...state.run.dungeon, compassWaypoints: next },
        },
      };
    }

    case 'REMOVE_DUNGEON_WAYPOINT': {
      if (!state.run || !state.run.dungeon) return state;
      const existing = state.run.dungeon.compassWaypoints || [];
      const next = existing.filter(p => !(p.x === action.x && p.y === action.y));
      return {
        ...state,
        run: { ...state.run, dungeon: { ...state.run.dungeon, compassWaypoints: next } },
      };
    }

    case 'CLEAR_DUNGEON_WAYPOINTS': {
      if (!state.run || !state.run.dungeon) return state;
      return {
        ...state,
        run: { ...state.run, dungeon: { ...state.run.dungeon, compassWaypoints: [] } },
      };
    }

    
    case 'DISARM_TRAP':
      if (!state.run || !state.run.dungeon) return state;
      const newTiles = state.run.dungeon.tiles.map((row, rowY) =>
        row.map((tile, tileX) => {
          if (tileX === action.x && rowY === action.y && tile.type === 'trap') {
            if (action.success) {
              // Successfully disarmed - convert to floor
              return { ...tile, type: 'floor' as const, trapType: undefined, triggered: undefined };
            } else {
              // Failed - trigger the trap
              return { ...tile, triggered: true };
            }
          }
          return tile;
        })
      );
      return {
        ...state,
        run: {
          ...state.run,
          dungeon: { ...state.run.dungeon, tiles: newTiles },
        },
      };
      
    case 'START_BATTLE':
      if (!state.run) return state;
      return {
        ...state,
        phase: 'battle',
        run: {
          ...state.run,
          battle: {
            playerMonster: state.run.currentMonster,
            enemyMonster: action.enemy,
            turn: state.run.currentMonster.stats.speed >= action.enemy.stats.speed ? 'player' : 'enemy',
            turnNumber: 1,
            log: [`A wild ${action.enemy.name} appeared!`],
          },
        },
      };
      
    case 'UPDATE_BATTLE':
      if (!state.run || !state.run.battle) return state;
      return {
        ...state,
        run: {
          ...state.run,
          battle: { ...state.run.battle, ...action.battle },
        },
      };
      
    case 'END_BATTLE':
      if (!state.run) return state;
      return {
        ...state,
        phase: action.victory ? 'dungeon' : 'defeat',
        run: {
          ...state.run,
          battle: null,
          enemiesDefeated: action.victory 
            ? state.run.enemiesDefeated + 1 
            : state.run.enemiesDefeated,
        },
      };
      
    case 'UNLOCK_SPECIES':
      if (state.saveData.unlockedSpecies.includes(action.species)) {
        return state;
      }
      return {
        ...state,
        saveData: {
          ...state.saveData,
          unlockedSpecies: [...state.saveData.unlockedSpecies, action.species],
        },
      };
    
    case 'UNLOCK_COMBO':
      if (state.saveData.unlockedCombos.includes(action.comboId)) {
        return state;
      }
      return {
        ...state,
        saveData: {
          ...state.saveData,
          unlockedCombos: [...state.saveData.unlockedCombos, action.comboId],
        },
      };
    
    case 'UNLOCK_MONSTER':
      // Check if already unlocked at same or higher level
      const existingIndex = state.saveData.unlockedMonsters.findIndex(
        m => m.comboId === action.monster.comboId
      );
      if (existingIndex !== -1) {
        // Update level if new level is higher.
        // CRITICAL: preserve any equipment already persisted on the existing
        // record. The action payload is built from a defeated wild enemy and
        // does NOT carry the player's equipped gear, so a naive replace would
        // wipe equipment off the player's matching party member.
        if (action.monster.level > state.saveData.unlockedMonsters[existingIndex].level) {
          const updatedMonsters = [...state.saveData.unlockedMonsters];
          const existing = updatedMonsters[existingIndex];
          updatedMonsters[existingIndex] = {
            ...action.monster,
            // Always keep the player's persisted equipment if any was set;
            // only fall back to the incoming payload's equipment when the
            // existing record had none.
            equipment: existing.equipment ?? action.monster.equipment,
          };
          return {
            ...state,
            saveData: {
              ...state.saveData,
              unlockedMonsters: updatedMonsters,
            },
          };
        }
        return state;
      }
      return {
        ...state,
        saveData: {
          ...state.saveData,
          unlockedMonsters: [...state.saveData.unlockedMonsters, action.monster],
        },
      };
      
    case 'UPDATE_PLAYER_MONSTER':
      if (!state.run) return state;
      // Also update the party array to keep stats in sync
      const syncedParty = state.run.party.map((member, idx) => 
        idx === state.run!.activePartyIndex ? action.monster : member
      );
      return {
        ...state,
        run: { 
          ...state.run, 
          currentMonster: action.monster,
          party: syncedParty,
        },
      };
      
    case 'ADD_GOLD':
      if (!state.run) return state;
      return {
        ...state,
        run: { ...state.run, gold: state.run.gold + action.amount },
      };
    
    case 'ADD_XP':
      if (!state.run) return state;
      return {
        ...state,
        run: { ...state.run, experience: state.run.experience + action.amount },
      };
    
    // Unified inventory: every mutation to run.inventory is mirrored into
    // saveData.storedItems so the run inventory and town storage are always
    // the same list. Picking up an item in a dungeon means it's also in town.
    case 'ADD_ITEM': {
      if (!state.run) return state;
      const addQty = action.item.quantity || 1;
      const incoming = { ...action.item, quantity: addQty };

      const stackInto = (list: InventoryItem[]): InventoryItem[] => {
        // Collapse any pre-existing duplicate entries with the same id
        // (defensive — older saves can have multiple stacks for one id).
        const collapsed: InventoryItem[] = [];
        for (const entry of list) {
          const idx = collapsed.findIndex(i => i.id === entry.id);
          if (idx !== -1) {
            collapsed[idx] = {
              ...collapsed[idx],
              quantity: collapsed[idx].quantity + entry.quantity,
            };
          } else {
            collapsed.push({ ...entry });
          }
        }
        const idx = collapsed.findIndex(i => i.id === incoming.id);
        if (idx !== -1) {
          collapsed[idx] = { ...collapsed[idx], quantity: collapsed[idx].quantity + addQty };
          return collapsed;
        }
        return [...collapsed, { ...incoming }];
      };

      return {
        ...state,
        run: { ...state.run, inventory: stackInto(state.run.inventory) },
        saveData: {
          ...state.saveData,
          storedItems: stackInto(state.saveData.storedItems || []),
        },
      };
    }

    case 'USE_ITEM': {
      if (!state.run) return state;
      const itemIndex = state.run.inventory.findIndex(i => i.id === action.itemId);
      if (itemIndex === -1) return state;
      const item = state.run.inventory[itemIndex];

      const decrement = (list: InventoryItem[]): InventoryItem[] => {
        const idx = list.findIndex(i => i.id === action.itemId);
        if (idx === -1) return list;
        const cur = list[idx];
        if (cur.quantity <= 1) return list.filter((_, i) => i !== idx);
        const next = [...list];
        next[idx] = { ...cur, quantity: cur.quantity - 1 };
        return next;
      };

      void item;
      return {
        ...state,
        run: { ...state.run, inventory: decrement(state.run.inventory) },
        saveData: {
          ...state.saveData,
          storedItems: decrement(state.saveData.storedItems || []),
        },
      };
    }

    case 'DROP_ITEM': {
      if (!state.run) return state;
      const dropIndex = state.run.inventory.findIndex(i => i.id === action.itemId);
      if (dropIndex === -1) return state;
      const dropItem = state.run.inventory[dropIndex];
      const dropQuantity = action.quantity ?? dropItem.quantity;

      const removeQty = (list: InventoryItem[]): InventoryItem[] => {
        const idx = list.findIndex(i => i.id === action.itemId);
        if (idx === -1) return list;
        const cur = list[idx];
        if (dropQuantity >= cur.quantity) return list.filter((_, i) => i !== idx);
        const next = [...list];
        next[idx] = { ...cur, quantity: cur.quantity - dropQuantity };
        return next;
      };

      return {
        ...state,
        run: { ...state.run, inventory: removeQty(state.run.inventory) },
        saveData: {
          ...state.saveData,
          storedItems: removeQty(state.saveData.storedItems || []),
        },
      };
    }
    
    case 'SET_MOVE_ORDER':
      if (!state.run) return state;
      return {
        ...state,
        run: { ...state.run, moveOrder: action.order },
      };
    
    case 'TOGGLE_HIDE_MOVE':
      if (!state.run) return state;
      const isHidden = state.run.hiddenMoves.includes(action.moveId);
      return {
        ...state,
        run: {
          ...state.run,
          hiddenMoves: isHidden
            ? state.run.hiddenMoves.filter(id => id !== action.moveId)
            : [...state.run.hiddenMoves, action.moveId],
        },
      };
    
    // Equipment management.
    // Unified equipment inventory: run.equipmentInventory and saveData.storedEquipment
    // are kept in sync — they are the same shared list, just exposed under two names so
    // existing callers (run UI vs town UI) keep working. Equipped items
    // (state.run.partyEquipment[*]) are bound to monsters and intentionally NOT in
    // either list while equipped.
    case 'ADD_EQUIPMENT': {
      if (!state.run) return state;
      return {
        ...state,
        run: {
          ...state.run,
          equipmentInventory: [...state.run.equipmentInventory, action.item],
        },
        saveData: {
          ...state.saveData,
          storedEquipment: [...state.saveData.storedEquipment, action.item],
        },
      };
    }
    
    case 'EQUIP_ITEM': {
      if (!state.run) return state;
      const equipIndex = action.partyIndex ?? state.run.activePartyIndex;
      const slot = action.item.slot;
      const currentEquipment = state.run.partyEquipment[equipIndex] || createEmptyEquipment();
      const previouslyEquipped = currentEquipment[slot];
      // Pull the equipped item out of the shared pool, push the displaced one back in.
      const newEquipmentInv = state.run.equipmentInventory.filter(i => i.id !== action.item.id);
      const newStored = state.saveData.storedEquipment.filter(i => i.id !== action.item.id);
      if (previouslyEquipped) {
        newEquipmentInv.push(previouslyEquipped);
        newStored.push(previouslyEquipped);
      }
      const newPartyEquipment = [...state.run.partyEquipment];
      newPartyEquipment[equipIndex] = {
        ...currentEquipment,
        [slot]: action.item,
      };
      return {
        ...state,
        run: {
          ...state.run,
          equipmentInventory: newEquipmentInv,
          partyEquipment: newPartyEquipment,
        },
        saveData: {
          ...state.saveData,
          storedEquipment: newStored,
        },
      };
    }
    
    case 'UNEQUIP_ITEM': {
      if (!state.run) return state;
      const unequipIndex = action.partyIndex ?? state.run.activePartyIndex;
      const unequipSlot = action.slot;
      const unequipCurrentEquipment = state.run.partyEquipment[unequipIndex] || createEmptyEquipment();
      const itemToUnequip = unequipCurrentEquipment[unequipSlot];
      if (!itemToUnequip) return state;
      const unequipNewPartyEquipment = [...state.run.partyEquipment];
      unequipNewPartyEquipment[unequipIndex] = {
        ...unequipCurrentEquipment,
        [unequipSlot]: null,
      };
      return {
        ...state,
        run: {
          ...state.run,
          equipmentInventory: [...state.run.equipmentInventory, itemToUnequip],
          partyEquipment: unequipNewPartyEquipment,
        },
        saveData: {
          ...state.saveData,
          storedEquipment: [...state.saveData.storedEquipment, itemToUnequip],
        },
      };
    }
    
    case 'BULK_EQUIP': {
      if (!state.run) return state;
      const bulkIndex = action.partyIndex;
      // Remove newly-equipped items from the shared pool.
      const usedSet = new Set(action.usedIds);
      const bulkNewInventory = state.run.equipmentInventory.filter(i => !usedSet.has(i.id));
      const bulkNewStored = state.saveData.storedEquipment.filter(i => !usedSet.has(i.id));
      // Push displaced previously-equipped items back into the pool.
      const bulkCurrentEquipment = state.run.partyEquipment[bulkIndex] || createEmptyEquipment();
      const slots: EquipmentSlot[] = ['helmet', 'armor', 'mainHand', 'offHand', 'gloves', 'boots', 'accessory', 'back'];
      for (const slot of slots) {
        const oldItem = bulkCurrentEquipment[slot];
        if (oldItem && !usedSet.has(oldItem.id)) {
          bulkNewInventory.push(oldItem);
          bulkNewStored.push(oldItem);
        }
      }
      const bulkNewPartyEquipment = [...state.run.partyEquipment];
      bulkNewPartyEquipment[bulkIndex] = action.equipment;
      return {
        ...state,
        run: {
          ...state.run,
          equipmentInventory: bulkNewInventory,
          partyEquipment: bulkNewPartyEquipment,
        },
        saveData: {
          ...state.saveData,
          storedEquipment: bulkNewStored,
        },
      };
    }
    
    case 'DROP_EQUIPMENT':
      if (!state.run) return state;
      return {
        ...state,
        run: {
          ...state.run,
          equipmentInventory: state.run.equipmentInventory.filter(i => i.id !== action.itemId),
        },
        saveData: {
          ...state.saveData,
          storedEquipment: state.saveData.storedEquipment.filter(i => i.id !== action.itemId),
        },
      };
    
    // Material management - add to run inventory (kept when fleeing, lost on death)
    case 'ADD_MATERIAL':
      if (!state.run) return state;
      return {
        ...state,
        run: {
          ...state.run,
          runMaterials: {
            ...state.run.runMaterials,
            [action.materialId]: (state.run.runMaterials[action.materialId] || 0) + action.quantity,
          },
        },
      };
    
    case 'USE_MATERIALS':
      const updatedMaterials = { ...state.saveData.materials };
      for (const mat of action.materials) {
        updatedMaterials[mat.materialId] = (updatedMaterials[mat.materialId] || 0) - mat.quantity;
        if (updatedMaterials[mat.materialId] <= 0) {
          delete updatedMaterials[mat.materialId];
        }
      }
      return {
        ...state,
        saveData: {
          ...state.saveData,
          materials: updatedMaterials,
        },
      };

    // Singleton tool upgrade — sets the pickaxe to a specific tier (replaces
    // any previous tier). Materials are spent separately via USE_MATERIALS.
    case 'SET_PICKAXE_TIER':
      return {
        ...state,
        saveData: {
          ...state.saveData,
          tools: {
            ...(state.saveData.tools || {}),
            pickaxe: action.tier,
          },
        },
      };

    // Same as pickaxe — singleton, in-place upgrade.
    case 'SET_SHOVEL_TIER':
      return {
        ...state,
        saveData: {
          ...state.saveData,
          tools: {
            ...(state.saveData.tools || {}),
            shovel: action.tier,
          },
        },
      };

    // Portable Workstation — singleton, no tier ladder. Just owned/not owned.
    case 'SET_WORKSTATION_OWNED':
      return {
        ...state,
        saveData: {
          ...state.saveData,
          tools: {
            ...(state.saveData.tools || {}),
            workstation: true,
          },
        },
      };
    
    case 'STORE_EQUIPMENT':
      // Mirror into the run's loose inventory when a run is active so newly
      // crafted/stored gear is immediately equippable.
      return {
        ...state,
        run: state.run
          ? {
              ...state.run,
              equipmentInventory: [...state.run.equipmentInventory, action.item],
            }
          : state.run,
        saveData: {
          ...state.saveData,
          storedEquipment: [...state.saveData.storedEquipment, action.item],
        },
      };
    
    case 'WITHDRAW_EQUIPMENT': {
      // Lists are unified, so withdrawal is a no-op functionally — but we
      // keep the action available for older callers.
      if (!state.run) return state;
      const alreadyInRun = state.run.equipmentInventory.some(i => i.id === action.itemId);
      if (alreadyInRun) return state;
      const withdrawItem = state.saveData.storedEquipment.find(i => i.id === action.itemId);
      if (!withdrawItem) return state;
      return {
        ...state,
        run: {
          ...state.run,
          equipmentInventory: [...state.run.equipmentInventory, withdrawItem],
        },
      };
    }
    
    case 'SELL_EQUIPMENT': {
      // Sell shared equipment for gold — remove from both views.
      const itemToSell = state.saveData.storedEquipment.find(i => i.id === action.itemId);
      if (!itemToSell) return state;
      return {
        ...state,
        run: state.run
          ? {
              ...state.run,
              equipmentInventory: state.run.equipmentInventory.filter(i => i.id !== action.itemId),
            }
          : state.run,
        saveData: {
          ...state.saveData,
          storedEquipment: state.saveData.storedEquipment.filter(i => i.id !== action.itemId),
          gold: (state.saveData.gold || 0) + action.price,
        },
      };
    }
    
    case 'DISMANTLE_EQUIPMENT': {
      // Break shared equipment into materials — remove from both views.
      const itemToDismantle = state.saveData.storedEquipment.find(i => i.id === action.itemId);
      if (!itemToDismantle) return state;
      
      const dismantleResult = dismantleEquipment(itemToDismantle);
      const updatedMaterials = { ...state.saveData.materials };
      for (const { materialId, quantity } of dismantleResult.materials) {
        updatedMaterials[materialId] = (updatedMaterials[materialId] || 0) + quantity;
      }
      return {
        ...state,
        run: state.run
          ? {
              ...state.run,
              equipmentInventory: state.run.equipmentInventory.filter(i => i.id !== action.itemId),
            }
          : state.run,
        saveData: {
          ...state.saveData,
          storedEquipment: state.saveData.storedEquipment.filter(i => i.id !== action.itemId),
          materials: updatedMaterials,
        },
      };
    }
    
    case 'ADD_TOWN_GOLD':
      return {
        ...state,
        saveData: {
          ...state.saveData,
          gold: (state.saveData.gold || 0) + action.amount,
        },
      };
    
    case 'SPEND_TOWN_GOLD': {
      const currentGold = state.saveData.gold || 0;
      if (currentGold < action.amount) return state;
      return {
        ...state,
        saveData: {
          ...state.saveData,
          gold: currentGold - action.amount,
        },
      };
    }
    
    case 'STORE_ITEM': {
      // Stack-by-id helper. Also collapses any pre-existing duplicate
      // entries with the same id (defensive — older saves may contain
      // multiple stacks for the same item id).
      const addQty = action.item.quantity || 1;
      const stackInto = (list: InventoryItem[]): InventoryItem[] => {
        const collapsed: InventoryItem[] = [];
        for (const entry of list) {
          const idx = collapsed.findIndex(i => i.id === entry.id);
          if (idx !== -1) {
            collapsed[idx] = {
              ...collapsed[idx],
              quantity: collapsed[idx].quantity + entry.quantity,
            };
          } else {
            collapsed.push({ ...entry });
          }
        }
        const idx = collapsed.findIndex(i => i.id === action.item.id);
        if (idx !== -1) {
          collapsed[idx] = {
            ...collapsed[idx],
            quantity: collapsed[idx].quantity + addQty,
          };
          return collapsed;
        }
        return [...collapsed, { ...action.item, quantity: addQty }];
      };

      // Unified inventory: mirror into both the run and town storage so
      // mid-run shop buys / workstation crafts stack instead of creating
      // a parallel entry that the run never sees.
      return {
        ...state,
        run: state.run
          ? { ...state.run, inventory: stackInto(state.run.inventory) }
          : state.run,
        saveData: {
          ...state.saveData,
          storedItems: stackInto(state.saveData.storedItems || []),
        },
      };
    }
    
    case 'UNLOCK_RECIPE': {
      const currentRecipes = state.saveData.unlockedRecipes || [];
      if (currentRecipes.includes(action.recipeId)) {
        return state; // Already unlocked
      }
      return {
        ...state,
        saveData: {
          ...state.saveData,
          unlockedRecipes: [...currentRecipes, action.recipeId],
        },
      };
    }
       
    case 'LOAD_SAVE':
      return {
        ...state,
        saveData: action.saveData,
      };
    
    case 'RESET_SAVE':
      localStorage.removeItem('monster-roguelike-save');
      return {
        ...INITIAL_STATE,
        saveData: DEFAULT_SAVE_DATA,
      };
    
    case 'UPDATE_OVERWORLD':
      return {
        ...state,
        saveData: {
          ...state.saveData,
          overworldState: action.overworld,
          // Sync dungeon entrances from overworld to save data
          dungeonEntrances: {
            ...(state.saveData.dungeonEntrances || {}),
            ...(action.overworld.dungeonEntrances || {}),
          },
        },
      };
      
    // Party management
    case 'SWITCH_ACTIVE_MONSTER': {
      if (!state.run || action.index < 0 || action.index >= state.run.party.length) return state;
      const newActiveMonster = state.run.party[action.index];
      if (newActiveMonster.stats.currentHp <= 0) return state; // Can't switch to fainted
      
      // Save current XP to outgoing monster, load incoming monster's XP
      const outgoingIndex = state.run.activePartyIndex;
      const updatedPartyWithXp = state.run.party.map((monster, idx) => 
        idx === outgoingIndex 
          ? { ...monster, experience: state.run!.experience }
          : monster
      );
      
      return {
        ...state,
        run: {
          ...state.run,
          currentMonster: newActiveMonster,
          activePartyIndex: action.index,
          party: updatedPartyWithXp,
          experience: newActiveMonster.experience || 0, // Load new monster's XP
        },
      };
    }
    
    // Switch active monster during battle - also updates the battle state
    case 'SWITCH_ACTIVE_IN_BATTLE': {
      if (!state.run || action.index < 0 || action.index >= state.run.party.length) return state;
      const switchedMonster = state.run.party[action.index];
      if (switchedMonster.stats.currentHp <= 0) return state; // Can't switch to fainted
      
      // Save current XP to outgoing monster, load incoming monster's XP
      const battleOutgoingIndex = state.run.activePartyIndex;
      const battleUpdatedPartyWithXp = state.run.party.map((monster, idx) => 
        idx === battleOutgoingIndex 
          ? { ...monster, experience: state.run!.experience }
          : monster
      );
      
      // If there's an active battle, update the playerMonster in battle state too
      const updatedBattle = state.run.battle ? {
        ...state.run.battle,
        playerMonster: switchedMonster,
        log: [...state.run.battle.log, `Go, ${switchedMonster.name}!`],
      } : null;
      
      return {
        ...state,
        run: {
          ...state.run,
          currentMonster: switchedMonster,
          activePartyIndex: action.index,
          party: battleUpdatedPartyWithXp,
          experience: switchedMonster.experience || 0, // Load new monster's XP
          battle: updatedBattle,
        },
      };
    }
    
    // Revive a fainted party member
    case 'REVIVE_PARTY_MEMBER': {
      if (!state.run || action.index < 0 || action.index >= state.run.party.length) return state;
      const targetMonster = state.run.party[action.index];
      if (targetMonster.stats.currentHp > 0) return state; // Already alive
      
      const revivedHp = Math.max(1, Math.floor(targetMonster.stats.maxHp * (action.hpPercent / 100)));
      const revivedMonster = {
        ...targetMonster,
        stats: {
          ...targetMonster.stats,
          currentHp: revivedHp,
        },
      };
      
      const partyWithRevived = [...state.run.party];
      partyWithRevived[action.index] = revivedMonster;
      
      return {
        ...state,
        run: {
          ...state.run,
          party: partyWithRevived,
          // Update currentMonster if reviving the active one
          currentMonster: action.index === state.run.activePartyIndex 
            ? revivedMonster 
            : state.run.currentMonster,
        },
      };
    }
    
    case 'ADD_TO_PARTY':
      if (!state.run) return state;
      if (state.run.party.length >= 6) return state; // Max party size
      return {
        ...state,
        run: {
          ...state.run,
          party: [...state.run.party, action.monster],
          partyEquipment: [...state.run.partyEquipment, createEmptyEquipment()], // Add empty equipment for new member
        },
      };
    
    case 'UPDATE_PARTY_MONSTER':
      if (!state.run || action.index < 0 || action.index >= state.run.party.length) return state;
      const updatedParty = [...state.run.party];
      updatedParty[action.index] = action.monster;
      return {
        ...state,
        run: {
          ...state.run,
          party: updatedParty,
          // Also update currentMonster if this is the active one
          currentMonster: action.index === state.run.activePartyIndex 
            ? action.monster 
            : state.run.currentMonster,
        },
      };
    
    // Award XP to non-active party members (passive gain) and level them up if appropriate
    case 'ADD_PARTY_XP': {
      if (!state.run) return state;
      const passiveXp = Math.floor(action.xpGained / 2); // Half XP for passive members
      if (passiveXp <= 0) return state;
      
      const xpUpdatedParty = state.run.party.map((monster, index) => {
        if (index === action.excludeActiveIndex) return monster; // Skip active monster
        if (monster.stats.currentHp <= 0) return monster; // Skip fainted monsters
        
        // Calculate new XP total for this monster
        const currentXp = monster.experience || 0;
        let newXp = currentXp + passiveXp;
        let newLevel = monster.level;
        let updatedStats = monster.stats;
        
        // Check for level up(s)
        let xpNeeded = xpToNextLevel(newLevel);
        while (newXp >= xpNeeded) {
          newXp -= xpNeeded;
          newLevel += 1;
          
          // Calculate new stats for the level
          const newBaseStats = calculateStats(monster.species, monster.class, newLevel);
          
          // Preserve HP/Stamina percentages when leveling
          const hpPercent = updatedStats.currentHp / updatedStats.maxHp;
          const staminaPercent = updatedStats.currentStamina / updatedStats.stamina;
          
          updatedStats = {
            ...newBaseStats,
            currentHp: Math.ceil(newBaseStats.maxHp * hpPercent),
            currentStamina: Math.ceil(newBaseStats.stamina * staminaPercent),
          };
          
          xpNeeded = xpToNextLevel(newLevel);
        }
        
        return {
          ...monster,
          level: newLevel,
          stats: updatedStats,
          experience: newXp,
        };
      });
      
      return {
        ...state,
        run: {
          ...state.run,
          party: xpUpdatedParty,
        },
      };
    }
    
    // Battle tracking for recruitment
    case 'UPDATE_BATTLE_STATS':
      if (!state.run) return state;
      return {
        ...state,
        run: {
          ...state.run,
          battleStats: {
            turnsUsed: action.stats.turnsUsed ?? state.run.battleStats?.turnsUsed ?? 0,
            overkillDamage: action.stats.overkillDamage ?? state.run.battleStats?.overkillDamage ?? 0,
            statusEffectsApplied: action.stats.statusEffectsApplied ?? state.run.battleStats?.statusEffectsApplied ?? 0,
            criticalHits: action.stats.criticalHits ?? state.run.battleStats?.criticalHits ?? 0,
          },
        },
      };
    
    case 'RESET_BATTLE_STATS':
      if (!state.run) return state;
      return {
        ...state,
        run: {
          ...state.run,
          battleStats: undefined,
        },
      };
    
    case 'SET_PARTY_EFFECTS': {
      if (!state.run) return state;
      const { partyIndex, effects } = action;
      const currentEffects = state.run.partyEffects || [];
      const newEffects = [...currentEffects];
      // Expand array if needed
      while (newEffects.length <= partyIndex) {
        newEffects.push({ statusEffects: [], statModifiers: [] });
      }
      newEffects[partyIndex] = effects;
      return {
        ...state,
        run: {
          ...state.run,
          partyEffects: newEffects,
        },
      };
    }
    
    case 'CLEAR_ALL_PARTY_EFFECTS':
      if (!state.run) return state;
      return {
        ...state,
        run: {
          ...state.run,
          partyEffects: state.run.party.map(() => ({ statusEffects: [], statModifiers: [] })),
        },
      };
    
    // Send a party member back to town via elevator
    case 'SEND_PARTY_MEMBER_TO_TOWN': {
      if (!state.run) return state;
      const { partyIndex } = action;
      if (partyIndex < 0 || partyIndex >= state.run.party.length) return state;
      if (state.run.party.length <= 1) return state; // Can't send last party member
      
      const monsterToSend = state.run.party[partyIndex];
      const equipmentToSend = state.run.partyEquipment[partyIndex];
      
      // Build the cleaned equipment payload (strip bound flags) and persist it
      // onto the UnlockedMonster so this creature stays geared for next run.
      const slots: import('./equipment').EquipmentSlot[] = ['helmet', 'armor', 'mainHand', 'offHand', 'gloves', 'boots', 'accessory', 'back'];
      const cleanedSentEquipment: MonsterEquipment = Object.fromEntries(
        Object.entries(equipmentToSend || {}).map(([slot, item]) => [
          slot,
          item ? { ...item, bound: undefined } : null,
        ])
      ) as MonsterEquipment;
      
      // Unlock/update the monster in save data and remember its current equipment
      let updatedUnlockedMonsters = [...state.saveData.unlockedMonsters];
      const comboId = `${monsterToSend.species}_${monsterToSend.element}_${monsterToSend.class}`;
      const existingIdx = updatedUnlockedMonsters.findIndex(m => m.comboId === comboId);
      
      if (existingIdx === -1) {
        updatedUnlockedMonsters.push({
          comboId,
          species: monsterToSend.species,
          element: monsterToSend.element,
          classType: monsterToSend.class,
          level: monsterToSend.level,
          equipment: cleanedSentEquipment,
        });
      } else {
        updatedUnlockedMonsters[existingIdx] = {
          ...updatedUnlockedMonsters[existingIdx],
          level: Math.max(updatedUnlockedMonsters[existingIdx].level, monsterToSend.level),
          equipment: cleanedSentEquipment,
        };
      }
      
      // Recipes still unlock for any equipped items the player has handled.
      const newUnlockedRecipes = [...(state.saveData.unlockedRecipes || [])];
      for (const slot of slots) {
        const item = equipmentToSend?.[slot];
        if (item) {
          const matchingRecipe = getRecipeFromEquipment(item);
          if (matchingRecipe && !newUnlockedRecipes.includes(matchingRecipe.id)) {
            newUnlockedRecipes.push(matchingRecipe.id);
            console.log('[Elevator Recipe Unlock]', item.name, '->', matchingRecipe.id);
          }
        }
      }
      
      // Remove from party
      const newParty = state.run.party.filter((_, i) => i !== partyIndex);
      const newPartyEquipment = state.run.partyEquipment.filter((_, i) => i !== partyIndex);
      
      // Adjust activePartyIndex if needed
      let newActiveIndex = state.run.activePartyIndex;
      if (partyIndex === state.run.activePartyIndex) {
        newActiveIndex = 0; // Switch to first party member
      } else if (partyIndex < state.run.activePartyIndex) {
        newActiveIndex = state.run.activePartyIndex - 1;
      }
      
      return {
        ...state,
        run: {
          ...state.run,
          party: newParty,
          partyEquipment: newPartyEquipment,
          activePartyIndex: newActiveIndex,
          currentMonster: newParty[newActiveIndex],
        },
        saveData: {
          ...state.saveData,
          unlockedMonsters: updatedUnlockedMonsters,
          // Equipment stays on the sent monster (persisted on UnlockedMonster) — don't dump to storage.
          unlockedRecipes: newUnlockedRecipes,
        },
      };
    }
      
    default:
      return state;
  }
}

// Context
interface GameContextType {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

const GameContext = createContext<GameContextType | null>(null);

// Provider component
interface GameProviderProps {
  children: ReactNode;
}

export function GameProvider({ children }: GameProviderProps) {
  const [state, dispatch] = useReducer(gameReducer, INITIAL_STATE);

  // Load save data from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('monster-roguelike-save');
    if (saved) {
      try {
        const saveData = JSON.parse(saved) as SaveData;
        // Migration from old saves
        if (!saveData.unlockedMonsters || saveData.unlockedMonsters.length === 0) {
          saveData.unlockedMonsters = [STARTER_MONSTER];
        }
        // Ensure materials and storedEquipment exist
        if (!saveData.materials) {
          saveData.materials = {};
        }
        if (!saveData.storedEquipment) {
          saveData.storedEquipment = [];
        }
        if (!saveData.dungeonEntrances) {
          saveData.dungeonEntrances = {};
        }
        // Ensure the Tower of the Infinite always exists
        if (!saveData.dungeonEntrances[HOME_TOWER_ID]) {
          saveData.dungeonEntrances[HOME_TOWER_ID] = createHomeTowerEntrance();
        }
        // Migration: ensure all themed towers (element/class/species) exist for legacy saves.
        // Preserves any deepestFloor progress already recorded under the same id.
        // Also migrates legacy synthetic coords (-100000-...) onto the new on-map ring positions.
        const themedDefaults = createAllThemedTowers();
        for (const [id, def] of Object.entries(themedDefaults)) {
          const existing = saveData.dungeonEntrances[id];
          if (!existing) {
            saveData.dungeonEntrances[id] = def;
          } else {
            const hasLegacyCoords = existing.worldX <= -10000 || existing.worldY <= -10000;
            saveData.dungeonEntrances[id] = {
              ...def,
              ...existing,
              // Force the canonical on-map position when the saved coords are the
              // old synthetic placeholders.
              worldX: hasLegacyCoords ? def.worldX : existing.worldX,
              worldY: hasLegacyCoords ? def.worldY : existing.worldY,
              theme: existing.theme || def.theme,
              category: existing.category || def.category,
              name: existing.name || def.name,
              discovered: existing.discovered ?? def.discovered,
            };
          }
        }
        dispatch({ type: 'LOAD_SAVE', saveData });
      } catch (e) {
        console.error('Failed to load save data:', e);
      }
    }
  }, []);

  // Save to localStorage when saveData changes.
  // Overworld chunks are stripped (regenerable from seed) so we don't blow
  // past the ~5MB localStorage quota — losing the entire save (including
  // player buildings) silently when it overflows.
  useEffect(() => {
    try {
      const toPersist: SaveData = { ...state.saveData };
      if (toPersist.overworldState) {
        toPersist.overworldState = slimOverworldForSave(toPersist.overworldState);
      }
      localStorage.setItem('monster-roguelike-save', JSON.stringify(toPersist));
    } catch (err) {
      // QuotaExceededError or similar — log loudly so we can diagnose.
      console.error('[save] Failed to write to localStorage:', err);
    }
  }, [state.saveData]);

  // Auto-snapshot party progress when meaningful in-run milestones change
  // (level-up, floor change, total mastery uses). This ensures level-ups
  // survive crashes — without thrashing on every tick of movement.
  const partyProgressSig = state.run
    ? (() => {
        let sig = `f${state.run.dungeon?.floor ?? 0}|`;
        for (let i = 0; i < state.run.party.length; i++) {
          const m = state.run.party[i];
          const masteryTotal = m.moveMastery
            ? Object.values(m.moveMastery).reduce((s, x) => s + (x?.uses ?? 0), 0)
            : 0;
          // Hash equipped item ids so equipping/unequipping triggers a
          // snapshot (and downstream cloud autosave) immediately.
          const eq = state.run.partyEquipment?.[i];
          let eqSig = '';
          if (eq) {
            for (const slot of Object.keys(eq).sort()) {
              const item = (eq as unknown as Record<string, { id?: string } | null>)[slot];
              eqSig += `${slot}:${item?.id ?? '_'};`;
            }
          }
          sig += `${m.species}_${m.element}_${m.class}:L${m.level}:X${m.experience ?? 0}:M${masteryTotal}:E[${eqSig}];`;
        }
        return sig;
      })()
    : '';

  // Snapshot run progress on every change, AND request an immediate cloud
  // flush when the change includes a level-up or equipment swap (so creatures
  // never lose levels or gear if the tab dies before the autosave debounce).
  const lastSigRef = React.useRef('');
  useEffect(() => {
    if (!state.run || !partyProgressSig) {
      lastSigRef.current = partyProgressSig;
      return;
    }
    const prev = lastSigRef.current;
    dispatch({ type: 'SNAPSHOT_RUN_PROGRESS' });

    if (prev && prev !== partyProgressSig && typeof window !== 'undefined') {
      const levelOrEqChanged =
        prev.replace(/:X\d+/g, '').replace(/:M\d+/g, '') !==
        partyProgressSig.replace(/:X\d+/g, '').replace(/:M\d+/g, '');
      if (levelOrEqChanged) {
        window.dispatchEvent(new CustomEvent('cloud-save-request', { detail: { reason: 'milestone' } }));
      }
    }
    lastSigRef.current = partyProgressSig;
  }, [partyProgressSig]);

  return React.createElement(GameContext.Provider, { value: { state, dispatch } }, children);
}

// Hook to use game state
export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
