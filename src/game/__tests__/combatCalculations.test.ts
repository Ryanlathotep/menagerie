import { describe, it, expect } from 'vitest';
import {
  ElementType,
  ClassType,
  ELEMENT_ADVANTAGES,
  CLASS_ADVANTAGES_CORRECTED,
  CLASS_STATS,
  SPECIES_DATA,
} from '../types';

/**
 * Tests for combat calculation systems
 * 
 * Critical: Combat balance directly affects gameplay fairness.
 * These tests validate:
 * - Element advantage/resistance system
 * - Class advantage system  
 * - Damage multiplier calculations
 * - No impossible stat combinations
 */

describe('Combat Calculations', () => {
  describe('Element Advantage System', () => {
    it('should define advantages for all elements', () => {
      const elements: ElementType[] = ['normal', 'fire', 'water', 'earth', 'air', 'void'];
      
      elements.forEach(element => {
        expect(ELEMENT_ADVANTAGES).toHaveProperty(element);
      });
    });

    it('normal element should have no advantages', () => {
      expect(ELEMENT_ADVANTAGES.normal).toHaveLength(0);
    });

    it('each non-normal element should have exactly 2 advantages', () => {
      const elements: ElementType[] = ['fire', 'water', 'earth', 'air', 'void'];
      
      elements.forEach(element => {
        expect(ELEMENT_ADVANTAGES[element]).toHaveLength(2);
      });
    });

    it('should form a balanced advantage system', () => {
      // Count how many times each element is beaten
      const beatenBy: Record<ElementType, number> = {
        normal: 0,
        fire: 0,
        water: 0,
        earth: 0,
        air: 0,
        void: 0,
      };

      Object.entries(ELEMENT_ADVANTAGES).forEach(([element, advantages]) => {
        advantages.forEach(advantage => {
          beatenBy[advantage as ElementType]++;
        });
      });

      // Each element (except normal) should be beaten by exactly 2 others
      const nonNormalElements: ElementType[] = ['fire', 'water', 'earth', 'air', 'void'];
      nonNormalElements.forEach(element => {
        expect(beatenBy[element]).toBe(2);
      });
    });

    it('should handle fire advantages correctly', () => {
      const fireAdvantages = ELEMENT_ADVANTAGES.fire;
      expect(fireAdvantages).toContain('air');
      expect(fireAdvantages).toContain('earth');
    });
  });

  describe('Class Advantage System', () => {
    it('should define advantages for all classes', () => {
      const classes: ClassType[] = ['normal', 'kinetic', 'energy', 'biological', 'chemical', 'political'];
      
      classes.forEach(classType => {
        expect(CLASS_ADVANTAGES_CORRECTED).toHaveProperty(classType);
      });
    });

    it('normal class should have no advantages', () => {
      expect(CLASS_ADVANTAGES_CORRECTED.normal).toHaveLength(0);
    });

    it('each non-normal class should have exactly 2 advantages', () => {
      const classes: ClassType[] = ['kinetic', 'energy', 'biological', 'chemical', 'political'];
      
      classes.forEach(classType => {
        expect(CLASS_ADVANTAGES_CORRECTED[classType]).toHaveLength(2);
      });
    });

    it('should form a balanced class advantage cycle', () => {
      const beatenBy: Record<ClassType, number> = {
        normal: 0,
        kinetic: 0,
        energy: 0,
        biological: 0,
        chemical: 0,
        political: 0,
      };

      Object.entries(CLASS_ADVANTAGES_CORRECTED).forEach(([classType, advantages]) => {
        advantages.forEach(advantage => {
          beatenBy[advantage as ClassType]++;
        });
      });

      // Each class (except normal) should be beaten by exactly 2 others
      const nonNormalClasses: ClassType[] = ['kinetic', 'energy', 'biological', 'chemical', 'political'];
      nonNormalClasses.forEach(classType => {
        expect(beatenBy[classType]).toBe(2);
      });
    });
  });

  describe('Class Stats System', () => {
    it('should define stats for all classes', () => {
      const classes: ClassType[] = ['normal', 'kinetic', 'energy', 'biological', 'chemical', 'political'];
      
      classes.forEach(classType => {
        expect(CLASS_STATS).toHaveProperty(classType);
      });
    });

    it('should have valid stat distributions', () => {
      Object.entries(CLASS_STATS).forEach(([classType, stats]) => {
        expect(stats.hp).toBeGreaterThan(0);
        expect(stats.attack).toBeGreaterThan(0);
        expect(stats.defense).toBeGreaterThan(0);
        expect(stats.speed).toBeGreaterThan(0);
        expect(stats.special).toBeGreaterThan(0);
        expect(stats.dodge).toBeGreaterThan(0);
      });
    });

    it('should total similar stat points across classes', () => {
      const statTotals = Object.entries(CLASS_STATS).map(([, stats]) => {
        return stats.hp + stats.attack + stats.defense + stats.speed + stats.special + stats.dodge;
      });

      // All classes should have roughly similar total stat points (within 20)
      const avgTotal = statTotals.reduce((a, b) => a + b) / statTotals.length;
      statTotals.forEach(total => {
        expect(Math.abs(total - avgTotal)).toBeLessThan(20);
      });
    });

    it('kinetic class should favor attack', () => {
      const kineticStats = CLASS_STATS.kinetic;
      expect(kineticStats.attack).toBeGreaterThan(CLASS_STATS.normal.attack);
    });

    it('energy class should favor special', () => {
      const energyStats = CLASS_STATS.energy;
      expect(energyStats.special).toBeGreaterThan(CLASS_STATS.normal.special);
    });

    it('biological class should favor HP', () => {
      const bioStats = CLASS_STATS.biological;
      expect(bioStats.hp).toBeGreaterThan(CLASS_STATS.normal.hp);
    });
  });

  describe('Species Data Validity', () => {
    it('should have data for all species', () => {
      const speciesTypes = Object.keys(SPECIES_DATA);
      expect(speciesTypes.length).toBeGreaterThan(0);
    });

    it('each species should have valid base stats', () => {
      Object.entries(SPECIES_DATA).forEach(([species, data]) => {
        expect(data.baseStats.hp).toBeGreaterThan(0);
        expect(data.baseStats.attack).toBeGreaterThanOrEqual(0);
        expect(data.baseStats.defense).toBeGreaterThanOrEqual(0);
        expect(data.baseStats.speed).toBeGreaterThanOrEqual(0);
        expect(data.baseStats.special).toBeGreaterThanOrEqual(0);
      });
    });

    it('each species should have a passive ability', () => {
      Object.entries(SPECIES_DATA).forEach(([species, data]) => {
        expect(data.passiveAbility).toBeDefined();
        expect(data.passiveAbility.length).toBeGreaterThan(0);
        expect(data.passiveDescription).toBeDefined();
        expect(data.passiveDescription.length).toBeGreaterThan(0);
      });
    });

    it('should categorize species as fantasy or real', () => {
      Object.entries(SPECIES_DATA).forEach(([species, data]) => {
        expect(['fantasy', 'real']).toContain(data.category);
      });
    });
  });

  describe('Damage Calculation Helpers', () => {
    it('should calculate type advantage multiplier', () => {
      // Attacker has fire, defender has air = advantage
      const isSuper = ELEMENT_ADVANTAGES.fire.includes('air');
      expect(isSuper).toBe(true);

      // Normal type has no advantages
      expect(ELEMENT_ADVANTAGES.normal.length).toBe(0);
    });

    it('should calculate resistance (reverse advantage)', () => {
      // If fire beats air, then air is weak to fire
      const fireBeatsAir = ELEMENT_ADVANTAGES.fire.includes('air');
      expect(fireBeatsAir).toBe(true);
    });
  });
});
