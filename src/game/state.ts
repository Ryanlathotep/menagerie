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
  MaterialInventory,
  getComboId 
} from './types';
import { createEmptyEquipment, EquipmentItem, MonsterEquipment, EquipmentSlot, CraftingRecipe } from './equipment';

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
  materials: {},              // Crafting materials
  storedEquipment: [],        // Equipment storage
};

// Initial game state
const INITIAL_STATE: GameState = {
  phase: 'main_menu',
  run: null,
  saveData: DEFAULT_SAVE_DATA,
};

// Action types
type GameAction =
  | { type: 'SET_PHASE'; phase: GamePhase }
  | { type: 'START_RUN'; monster: Monster; preEquipped?: MonsterEquipment; withdrawnIds?: string[] }
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
  | { type: 'EQUIP_ITEM'; item: EquipmentItem }
  | { type: 'UNEQUIP_ITEM'; slot: EquipmentSlot }
  | { type: 'DROP_EQUIPMENT'; itemId: string }
  | { type: 'ADD_MATERIAL'; materialId: string; quantity: number }
  | { type: 'USE_MATERIALS'; materials: { materialId: string; quantity: number }[] }
  | { type: 'STORE_EQUIPMENT'; item: EquipmentItem }
  | { type: 'WITHDRAW_EQUIPMENT'; itemId: string }
  | { type: 'LOAD_SAVE'; saveData: SaveData }
  | { type: 'RESET_SAVE' }
  // Party management
  | { type: 'SWITCH_ACTIVE_MONSTER'; index: number }
  | { type: 'ADD_TO_PARTY'; monster: Monster }
  | { type: 'UPDATE_PARTY_MONSTER'; index: number; monster: Monster }
  | { type: 'ADD_PARTY_XP'; xpGained: number; excludeActiveIndex: number }
  // Battle tracking
  | { type: 'UPDATE_BATTLE_STATS'; stats: Partial<{ turnsUsed: number; overkillDamage: number; statusEffectsApplied: number; criticalHits: number }> }
  | { type: 'RESET_BATTLE_STATS' };

// Reducer
function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SET_PHASE':
      return { ...state, phase: action.phase };
      
    case 'START_RUN': {
      // Remove withdrawn equipment from storage
      const remainingStorage = action.withdrawnIds 
        ? state.saveData.storedEquipment.filter(item => !action.withdrawnIds!.includes(item.id))
        : state.saveData.storedEquipment;
      
      return {
        ...state,
        phase: 'dungeon',
        run: {
          currentMonster: action.monster,
          party: [action.monster],  // Start with single monster in party
          activePartyIndex: 0,
          dungeon: null,
          battle: null,
          gold: 0,
          experience: 0,
          itemsCollected: [],
          inventory: [
            { id: 'small_potion', name: 'Small Potion', type: 'potion', value: 30, effect: 'heal_hp', quantity: 2 },
            { id: 'stamina_tonic', name: 'Stamina Tonic', type: 'potion', value: 20, effect: 'heal_stamina', quantity: 1 },
          ],
          equipmentInventory: [],
          equipment: action.preEquipped || createEmptyEquipment(),
          runMaterials: {},
          enemiesDefeated: 0,
          moveOrder: [],
          hiddenMoves: [],
          battleStats: undefined,
        },
        saveData: {
          ...state.saveData,
          totalRuns: state.saveData.totalRuns + 1,
          storedEquipment: remainingStorage,
        },
      };
    }
      
    case 'END_RUN': {
      // On death (victory=false), return equipped items to town storage
      const equipmentToStore: EquipmentItem[] = [];
      if (!action.victory && state.run?.equipment) {
        const slots: EquipmentSlot[] = ['helmet', 'armor', 'mainHand', 'offHand', 'gloves', 'boots', 'accessory'];
        for (const slot of slots) {
          const item = state.run.equipment[slot];
          if (item) {
            equipmentToStore.push(item);
          }
        }
      }
      
      // Update unlocked monsters if party members are at higher levels
      let updatedUnlockedMonsters = [...state.saveData.unlockedMonsters];
      if (state.run) {
        for (const partyMember of state.run.party) {
          const comboId = `${partyMember.species}_${partyMember.element}_${partyMember.class}`;
          const existingIdx = updatedUnlockedMonsters.findIndex(m => m.comboId === comboId);
          if (existingIdx !== -1) {
            // Update level if party member is higher level
            if (partyMember.level > updatedUnlockedMonsters[existingIdx].level) {
              updatedUnlockedMonsters[existingIdx] = {
                ...updatedUnlockedMonsters[existingIdx],
                level: partyMember.level,
              };
            }
          }
        }
      }
      
      return {
        ...state,
        phase: 'run_summary',
        saveData: {
          ...state.saveData,
          highestFloor: state.run?.dungeon 
            ? Math.max(state.saveData.highestFloor, state.run.dungeon.floor)
            : state.saveData.highestFloor,
          totalEnemiesDefeated: state.saveData.totalEnemiesDefeated + (state.run?.enemiesDefeated || 0),
          // Return equipped items to storage on death
          storedEquipment: [...state.saveData.storedEquipment, ...equipmentToStore],
          unlockedMonsters: updatedUnlockedMonsters,
        },
      };
    }
    
    case 'FLEE_DUNGEON': {
      // Flee safely - keep materials and equipment by storing them
      if (!state.run) return state;
      
      // Collect all equipment to store (equipped + inventory)
      const equipmentToStore: EquipmentItem[] = [...state.run.equipmentInventory];
      const slots: EquipmentSlot[] = ['helmet', 'armor', 'mainHand', 'offHand', 'gloves', 'boots', 'accessory'];
      for (const slot of slots) {
        const item = state.run.equipment[slot];
        if (item) {
          equipmentToStore.push(item);
        }
      }
      
      // Merge run materials with saved materials
      const mergedMaterials = { ...state.saveData.materials };
      for (const [materialId, quantity] of Object.entries(state.run.runMaterials)) {
        mergedMaterials[materialId] = (mergedMaterials[materialId] || 0) + quantity;
      }
      
      // Update unlocked monsters if party members are at higher levels
      let updatedUnlockedMonsters = [...state.saveData.unlockedMonsters];
      for (const partyMember of state.run.party) {
        const comboId = `${partyMember.species}_${partyMember.element}_${partyMember.class}`;
        const existingIdx = updatedUnlockedMonsters.findIndex(m => m.comboId === comboId);
        if (existingIdx !== -1) {
          // Update level if party member is higher level
          if (partyMember.level > updatedUnlockedMonsters[existingIdx].level) {
            updatedUnlockedMonsters[existingIdx] = {
              ...updatedUnlockedMonsters[existingIdx],
              level: partyMember.level,
            };
          }
        }
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
          storedEquipment: [...state.saveData.storedEquipment, ...equipmentToStore],
          materials: mergedMaterials,
          unlockedMonsters: updatedUnlockedMonsters,
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
        // Update level if new level is higher
        if (action.monster.level > state.saveData.unlockedMonsters[existingIndex].level) {
          const updatedMonsters = [...state.saveData.unlockedMonsters];
          updatedMonsters[existingIndex] = action.monster;
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
      return {
        ...state,
        run: { ...state.run, currentMonster: action.monster },
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
    
    case 'EQUIP_ITEM':
      if (!state.run) return state;
      const slot = action.item.slot;
      const previouslyEquipped = state.run.equipment[slot];
      const newEquipmentInv = state.run.equipmentInventory.filter(i => i.id !== action.item.id);
      // Add previously equipped item back to inventory
      if (previouslyEquipped) {
        newEquipmentInv.push(previouslyEquipped);
      }
      return {
        ...state,
        run: {
          ...state.run,
          equipmentInventory: newEquipmentInv,
          equipment: {
            ...state.run.equipment,
            [slot]: action.item,
          },
        },
      };
    
    case 'UNEQUIP_ITEM':
      if (!state.run) return state;
      const unequipSlot = action.slot;
      const itemToUnequip = state.run.equipment[unequipSlot];
      if (!itemToUnequip) return state;
      return {
        ...state,
        run: {
          ...state.run,
          equipmentInventory: [...state.run.equipmentInventory, itemToUnequip],
          equipment: {
            ...state.run.equipment,
            [unequipSlot]: null,
          },
        },
      };
    
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
      
    // Party management
    case 'SWITCH_ACTIVE_MONSTER':
      if (!state.run || action.index < 0 || action.index >= state.run.party.length) return state;
      const newActiveMonster = state.run.party[action.index];
      if (newActiveMonster.stats.currentHp <= 0) return state; // Can't switch to fainted
      return {
        ...state,
        run: {
          ...state.run,
          currentMonster: newActiveMonster,
          activePartyIndex: action.index,
        },
      };
    
    case 'ADD_TO_PARTY':
      if (!state.run) return state;
      if (state.run.party.length >= 6) return state; // Max party size
      return {
        ...state,
        run: {
          ...state.run,
          party: [...state.run.party, action.monster],
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
    
    // Award XP to non-active party members (passive gain)
    case 'ADD_PARTY_XP': {
      if (!state.run) return state;
      const passiveXp = Math.floor(action.xpGained / 2); // Half XP for passive members
      if (passiveXp <= 0) return state;
      
      const xpUpdatedParty = state.run.party.map((monster, index) => {
        if (index === action.excludeActiveIndex) return monster; // Skip active monster
        if (monster.stats.currentHp <= 0) return monster; // Skip fainted monsters
        
        // Calculate new XP total for this monster
        const currentXp = monster.experience || 0;
        const newXp = currentXp + passiveXp;
        
        return {
          ...monster,
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
        dispatch({ type: 'LOAD_SAVE', saveData });
      } catch (e) {
        console.error('Failed to load save data:', e);
      }
    }
  }, []);

  // Save to localStorage when saveData changes
  useEffect(() => {
    localStorage.setItem('monster-roguelike-save', JSON.stringify(state.saveData));
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
