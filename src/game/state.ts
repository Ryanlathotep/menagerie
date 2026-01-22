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
  getComboId 
} from './types';

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
  | { type: 'START_RUN'; monster: Monster }
  | { type: 'END_RUN'; victory: boolean }
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
  | { type: 'LOAD_SAVE'; saveData: SaveData }
  | { type: 'RESET_SAVE' };

// Reducer
function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SET_PHASE':
      return { ...state, phase: action.phase };
      
    case 'START_RUN':
      return {
        ...state,
        phase: 'dungeon',
        run: {
          currentMonster: action.monster,
          dungeon: null,
          battle: null,
          gold: 0,
          experience: 0,
          itemsCollected: [],
          inventory: [
            { id: 'small_potion', name: 'Small Potion', type: 'potion', value: 30, effect: 'heal_hp', quantity: 2 },
            { id: 'stamina_tonic', name: 'Stamina Tonic', type: 'potion', value: 20, effect: 'heal_stamina', quantity: 1 },
          ],
          enemiesDefeated: 0,
          moveOrder: [],
          hiddenMoves: [],
        },
        saveData: {
          ...state.saveData,
          totalRuns: state.saveData.totalRuns + 1,
        },
      };
      
    case 'END_RUN':
      return {
        ...state,
        phase: 'run_summary',
        saveData: {
          ...state.saveData,
          highestFloor: state.run?.dungeon 
            ? Math.max(state.saveData.highestFloor, state.run.dungeon.floor)
            : state.saveData.highestFloor,
          totalEnemiesDefeated: state.saveData.totalEnemiesDefeated + (state.run?.enemiesDefeated || 0),
        },
      };
      
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
        // Ensure unlockedMonsters exists (migration from old saves)
        if (!saveData.unlockedMonsters || saveData.unlockedMonsters.length === 0) {
          // Add starter monster for old saves
          saveData.unlockedMonsters = [STARTER_MONSTER];
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
