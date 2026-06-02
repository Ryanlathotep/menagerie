import { describe, it, expect } from 'vitest';
import { SaveData, UnlockedMonster, getComboId } from '../types';

/**
 * Tests for save data serialization and persistence
 * 
 * Critical: Corrupted save data breaks progression.
 * These tests validate:
 * - Proper serialization/deserialization
 * - Data structure integrity
 * - Combo ID generation
 * - Progressive unlock tracking
 */

const createTestSaveData = (): SaveData => ({
  unlockedSpecies: ['slime', 'skeleton', 'goblin'],
  unlockedCombos: [
    'slime_fire_kinetic',
    'slime_water_energy',
    'skeleton_normal_normal',
  ],
  unlockedMonsters: [
    {
      comboId: 'slime_fire_kinetic',
      species: 'slime',
      element: 'fire',
      classType: 'kinetic',
      level: 10,
      experience: 500,
      moveMastery: {
        'move_1': { uses: 25, currentTier: 'greater', hasAoE: true },
      },
    } as UnlockedMonster,
    {
      comboId: 'skeleton_normal_normal',
      species: 'skeleton',
      element: 'normal',
      classType: 'normal',
      level: 5,
      experience: 100,
    } as UnlockedMonster,
  ],
  highestFloor: 15,
  totalRuns: 5,
  totalEnemiesDefeated: 127,
  gold: 2500,
  materials: {
    wood_log: 45,
    cavestone: 20,
    deepstone: 8,
    coreshard: 2,
  },
  storedEquipment: [],
  storedItems: [],
  unlockedRecipes: [],
  dungeonEntrances: {},
});

describe('Save Data Persistence', () => {
  describe('Serialization', () => {
    it('should serialize save data to JSON', () => {
      const saveData = createTestSaveData();
      const json = JSON.stringify(saveData);

      expect(json).toBeDefined();
      expect(typeof json).toBe('string');
    });

    it('should deserialize save data from JSON', () => {
      const original = createTestSaveData();
      const json = JSON.stringify(original);
      const restored = JSON.parse(json) as SaveData;

      expect(restored.highestFloor).toEqual(original.highestFloor);
      expect(restored.totalRuns).toEqual(original.totalRuns);
      expect(restored.gold).toEqual(original.gold);
    });

    it('should maintain data types after round-trip', () => {
      const original = createTestSaveData();
      const json = JSON.stringify(original);
      const restored = JSON.parse(json) as SaveData;

      // Numbers should stay numbers
      expect(typeof restored.highestFloor).toBe('number');
      expect(typeof restored.gold).toBe('number');

      // Arrays should stay arrays
      expect(Array.isArray(restored.unlockedMonsters)).toBe(true);
      expect(Array.isArray(restored.unlockedSpecies)).toBe(true);

      // Objects should stay objects
      expect(typeof restored.materials).toBe('object');
    });
  });

  describe('Combo ID Generation', () => {
    it('should generate consistent combo IDs', () => {
      const combo1 = getComboId({
        species: 'slime',
        element: 'fire',
        classType: 'kinetic',
      });

      const combo2 = getComboId({
        species: 'slime',
        element: 'fire',
        classType: 'kinetic',
      });

      expect(combo1).toEqual(combo2);
    });

    it('should differentiate different combos', () => {
      const combo1 = getComboId({
        species: 'slime',
        element: 'fire',
        classType: 'kinetic',
      });

      const combo2 = getComboId({
        species: 'slime',
        element: 'water',
        classType: 'kinetic',
      });

      expect(combo1).not.toEqual(combo2);
    });

    it('combo ID should include all three attributes', () => {
      const combo = getComboId({
        species: 'slime',
        element: 'fire',
        classType: 'kinetic',
      });

      expect(combo).toContain('slime');
      expect(combo).toContain('fire');
      expect(combo).toContain('kinetic');
    });
  });

  describe('Progressive Unlocks', () => {
    it('should track unlocked monsters separately', () => {
      const saveData = createTestSaveData();

      expect(saveData.unlockedMonsters).toHaveLength(2);
      expect(saveData.unlockedCombos).toHaveLength(3);
    });

    it('should store monster progression separately', () => {
      const saveData = createTestSaveData();
      const slimeMonster = saveData.unlockedMonsters.find(m => m.species === 'slime');

      expect(slimeMonster).toBeDefined();
      expect(slimeMonster!.level).toBe(10);
      expect(slimeMonster!.experience).toBe(500);
    });

    it('should preserve move mastery data', () => {
      const saveData = createTestSaveData();
      const slimeMonster = saveData.unlockedMonsters.find(m => m.species === 'slime');

      expect(slimeMonster!.moveMastery).toBeDefined();
      expect(slimeMonster!.moveMastery!['move_1'].uses).toBe(25);
      expect(slimeMonster!.moveMastery!['move_1'].currentTier).toBe('greater');
    });
  });

  describe('Material Inventory', () => {
    it('should track material quantities', () => {
      const saveData = createTestSaveData();

      expect(saveData.materials['wood_log']).toBe(45);
      expect(saveData.materials['cavestone']).toBe(20);
      expect(saveData.materials['deepstone']).toBe(8);
    });

    it('should handle new materials gracefully', () => {
      const saveData = createTestSaveData();
      const newMaterial = 'mythril_ore';

      // Accessing non-existent material should be safe
      const quantity = saveData.materials[newMaterial] ?? 0;
      expect(quantity).toBe(0);
    });

    it('should support adding new materials', () => {
      const saveData = createTestSaveData();
      saveData.materials['mythril_ore'] = 5;

      expect(saveData.materials['mythril_ore']).toBe(5);
    });
  });

  describe('Dungeon Entrance Persistence', () => {
    it('should maintain empty dungeon entrance data initially', () => {
      const saveData = createTestSaveData();

      expect(saveData.dungeonEntrances).toBeDefined();
      expect(typeof saveData.dungeonEntrances).toBe('object');
    });

    it('should support adding dungeon entrance data', () => {
      const saveData = createTestSaveData();
      saveData.dungeonEntrances['home_tower'] = {
        id: 'home_tower',
        worldX: 0,
        worldY: -3,
        seed: 1337,
        deepestFloor: 10,
        difficulty: 1,
        discovered: true,
        isHome: true,
      };

      expect(saveData.dungeonEntrances['home_tower']).toBeDefined();
      expect(saveData.dungeonEntrances['home_tower'].deepestFloor).toBe(10);
    });
  });

  describe('Data Validation', () => {
    it('should not allow negative values for progression', () => {
      const saveData = createTestSaveData();

      // These should never be negative
      expect(saveData.highestFloor).toBeGreaterThanOrEqual(0);
      expect(saveData.totalRuns).toBeGreaterThanOrEqual(0);
      expect(saveData.totalEnemiesDefeated).toBeGreaterThanOrEqual(0);
      expect(saveData.gold).toBeGreaterThanOrEqual(0);
    });

    it('should maintain consistency between combos and monsters', () => {
      const saveData = createTestSaveData();

      // Each unlocked monster should have a corresponding combo
      saveData.unlockedMonsters.forEach(monster => {
        const expectedComboId = getComboId({
          species: monster.species,
          element: monster.element,
          classType: monster.classType,
        });

        expect(monster.comboId).toEqual(expectedComboId);
      });
    });
  });
});
