// Sub-reducer for equipment lifecycle actions extracted from state.ts.
// Returns the next GameState when the action is handled, or null to let
// gameReducer's main switch keep dispatching.
//
// Unified equipment inventory: run.equipmentInventory and
// saveData.storedEquipment are kept in sync — they are the same shared list,
// just exposed under two names so existing callers (run UI vs town UI) keep
// working. Equipped items (state.run.partyEquipment[*]) are bound to monsters
// and intentionally NOT in either list while equipped.

import type { GameState } from '../types';
import type { GameAction } from '../state';
import {
  createEmptyEquipment,
  dismantleEquipment,
  type EquipmentSlot,
} from '../equipment';

const EQUIPMENT_SLOTS: EquipmentSlot[] = [
  'helmet', 'armor', 'mainHand', 'offHand', 'gloves', 'boots', 'accessory', 'back',
];

export function equipmentReducer(state: GameState, action: GameAction): GameState | null {
  switch (action.type) {
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
      const newEquipmentInv = state.run.equipmentInventory.filter(i => i.id !== action.item.id);
      const newStored = state.saveData.storedEquipment.filter(i => i.id !== action.item.id);
      if (previouslyEquipped) {
        newEquipmentInv.push(previouslyEquipped);
        newStored.push(previouslyEquipped);
      }
      const newPartyEquipment = [...state.run.partyEquipment];
      newPartyEquipment[equipIndex] = { ...currentEquipment, [slot]: action.item };
      return {
        ...state,
        run: {
          ...state.run,
          equipmentInventory: newEquipmentInv,
          partyEquipment: newPartyEquipment,
        },
        saveData: { ...state.saveData, storedEquipment: newStored },
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
      unequipNewPartyEquipment[unequipIndex] = { ...unequipCurrentEquipment, [unequipSlot]: null };
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
      const usedSet = new Set(action.usedIds);
      const bulkNewInventory = state.run.equipmentInventory.filter(i => !usedSet.has(i.id));
      const bulkNewStored = state.saveData.storedEquipment.filter(i => !usedSet.has(i.id));
      const bulkCurrentEquipment = state.run.partyEquipment[bulkIndex] || createEmptyEquipment();
      for (const slot of EQUIPMENT_SLOTS) {
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
        saveData: { ...state.saveData, storedEquipment: bulkNewStored },
      };
    }

    case 'DROP_EQUIPMENT': {
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
    }

    case 'STORE_EQUIPMENT': {
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
    }

    case 'WITHDRAW_EQUIPMENT': {
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

    default:
      return null;
  }
}
