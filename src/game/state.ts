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
  getComboId 
} from './types';

// Starting monster - Biological Water Slime
const STARTER_MONSTER = {
  comboId: 'slime_water_biological',
  species: 'slime' as SpeciesType,
  element: 'water' as const,
  classType: 'biological' as const,
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
  | { type: 'START_BATTLE'; enemy: Monster }
  | { type: 'UPDATE_BATTLE'; battle: Partial<BattleState> }
  | { type: 'END_BATTLE'; victory: boolean }
  | { type: 'UNLOCK_SPECIES'; species: SpeciesType }
  | { type: 'UNLOCK_COMBO'; comboId: string }
  | { type: 'UNLOCK_MONSTER'; monster: UnlockedMonster }
  | { type: 'UPDATE_PLAYER_MONSTER'; monster: Monster }
  | { type: 'ADD_GOLD'; amount: number }
  | { type: 'ADD_XP'; amount: number }
  | { type: 'LOAD_SAVE'; saveData: SaveData };

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
          itemsCollected: [],
          enemiesDefeated: 0,
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
      
    case 'LOAD_SAVE':
      return {
        ...state,
        saveData: action.saveData,
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
