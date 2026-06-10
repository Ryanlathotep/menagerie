// Sub-reducer for dungeon-shaped state mutations (set/update dungeon,
// compass waypoints, trap disarming) extracted from state.ts.
//
// Returns the next GameState when the action is handled, or null to let
// gameReducer's main switch keep dispatching.

import type { GameState } from '../types';
import type { GameAction } from '../state';

export function dungeonReducer(state: GameState, action: GameAction): GameState | null {
  switch (action.type) {
    case 'SET_DUNGEON': {
      if (!state.run) return state;
      return {
        ...state,
        run: { ...state.run, dungeon: action.dungeon },
      };
    }

    case 'UPDATE_DUNGEON': {
      if (!state.run || !state.run.dungeon) return state;
      return {
        ...state,
        run: {
          ...state.run,
          dungeon: { ...state.run.dungeon, ...action.dungeon },
        },
      };
    }

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

    case 'DISARM_TRAP': {
      if (!state.run || !state.run.dungeon) return state;
      const newTiles = state.run.dungeon.tiles.map((row, rowY) =>
        row.map((tile, tileX) => {
          if (tileX === action.x && rowY === action.y && tile.type === 'trap') {
            if (action.success) {
              return { ...tile, type: 'floor' as const, trapType: undefined, triggered: undefined };
            } else {
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
    }

    default:
      return null;
  }
}
