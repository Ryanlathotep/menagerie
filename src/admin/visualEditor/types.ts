// Visual Editor Types - Shared across all editor components

import { ElementType, SpeciesType, ClassType } from '@/game/types';
import { EquipmentSlot } from '@/game/equipment';

// Editor modes
export type EditorMode = 'species' | 'element' | 'class' | 'equipment';

// Pixel layer structure
export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  pixels: string[][]; // 2D array of hex colors or 'transparent'
}

// Sprite data structure
export interface SpriteData {
  width: number;
  height: number;
  layers: Layer[];
}

// Equipment placement zones - color-coded for template overlay
export const EQUIPMENT_PLACEMENT_ZONES: Record<EquipmentSlot, {
  color: string;
  label: string;
  bounds: { x1: number; y1: number; x2: number; y2: number };
}> = {
  helmet: {
    color: '#ff6b6b',
    label: 'Helmet (Top)',
    bounds: { x1: 25, y1: 0, x2: 75, y2: 20 },
  },
  armor: {
    color: '#4ecdc4',
    label: 'Armor (Body)',
    bounds: { x1: 30, y1: 25, x2: 70, y2: 65 },
  },
  gloves: {
    color: '#ffe66d',
    label: 'Gloves (Hands)',
    bounds: { x1: 15, y1: 40, x2: 35, y2: 65 },
  },
  boots: {
    color: '#a855f7',
    label: 'Boots (Feet)',
    bounds: { x1: 30, y1: 75, x2: 70, y2: 95 },
  },
  mainHand: {
    color: '#f97316',
    label: 'Main Hand (Left)',
    bounds: { x1: 0, y1: 25, x2: 25, y2: 55 },
  },
  offHand: {
    color: '#06b6d4',
    label: 'Off Hand (Right)',
    bounds: { x1: 75, y1: 25, x2: 100, y2: 55 },
  },
  accessory: {
    color: '#ec4899',
    label: 'Accessory (Center)',
    bounds: { x1: 40, y1: 55, x2: 60, y2: 70 },
  },
  back: {
    color: '#84cc16',
    label: 'Back (Behind)',
    bounds: { x1: 25, y1: 25, x2: 75, y2: 80 },
  },
};

// Class overlay placement zones
export const CLASS_OVERLAY_ZONES = {
  weapon: {
    color: '#ff6b6b',
    label: 'Weapon',
    description: 'Weapons appear in hands area (x: 15-35 and 65-85)',
  },
  armor: {
    color: '#4ecdc4',
    label: 'Armor',
    description: 'Armor appears on body (x: 30-70, y: 25-65)',
  },
  accessory: {
    color: '#ffe66d',
    label: 'Accessory',
    description: 'Accessories float around the body (varies)',
  },
};

// Drawing tools
export type Tool = 'brush' | 'eraser' | 'fill' | 'picker' | 'line' | 'rect';

// Preset color palettes
export const PRESET_COLORS = [
  '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff',
  '#ffff00', '#ff00ff', '#00ffff', '#808080', '#c0c0c0',
  '#800000', '#008000', '#000080', '#808000', '#800080',
  '#008080', '#ff8000', '#ff0080', '#80ff00', '#0080ff',
  '#2d1b00', '#5c3d1e', '#8b5a2b', '#a0522d', '#cd853f', // Browns for outlines
  '#1a1a2e', '#16213e', '#0f3460', '#1e3a5f', '#2c3e50', // Dark blues
];

// Zoom levels
export const ZOOM_LEVELS = [2, 4, 6, 8, 12, 16, 24, 32];

// Default sizes matching SVG viewBox
export const DEFAULT_CANVAS_SIZE = 32; // Pixels - maps to 100x100 viewBox
export const MAX_CANVAS_SIZE = 64;
export const SVG_VIEWBOX_SIZE = 100; // All sprites use 100x100 viewBox

// Helper to create empty sprite
export function createEmptySprite(width: number, height: number): SpriteData {
  return {
    width,
    height,
    layers: [{
      id: crypto.randomUUID(),
      name: 'Layer 1',
      visible: true,
      pixels: Array(height).fill(null).map(() => Array(width).fill('transparent')),
    }],
  };
}

// Helper to merge visible layers into single pixel grid
export function mergeVisibleLayers(data: SpriteData): string[][] {
  const merged: string[][] = Array(data.height).fill(null)
    .map(() => Array(data.width).fill('transparent'));
  
  for (const layer of data.layers) {
    if (!layer.visible) continue;
    for (let y = 0; y < data.height; y++) {
      for (let x = 0; x < data.width; x++) {
        const pixel = layer.pixels[y]?.[x];
        if (pixel && pixel !== 'transparent') {
          merged[y][x] = pixel;
        }
      }
    }
  }
  
  return merged;
}
