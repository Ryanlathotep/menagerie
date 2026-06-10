// Sub-reducer for unified inventory + materials + gold actions extracted
// from state.ts. Returns the next GameState when the action is handled,
// or null to let gameReducer's main switch keep dispatching.
//
// IMPORTANT: every ADD_ITEM / USE_ITEM / DROP_ITEM / STORE_ITEM case MUST
// mirror writes to BOTH run.inventory and saveData.storedItems — they are
// a single unified inventory (mem://gameplay/equipment/unified-inventory).

import type { GameState, InventoryItem } from '../types';
import type { GameAction } from '../state';

export function inventoryReducer(state: GameState, action: GameAction): GameState | null {
  switch (action.type) {
    case 'ADD_GOLD': {
      if (!state.run) return state;
      return {
        ...state,
        run: { ...state.run, gold: state.run.gold + action.amount },
      };
    }

    case 'ADD_XP': {
      if (!state.run) return state;
      return {
        ...state,
        run: { ...state.run, experience: state.run.experience + action.amount },
      };
    }

    case 'ADD_ITEM': {
      if (!state.run) return state;
      const addQty = action.item.quantity || 1;
      const incoming = { ...action.item, quantity: addQty };

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

      const decrement = (list: InventoryItem[]): InventoryItem[] => {
        const idx = list.findIndex(i => i.id === action.itemId);
        if (idx === -1) return list;
        const cur = list[idx];
        if (cur.quantity <= 1) return list.filter((_, i) => i !== idx);
        const next = [...list];
        next[idx] = { ...cur, quantity: cur.quantity - 1 };
        return next;
      };

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

    case 'STORE_ITEM': {
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

    case 'ADD_MATERIAL': {
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
    }

    case 'USE_MATERIALS': {
      const updatedMaterials = { ...state.saveData.materials };
      for (const mat of action.materials) {
        updatedMaterials[mat.materialId] = (updatedMaterials[mat.materialId] || 0) - mat.quantity;
        if (updatedMaterials[mat.materialId] <= 0) {
          delete updatedMaterials[mat.materialId];
        }
      }
      return {
        ...state,
        saveData: { ...state.saveData, materials: updatedMaterials },
      };
    }

    case 'ADD_TOWN_GOLD': {
      return {
        ...state,
        saveData: { ...state.saveData, gold: (state.saveData.gold || 0) + action.amount },
      };
    }

    case 'SPEND_TOWN_GOLD': {
      const currentGold = state.saveData.gold || 0;
      if (currentGold < action.amount) return state;
      return {
        ...state,
        saveData: { ...state.saveData, gold: currentGold - action.amount },
      };
    }

    default:
      return null;
  }
}
