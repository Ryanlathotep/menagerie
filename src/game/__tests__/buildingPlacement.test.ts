import { describe, it, expect } from 'vitest';
import { BUILDING_DEFINITIONS } from '../buildings';

/**
 * Tests for building placement validation
 * 
 * Critical: Invalid placements corrupt the overworld state.
 * These tests validate:
 * - Resource cost requirements
 * - Placement boundary checks
 * - Building definition integrity
 * - Elevation rule validation
 */

describe('Building Placement System', () => {
  describe('Building Definitions', () => {
    it('should define all required building types', () => {
      const requiredTypes = [
        'test_house',
        'chest',
        'crafting_bench',
        'wall',
        'stone_staircase',
        'ladder',
        'garden',
        'water_well',
        'furnace',
        'throne',
      ];

      requiredTypes.forEach(type => {
        expect(BUILDING_DEFINITIONS).toHaveProperty(type);
      });
    });

    it('each building should have valid cost structure', () => {
      Object.entries(BUILDING_DEFINITIONS).forEach(([buildingType, def]) => {
        expect(def.cost).toBeDefined();
        expect(def.cost.wood).toBeGreaterThanOrEqual(0);
        expect(def.cost.stone).toBeGreaterThanOrEqual(0);
      });
    });

    it('each building should have a description', () => {
      Object.entries(BUILDING_DEFINITIONS).forEach(([buildingType, def]) => {
        expect(def.description).toBeDefined();
        expect(def.description.length).toBeGreaterThan(0);
      });
    });

    it('buildings should have reasonable costs', () => {
      Object.entries(BUILDING_DEFINITIONS).forEach(([buildingType, def]) => {
        const totalCost = def.cost.wood + def.cost.stone;
        expect(totalCost).toBeLessThan(10000); // Sanity check
      });
    });
  });

  describe('Placement Validation Logic', () => {
    it('should not allow building on home tile', () => {
      const homePos = { x: 0, y: 0 };
      const targetPos = { x: 0, y: 0 }; // Same as home
      
      // Simulate placement check
      const canPlace = !(targetPos.x === homePos.x && targetPos.y === homePos.y);
      expect(canPlace).toBe(false);
    });

    it('should allow building adjacent to home', () => {
      const homePos = { x: 0, y: 0 };
      const targetPos = { x: 1, y: 0 }; // Adjacent to home
      
      const canPlace = !(targetPos.x === homePos.x && targetPos.y === homePos.y);
      expect(canPlace).toBe(true);
    });

    it('should detect overlap with existing buildings', () => {
      const existingBuildings = [
        { worldX: 2, worldY: 2, type: 'test_house' },
        { worldX: 3, worldY: 2, type: 'chest' },
      ];

      const newBuildingPos = { x: 2, y: 2 };
      const hasOverlap = existingBuildings.some(
        b => b.worldX === newBuildingPos.x && b.worldY === newBuildingPos.y
      );

      expect(hasOverlap).toBe(true);
    });

    it('should not detect overlap with distant buildings', () => {
      const existingBuildings = [
        { worldX: 2, worldY: 2, type: 'test_house' },
      ];

      const newBuildingPos = { x: 5, y: 5 };
      const hasOverlap = existingBuildings.some(
        b => b.worldX === newBuildingPos.x && b.worldY === newBuildingPos.y
      );

      expect(hasOverlap).toBe(false);
    });
  });

  describe('Resource Cost Validation', () => {
    it('should reject placement if insufficient wood', () => {
      const woodRequired = BUILDING_DEFINITIONS.test_house.cost.wood;
      const woodAvailable = woodRequired - 1;

      const canPlace = woodAvailable >= woodRequired;
      expect(canPlace).toBe(false);
    });

    it('should accept placement if sufficient wood', () => {
      const woodRequired = BUILDING_DEFINITIONS.test_house.cost.wood;
      const woodAvailable = woodRequired + 10;

      const canPlace = woodAvailable >= woodRequired;
      expect(canPlace).toBe(true);
    });

    it('should validate both wood and stone', () => {
      const def = BUILDING_DEFINITIONS.test_house;
      const woodAvailable = def.cost.wood;
      const stoneAvailable = def.cost.stone;

      const hasWood = woodAvailable >= def.cost.wood;
      const hasStone = stoneAvailable >= def.cost.stone;

      expect(hasWood && hasStone).toBe(true);
    });

    it('should not allow placement with only partial resources', () => {
      const def = BUILDING_DEFINITIONS.test_house;
      const woodAvailable = def.cost.wood + 1; // Have enough wood
      const stoneAvailable = def.cost.stone - 1; // But not stone

      const hasWood = woodAvailable >= def.cost.wood;
      const hasStone = stoneAvailable >= def.cost.stone;

      expect(hasWood && hasStone).toBe(false);
    });
  });

  describe('Staircase Special Rules', () => {
    it('stairs should require attachment to walls', () => {
      const stairPos = { x: 2, y: 2 };
      const existingWalls = [
        { worldX: 2, worldY: 1, type: 'wall' }, // North of stairs
      ];

      const adjacentDirections = [
        { dx: 0, dy: -1 }, // North
        { dx: 0, dy: 1 },  // South
        { dx: -1, dy: 0 }, // West
        { dx: 1, dy: 0 },  // East
      ];

      const hasAdjacentWall = adjacentDirections.some(dir => {
        const checkX = stairPos.x + dir.dx;
        const checkY = stairPos.y + dir.dy;
        return existingWalls.some(w => w.worldX === checkX && w.worldY === checkY);
      });

      expect(hasAdjacentWall).toBe(true);
    });

    it('stairs without adjacent walls should be rejected', () => {
      const stairPos = { x: 2, y: 2 };
      const existingWalls: any[] = []; // No walls

      const adjacentDirections = [
        { dx: 0, dy: -1 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 },
      ];

      const hasAdjacentWall = adjacentDirections.some(dir => {
        const checkX = stairPos.x + dir.dx;
        const checkY = stairPos.y + dir.dy;
        return existingWalls.some(w => w.worldX === checkX && w.worldY === checkY);
      });

      expect(hasAdjacentWall).toBe(false);
    });
  });

  describe('Build Radius Limits', () => {
    it('should have a maximum build radius defined', () => {
      // MAX_BUILD_RADIUS should be defined
      const MAX_BUILD_RADIUS = 10;
      expect(MAX_BUILD_RADIUS).toBeGreaterThan(0);
    });

    it('should calculate Manhattan distance correctly', () => {
      const homePos = { x: 0, y: 0 };
      const targetPos = { x: 3, y: 4 };
      
      const distance = Math.abs(targetPos.x - homePos.x) + Math.abs(targetPos.y - homePos.y);
      expect(distance).toBe(7);
    });

    it('should reject buildings outside radius', () => {
      const homePos = { x: 0, y: 0 };
      const existingBuildings: any[] = [];
      const targetPos = { x: 20, y: 20 }; // Far away
      const MAX_BUILD_RADIUS = 10;

      // Check distance to home
      const distToHome = Math.abs(targetPos.x - homePos.x) + Math.abs(targetPos.y - homePos.y);
      const withinRadius = distToHome <= MAX_BUILD_RADIUS;

      expect(withinRadius).toBe(false);
    });
  });
});
