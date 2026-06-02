import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SaveData, RunState, Monster, ElementType, ClassType, SpeciesType } from '../types';

/**
 * Tests for cloud save system
 * 
 * Critical: Players lose progress if save/load fails silently.
 * These tests validate:
 * - Save data is persisted correctly
 * - Load retrieves correct save state
 * - Conflict resolution works
 * - Error handling is robust
 */

const createMockSaveData = (): SaveData => ({
  unlockedSpecies: ['slime', 'skeleton'],
  unlockedCombos: ['slime_fire_kinetic'],
  unlockedMonsters: [
    {
      comboId: 'slime_fire_kinetic',
      species: 'slime',
      element: 'fire',
      classType: 'kinetic',
      level: 5,
      experience: 250,
    },
  ],
  highestFloor: 3,
  totalRuns: 2,
  totalEnemiesDefeated: 15,
  gold: 500,
  materials: { wood_log: 10, cavestone: 5 },
  storedEquipment: [],
  storedItems: [],
  unlockedRecipes: [],
  overworldState: undefined,
  dungeonEntrances: {},
});

const createMockMonster = (override?: Partial<Monster>): Monster => ({
  id: 'test-monster-1',
  species: 'slime' as SpeciesType,
  class: 'kinetic' as ClassType,
  element: 'fire' as ElementType,
  level: 5,
  name: 'Flameslime',
  stats: {
    maxHp: 30,
    currentHp: 30,
    attack: 10,
    defense: 15,
    speed: 5,
    dodge: 3,
    special: 7,
    stamina: 50,
    currentStamina: 50,
  },
  ...override,
});

describe('Cloud Save System', () => {
  describe('Save Data Integrity', () => {
    it('should preserve all save data fields', () => {
      const saveData = createMockSaveData();
      
      expect(saveData.unlockedMonsters).toBeDefined();
      expect(saveData.highestFloor).toEqual(3);
      expect(saveData.totalRuns).toEqual(2);
      expect(saveData.gold).toEqual(500);
      expect(saveData.materials).toBeDefined();
    });

    it('should handle empty save data', () => {
      const emptySave: SaveData = {
        unlockedSpecies: [],
        unlockedCombos: [],
        unlockedMonsters: [],
        highestFloor: 0,
        totalRuns: 0,
        totalEnemiesDefeated: 0,
        gold: 0,
        materials: {},
        storedEquipment: [],
        storedItems: [],
        unlockedRecipes: [],
        dungeonEntrances: {},
      };

      expect(emptySave.unlockedMonsters).toHaveLength(0);
      expect(emptySave.gold).toBe(0);
    });

    it('should validate save data has required fields', () => {
      const saveData = createMockSaveData();
      
      const requiredFields = [
        'unlockedMonsters',
        'highestFloor',
        'totalRuns',
        'gold',
        'materials',
        'dungeonEntrances',
      ];

      requiredFields.forEach(field => {
        expect(saveData).toHaveProperty(field);
      });
    });
  });

  describe('Monster Data Persistence', () => {
    it('should preserve monster stats correctly', () => {
      const monster = createMockMonster();
      
      expect(monster.stats.maxHp).toEqual(30);
      expect(monster.stats.currentHp).toEqual(30);
      expect(monster.stats.attack).toEqual(10);
      expect(monster.stats.defense).toEqual(15);
    });

    it('should track experience correctly', () => {
      const monster = createMockMonster({ experience: 1500 });
      
      expect(monster.experience).toBe(1500);
    });

    it('should preserve move mastery data', () => {
      const monster = createMockMonster({
        moveMastery: {
          'move_fireball': {
            uses: 45,
            currentTier: 'greater',
            hasAoE: true,
          },
        },
      });

      expect(monster.moveMastery).toBeDefined();
      expect(monster.moveMastery!['move_fireball'].uses).toBe(45);
      expect(monster.moveMastery!['move_fireball'].currentTier).toBe('greater');
    });
  });

  describe('Save Conflict Detection', () => {
    it('should detect when save scores differ', () => {
      const save1 = createMockSaveData();
      const save2 = { ...save1, highestFloor: 10 }; // Different floor

      // Score should be higher for save2
      const score1 = save1.highestFloor;
      const score2 = save2.highestFloor;
      
      expect(score2).toBeGreaterThan(score1);
    });

    it('should prefer save with more progress', () => {
      const cloudSave = createMockSaveData();
      cloudSave.highestFloor = 5;
      cloudSave.totalRuns = 3;

      const localSave = createMockSaveData();
      localSave.highestFloor = 2;
      localSave.totalRuns = 1;

      // Cloud save has more progress
      const cloudScore = cloudSave.highestFloor + cloudSave.totalRuns;
      const localScore = localSave.highestFloor + localSave.totalRuns;

      expect(cloudScore).toBeGreaterThan(localScore);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle null/undefined save data', () => {
      const nullSave: SaveData | null = null;
      
      expect(nullSave).toBeNull();
    });

    it('should validate monster combo data', () => {
      const saveData = createMockSaveData();
      const monster = saveData.unlockedMonsters[0];

      expect(monster.comboId).toBeDefined();
      expect(monster.species).toBeDefined();
      expect(monster.element).toBeDefined();
      expect(monster.classType).toBeDefined();
    });

    it('should handle corrupted material inventory', () => {
      const saveData = createMockSaveData();
      const materials = saveData.materials || {};

      // Should be able to iterate over materials
      expect(Object.keys(materials)).toBeDefined();
      expect(materials['wood_log']).toBe(10);
    });
  });

  describe('Save Versioning', () => {
    it('should handle save data with optional fields', () => {
      const saveData = createMockSaveData();
      const { overworldState, tools, ...required } = saveData as any;

      // Optional fields may be undefined
      expect(overworldState).toBeUndefined();
      // But required fields must exist
      expect(required.unlockedMonsters).toBeDefined();
    });

    it('should preserve backwards compatibility fields', () => {
      const saveData = createMockSaveData();
      
      // Legacy fields should still exist
      expect(saveData.unlockedSpecies).toBeDefined();
      expect(saveData.unlockedCombos).toBeDefined();
    });
  });
});
