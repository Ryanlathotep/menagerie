// Rasterization utilities - Convert SVG paths to pixel art for editing

import { SpeciesType, ElementType, ClassType, ELEMENT_COLORS } from '@/game/types';
import { EquipmentSlot } from '@/game/equipment';
import { SpriteData, Layer, SVG_VIEWBOX_SIZE } from './types';

// Import SVG path data from the game
import { SPECIES_SVG_PATHS } from '../spriteConversion';

// Class overlays from sprites.tsx (duplicated here for rasterization)
const CLASS_OVERLAYS: Record<ClassType, { weapon?: string; armor?: string; accessory?: string }> = {
  normal: {},
  kinetic: {
    weapon: 'M22,48 Q15,42 15,52 Q15,62 25,62 L32,55 L28,48 Z M78,48 Q85,42 85,52 Q85,62 75,62 L68,55 L72,48 Z',
    armor: 'M38,52 L62,52 L64,58 L60,60 L40,60 L36,58 Z',
  },
  energy: {
    weapon: 'M35,32 L8,25 L10,30 L35,35 M65,32 L92,25 L90,30 L65,35 M8,25 L5,22 M92,25 L95,22',
    accessory: 'M50,2 A22,10 0 1,1 50.01,2',
  },
  biological: {},
  chemical: {
    accessory: 'M16,25 A6,6 0 1,1 16.01,25 M8,40 A5,5 0 1,1 8.01,40 M20,55 A4,4 0 1,1 20.01,55 M84,25 A6,6 0 1,1 84.01,25 M92,40 A5,5 0 1,1 92.01,40 M80,55 A4,4 0 1,1 80.01,55',
  },
  political: {
    accessory: 'M25,10 L30,0 L37,12 L44,2 L50,-4 L56,2 L63,12 L70,0 L75,10 L72,22 L28,22 Z',
    armor: 'M20,38 Q15,55 20,75 L32,70 L32,45 Z M80,38 Q85,55 80,75 L68,70 L68,45 Z',
  },
};

// Equipment visuals from sprites.tsx
const EQUIPMENT_VISUALS: Record<EquipmentSlot, string> = {
  helmet: 'M30,6 L35,2 L50,0 L65,2 L70,6 L68,14 L32,14 Z',
  armor: 'M35,35 L38,30 L62,30 L65,35 L68,50 L65,58 L35,58 L32,50 Z',
  gloves: 'M20,52 L28,48 L32,54 L26,60 Z M80,52 L72,48 L68,54 L74,60 Z',
  boots: 'M36,82 L44,80 L46,90 L34,92 Z M64,82 L56,80 L54,90 L66,92 Z',
  mainHand: 'M18,35 L12,25 L8,40 L14,50 L22,45 Z',
  offHand: 'M82,35 L88,25 L92,40 L86,50 L78,45 Z',
  accessory: 'M45,60 A6,6 0 1,1 55,60 A6,6 0 1,1 45,60',
  back: 'M35,30 Q30,45 28,70 Q50,75 72,70 Q70,45 65,30 Z',
};

/**
 * Rasterize a species sprite to pixel art (base shape only, no element colors)
 * This creates the BASE shape that can be edited and will work with all elements
 */
export async function rasterizeSpecies(
  species: SpeciesType,
  size: number = 32
): Promise<SpriteData> {
  const paths = SPECIES_SVG_PATHS[species];
  
  return rasterizePaths({
    body: { path: paths.body, fill: 'rgba(160, 160, 160, 0.8)', stroke: 'rgba(20, 20, 20, 1)', strokeWidth: 3.5 },
    detail: { path: paths.detail, fill: '', stroke: 'rgba(35, 35, 35, 1)', strokeWidth: 2.5 },
    face: { path: paths.face, fill: 'rgba(20, 20, 20, 1)', stroke: 'rgba(10, 10, 10, 1)', strokeWidth: 2.5 },
  }, size, species);
}

/**
 * Rasterize a class overlay to pixel art
 */
export async function rasterizeClassOverlay(
  classType: ClassType,
  size: number = 32
): Promise<SpriteData> {
  const overlay = CLASS_OVERLAYS[classType];
  
  const pathDefs: Record<string, { path: string; fill: string; stroke: string; strokeWidth: number }> = {};
  
  if (overlay.weapon) {
    pathDefs.weapon = { path: overlay.weapon, fill: 'rgba(200, 100, 100, 0.9)', stroke: 'rgba(40, 40, 40, 1)', strokeWidth: 2 };
  }
  if (overlay.armor) {
    pathDefs.armor = { path: overlay.armor, fill: 'rgba(100, 150, 200, 0.8)', stroke: 'rgba(40, 40, 40, 1)', strokeWidth: 2 };
  }
  if (overlay.accessory) {
    pathDefs.accessory = { path: overlay.accessory, fill: 'rgba(200, 200, 100, 0.8)', stroke: 'rgba(40, 40, 40, 1)', strokeWidth: 2 };
  }
  
  return rasterizePaths(pathDefs, size, classType);
}

/**
 * Rasterize an equipment slot visual to pixel art
 */
export async function rasterizeEquipment(
  slot: EquipmentSlot,
  size: number = 32
): Promise<SpriteData> {
  const path = EQUIPMENT_VISUALS[slot];
  
  return rasterizePaths({
    equipment: { path, fill: 'rgba(180, 180, 180, 0.9)', stroke: 'rgba(30, 30, 30, 1)', strokeWidth: 2 },
  }, size, slot);
}

/**
 * Core rasterization function - renders SVG paths to pixel grid
 */
async function rasterizePaths(
  pathDefs: Record<string, { path: string; fill: string; stroke: string; strokeWidth: number }>,
  size: number,
  name: string
): Promise<SpriteData> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    
    // Scale from 100x100 viewBox to target size
    const scale = size / SVG_VIEWBOX_SIZE;
    
    // Clear with transparent
    ctx.clearRect(0, 0, size, size);
    
    // Draw each path
    for (const [, def] of Object.entries(pathDefs)) {
      if (!def.path) continue;
      
      const path = new Path2D(def.path);
      ctx.save();
      ctx.scale(scale, scale);
      
      if (def.fill) {
        ctx.fillStyle = def.fill;
        ctx.fill(path);
      }
      
      ctx.strokeStyle = def.stroke;
      ctx.lineWidth = def.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke(path);
      
      ctx.restore();
    }
    
    // Sample pixels from canvas
    const imageData = ctx.getImageData(0, 0, size, size);
    const pixels: string[][] = [];
    
    for (let y = 0; y < size; y++) {
      const row: string[] = [];
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        const a = imageData.data[i + 3];
        
        if (a < 10) {
          row.push('transparent');
        } else {
          const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
          row.push(hex);
        }
      }
      pixels.push(row);
    }
    
    const layer: Layer = {
      id: crypto.randomUUID(),
      name,
      visible: true,
      pixels,
    };
    
    resolve({
      width: size,
      height: size,
      layers: [layer],
    });
  });
}

/**
 * Create element color swatch for the color editor
 */
export function getElementColorSwatch(element: ElementType): { primary: string; secondary: string; accent: string } {
  const colors = ELEMENT_COLORS[element];
  
  // Convert HSL strings to hex for display
  const hslToHex = (hsl: string): string => {
    const match = hsl.match(/(\d+)\s+(\d+)%?\s+(\d+)%?/);
    if (!match) return '#808080';
    
    const h = parseInt(match[1]) / 360;
    const s = parseInt(match[2]) / 100;
    const l = parseInt(match[3]) / 100;
    
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    
    return '#' + [r, g, b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
  };
  
  return {
    primary: hslToHex(colors.primary),
    secondary: hslToHex(colors.secondary),
    accent: hslToHex(colors.accent),
  };
}
