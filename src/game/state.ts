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
  storedItems: [],            // Town item storage
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
      updatedUnlockedMonsters[existingIdx] = {
        ...updatedUnlockedMonsters[existingIdx],
        level: Math.max(updatedUnlockedMonsters[existingIdx].level, partyMember.level),
        experience: partyMember.experience ?? 0,
        moveMastery: partyMember.moveMastery,
        equipment: cleanedEquipment,
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
      nextSaveData.dungeonEntrances = {
        ...nextSaveData.dungeonEntrances,
        [activeDungeonId]: {
          ...nextSaveData.dungeonEntrances[activeDungeonId],
          deepestFloor: Math.max(nextSaveData.dungeonEntrances[activeDungeonId].deepestFloor || 0, run.dungeon.floor),
        },
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
  | { type: 'SET_SHOVEL_TIER'; tier: ShovelTier };

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
          equipmentInventory: [],
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
          storedEquipment: remainingStorage,
          storedItems: remainingStoredItems,
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

      // Loose run loot returns to town storage (unbound so it can be re-used).
      const equipmentToStore: EquipmentItem[] = state.run.equipmentInventory.map(
        item => ({ ...item, bound: undefined })
      );

      // Run inventory items merge back into town storage so nothing is lost.
      const storedItems = [...(state.saveData.storedItems || []), ...state.run.inventory];

      // Merge run materials with saved materials.
      const mergedMaterials = { ...state.saveData.materials };
      for (const [materialId, quantity] of Object.entries(state.run.runMaterials)) {
        mergedMaterials[materialId] = (mergedMaterials[materialId] || 0) + quantity;
      }

      // Run gold is added to town gold (no loss on death).
      const newTownGold = (state.saveData.gold || 0) + state.run.gold;

      // Recipes unlock from any equipment seen this run (equipped + loose loot).
      const newUnlockedRecipes = [...(state.saveData.unlockedRecipes || [])];
      const allSeenEquipment: EquipmentItem[] = [...equipmentToStore];
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
        if (currentFloor > (updatedDungeonEntrances[activeDungeonId].deepestFloor || 0)) {
          updatedDungeonEntrances[activeDungeonId] = {
            ...updatedDungeonEntrances[activeDungeonId],
            deepestFloor: currentFloor,
          };
        }
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
          storedEquipment: [...state.saveData.storedEquipment, ...equipmentToStore],
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
      
      // Only loose loot equipment goes to town storage; equipped gear stays on monsters.
      const slots: EquipmentSlot[] = ['helmet', 'armor', 'mainHand', 'offHand', 'gloves', 'boots', 'accessory', 'back'];
      const equipmentToStore: EquipmentItem[] = state.run.equipmentInventory.map(item => ({ ...item, bound: undefined }));
      
      // Merge run materials with saved materials
      const mergedMaterials = { ...state.saveData.materials };
      for (const [materialId, quantity] of Object.entries(state.run.runMaterials)) {
        mergedMaterials[materialId] = (mergedMaterials[materialId] || 0) + quantity;
      }
      
      // Add run gold to town gold
      const newTownGold = (state.saveData.gold || 0) + state.run.gold;
      
      // Store run items in town
      const storedItems = [...(state.saveData.storedItems || []), ...state.run.inventory];
      
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
      
      // Unlock recipes for any equipment seen this run (loose loot + currently equipped).
      const newUnlockedRecipes = [...(state.saveData.unlockedRecipes || [])];
      const allFleeEquipment: EquipmentItem[] = [...equipmentToStore];
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
          storedEquipment: [...state.saveData.storedEquipment, ...equipmentToStore],
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
    
    case 'ADD_ITEM':
      if (!state.run) return state;
      const existingItemIndex = state.run.inventory.findIndex(i => i.id === action.item.id);
      if (existingItemIndex !== -1) {
        // Stack existing item
        const newInventory = [...state.run.inventory];
        newInventory[existingItemIndex] = {
          ...newInventory[existingItemIndex],
          quantity: newInventory[existingItemIndex].quantity + (action.item.quantity || 1),
        };
        return {
          ...state,
          run: { ...state.run, inventory: newInventory },
        };
      }
      return {
        ...state,
        run: { ...state.run, inventory: [...state.run.inventory, action.item] },
      };
    
    case 'USE_ITEM':
      if (!state.run) return state;
      const itemIndex = state.run.inventory.findIndex(i => i.id === action.itemId);
      if (itemIndex === -1) return state;
      const item = state.run.inventory[itemIndex];
      if (item.quantity <= 1) {
        // Remove item
        return {
          ...state,
          run: { 
            ...state.run, 
            inventory: state.run.inventory.filter((_, i) => i !== itemIndex),
          },
        };
      }
      // Reduce quantity
      const updatedInventory = [...state.run.inventory];
      updatedInventory[itemIndex] = { ...item, quantity: item.quantity - 1 };
      return {
        ...state,
        run: { ...state.run, inventory: updatedInventory },
      };
    
    case 'DROP_ITEM':
      if (!state.run) return state;
      const dropIndex = state.run.inventory.findIndex(i => i.id === action.itemId);
      if (dropIndex === -1) return state;
      const dropItem = state.run.inventory[dropIndex];
      const dropQuantity = action.quantity ?? dropItem.quantity; // Drop all by default
      if (dropQuantity >= dropItem.quantity) {
        // Remove entire item
        return {
          ...state,
          run: { 
            ...state.run, 
            inventory: state.run.inventory.filter((_, i) => i !== dropIndex),
          },
        };
      }
      // Reduce quantity
      const droppedInventory = [...state.run.inventory];
      droppedInventory[dropIndex] = { ...dropItem, quantity: dropItem.quantity - dropQuantity };
      return {
        ...state,
        run: { ...state.run, inventory: droppedInventory },
      };
    
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
    
    // Equipment management
    case 'ADD_EQUIPMENT':
      if (!state.run) return state;
      return {
        ...state,
        run: { 
          ...state.run, 
          equipmentInventory: [...state.run.equipmentInventory, action.item] 
        },
      };
    
    case 'EQUIP_ITEM': {
      if (!state.run) return state;
      const equipIndex = action.partyIndex ?? state.run.activePartyIndex;
      const slot = action.item.slot;
      const currentEquipment = state.run.partyEquipment[equipIndex] || createEmptyEquipment();
      const previouslyEquipped = currentEquipment[slot];
      const newEquipmentInv = state.run.equipmentInventory.filter(i => i.id !== action.item.id);
      // Add previously equipped item back to inventory
      if (previouslyEquipped) {
        newEquipmentInv.push(previouslyEquipped);
      }
      // Update the party equipment array
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
      };
    }
    
    case 'UNEQUIP_ITEM': {
      if (!state.run) return state;
      const unequipIndex = action.partyIndex ?? state.run.activePartyIndex;
      const unequipSlot = action.slot;
      const unequipCurrentEquipment = state.run.partyEquipment[unequipIndex] || createEmptyEquipment();
      const itemToUnequip = unequipCurrentEquipment[unequipSlot];
      if (!itemToUnequip) return state;
      // Update the party equipment array
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
      };
    }
    
    case 'BULK_EQUIP': {
      if (!state.run) return state;
      const bulkIndex = action.partyIndex;
      // Remove used items from inventory
      const bulkNewInventory = state.run.equipmentInventory.filter(i => !action.usedIds.includes(i.id));
      // Add previously equipped items back to inventory
      const bulkCurrentEquipment = state.run.partyEquipment[bulkIndex] || createEmptyEquipment();
      const slots: EquipmentSlot[] = ['helmet', 'armor', 'mainHand', 'offHand', 'gloves', 'boots', 'accessory', 'back'];
      for (const slot of slots) {
        const oldItem = bulkCurrentEquipment[slot];
        if (oldItem && !action.usedIds.includes(oldItem.id)) {
          bulkNewInventory.push(oldItem);
        }
      }
      // Update party equipment
      const bulkNewPartyEquipment = [...state.run.partyEquipment];
      bulkNewPartyEquipment[bulkIndex] = action.equipment;
      return {
        ...state,
        run: {
          ...state.run,
          equipmentInventory: bulkNewInventory,
          partyEquipment: bulkNewPartyEquipment,
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
    
    case 'STORE_EQUIPMENT':
      return {
        ...state,
        saveData: {
          ...state.saveData,
          storedEquipment: [...state.saveData.storedEquipment, action.item],
        },
      };
    
    case 'WITHDRAW_EQUIPMENT':
      if (!state.run) return state;
      const withdrawItem = state.saveData.storedEquipment.find(i => i.id === action.itemId);
      if (!withdrawItem) return state;
      return {
        ...state,
        run: {
          ...state.run,
          equipmentInventory: [...state.run.equipmentInventory, withdrawItem],
        },
        saveData: {
          ...state.saveData,
          storedEquipment: state.saveData.storedEquipment.filter(i => i.id !== action.itemId),
        },
      };
    
    case 'SELL_EQUIPMENT': {
      // Sell stored equipment for gold
      const itemToSell = state.saveData.storedEquipment.find(i => i.id === action.itemId);
      if (!itemToSell) return state;
      
      return {
        ...state,
        saveData: {
          ...state.saveData,
          storedEquipment: state.saveData.storedEquipment.filter(i => i.id !== action.itemId),
          gold: (state.saveData.gold || 0) + action.price,
        },
      };
    }
    
    case 'DISMANTLE_EQUIPMENT': {
      // Break stored equipment into materials
      const itemToDismantle = state.saveData.storedEquipment.find(i => i.id === action.itemId);
      if (!itemToDismantle) return state;
      
      const dismantleResult = dismantleEquipment(itemToDismantle);
      const updatedMaterials = { ...state.saveData.materials };
      
      for (const { materialId, quantity } of dismantleResult.materials) {
        updatedMaterials[materialId] = (updatedMaterials[materialId] || 0) + quantity;
      }
      
      return {
        ...state,
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
      const existingItems = state.saveData.storedItems || [];
      // Check if item already exists and stack it
      const existingIdx = existingItems.findIndex(i => i.id === action.item.id);
      if (existingIdx !== -1) {
        const updated = [...existingItems];
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: updated[existingIdx].quantity + action.item.quantity,
        };
        return {
          ...state,
          saveData: {
            ...state.saveData,
            storedItems: updated,
          },
        };
      }
      return {
        ...state,
        saveData: {
          ...state.saveData,
          storedItems: [...existingItems, action.item],
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
