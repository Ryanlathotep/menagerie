// SVG ↔ Pixel Art Conversion Utilities

import { SPECIES_DATA, SpeciesType, ElementType, ClassType, ELEMENT_COLORS } from '@/game/types';

// SVG path data copied from sprites.tsx for conversion purposes
export const SPECIES_SVG_PATHS: Record<SpeciesType, { body: string; detail: string; face: string }> = {
  slime: {
    body: 'M50,85 C20,85 10,60 15,40 C20,20 35,12 50,12 C65,12 80,20 85,40 C90,60 80,85 50,85',
    detail: 'M30,50 Q35,55 32,62 M70,50 Q65,55 68,62 M40,70 Q50,75 60,70',
    face: 'M38,40 A5,5 0 1,1 38.01,40 M62,40 A5,5 0 1,1 62.01,40 M42,55 Q50,65 58,55',
  },
  skeleton: {
    body: 'M50,8 A12,12 0 1,1 50.01,8 M35,28 Q30,42 35,56 L38,56 L38,28 Z M62,28 Q67,42 62,56 L65,56 L65,28 Z M38,56 L35,60 Q32,64 38,68 L62,68 Q68,64 65,60 L62,56',
    detail: 'M42,34 L58,34 M42,40 L58,40 M42,46 L58,46 M42,52 L58,52 M24,32 L35,36 L35,40 L26,44 M76,32 L65,36 L65,40 L74,44 M42,68 L40,78 L38,90 M46,68 L46,90 M54,68 L54,90 M58,68 L60,78 L62,90',
    face: 'M44,10 A4,4 0 1,1 44.01,10 M56,10 A4,4 0 1,1 56.01,10 M46,18 L50,22 L54,18 M44,24 L56,24',
  },
  goblin: {
    body: 'M50,12 A10,10 0 1,1 50.01,12 M42,24 L42,50 L58,50 L58,24 M42,50 L40,70 L38,90 L44,90 L46,70 L50,70 L54,70 L56,90 L62,90 L60,70 L58,50 M28,36 L42,32 L42,48 L24,52 M72,36 L58,32 L58,48 L76,52',
    detail: 'M32,6 L40,16 M68,6 L60,16 M44,36 L48,38 M56,36 L52,38',
    face: 'M44,12 A3,3 0 1,1 44.01,12 M56,12 A3,3 0 1,1 56.01,12 M50,18 L50,22 L48,26 M52,24 L48,24',
  },
  mushroom: {
    body: 'M50,6 Q85,6 85,30 Q85,48 50,52 Q15,48 15,30 Q15,6 50,6 M40,52 L40,90 L60,90 L60,52',
    detail: 'M28,18 A7,7 0 1,1 28.01,18 M55,14 A9,9 0 1,1 55.01,14 M74,24 A5,5 0 1,1 74.01,24 M38,32 A4,4 0 1,1 38.01,32',
    face: 'M42,36 A3,3 0 1,1 42.01,36 M58,36 A3,3 0 1,1 58.01,36 M48,44 Q50,46 52,44',
  },
  ghost: {
    body: 'M50,10 Q80,10 80,40 L80,72 Q74,68 68,72 Q62,76 56,72 Q50,78 44,72 Q38,76 32,72 Q26,68 20,72 L20,40 Q20,10 50,10',
    detail: 'M35,55 Q30,60 35,65 M65,55 Q70,60 65,65',
    face: 'M36,36 A8,8 0 1,1 36.01,36 M64,36 A8,8 0 1,1 64.01,36 M40,36 A3,3 0 1,1 40.01,36 M68,36 A3,3 0 1,1 68.01,36 M50,52 A4,6 0 1,1 50.01,52',
  },
  imp: {
    body: 'M50,24 Q60,24 60,38 L60,55 L56,72 L54,90 L46,90 L44,72 L40,55 L40,38 Q40,24 50,24 M28,44 L40,40 M72,44 L60,40',
    detail: 'M40,12 L44,24 M60,12 L56,24 M22,35 Q14,28 18,45 Q10,55 28,50 M78,35 Q86,28 82,45 Q90,55 72,50 M50,90 Q55,88 58,92 Q62,88 65,95',
    face: 'M45,36 A3,3 0 1,1 45.01,36 M55,36 A3,3 0 1,1 55.01,36 M46,46 L50,50 L54,46 M48,52 L52,52',
  },
  golem: {
    body: 'M34,14 L66,14 L72,28 L72,52 L68,58 L68,90 L56,90 L56,60 L44,60 L44,90 L32,90 L32,58 L28,52 L28,28 Z M22,38 L32,42 M78,38 L68,42',
    detail: 'M38,28 L48,28 M52,28 L62,28 M38,38 L48,38 M52,38 L62,38 M40,48 L60,48 M44,72 L44,82 M56,72 L56,82',
    face: 'M40,22 A5,5 0 1,1 40.01,22 M60,22 A5,5 0 1,1 60.01,22',
  },
  wisp: {
    body: 'M50,18 A18,18 0 1,1 50.01,18',
    detail: 'M50,36 Q60,52 55,70 Q50,88 45,70 Q40,52 50,36 M32,28 Q24,18 28,38 M68,28 Q76,18 72,38 M28,42 Q20,48 26,55 M72,42 Q80,48 74,55',
    face: 'M42,24 A4,4 0 1,1 42.01,24 M58,24 A4,4 0 1,1 58.01,24',
  },
  chimera: {
    body: 'M50,26 Q62,22 62,38 L62,52 L66,65 L66,90 L56,90 L52,60 L48,60 L44,90 L34,90 L34,65 L38,52 L38,38 Q38,22 50,26 M26,48 L38,44 M74,48 L62,44',
    detail: 'M30,14 Q18,6 24,22 M70,14 Q82,6 76,22 M50,10 Q56,2 52,8 M36,55 L32,58 M64,55 L68,58',
    face: 'M44,34 A3,3 0 1,1 44.01,34 M56,34 A3,3 0 1,1 56.01,34 M32,18 A2,2 0 1,1 32.01,18 M68,18 A2,2 0 1,1 68.01,18 M50,42 L50,48 L47,52',
  },
  dragon: {
    body: 'M50,16 Q70,16 70,34 L68,44 L70,54 L70,72 L58,90 L42,90 L30,72 L30,54 L32,44 L30,34 Q30,16 50,16 M26,50 L30,48 M74,50 L70,48',
    detail: 'M16,30 Q8,18 20,38 Q8,58 30,48 M84,30 Q92,18 80,38 Q92,58 70,48 M30,16 L24,4 M70,16 L76,4 M40,70 L38,78 M60,70 L62,78',
    face: 'M40,30 A4,4 0 1,1 40.01,30 M60,30 A4,4 0 1,1 60.01,30 M50,40 L50,50 M45,56 L50,60 L55,56',
  },
  rat: {
    body: 'M58,28 Q70,30 68,42 L66,52 L60,65 L55,78 L52,90 L48,90 L45,78 L40,65 L34,52 L32,42 Q30,30 42,28 L50,22 L58,28 M26,46 L34,44 M74,46 L66,44',
    detail: 'M28,22 A10,10 0 1,1 28.01,22 M72,22 A10,10 0 1,1 72.01,22 M68,55 Q78,58 86,52 Q90,56 88,64 Q92,68 88,74 Q94,80 86,82 M34,78 L30,82 L36,84 M54,78 L58,82 L52,84 M32,38 L26,34 M34,42 L26,42 M32,46 L26,50',
    face: 'M42,34 A3,3 0 1,1 42.01,34 M54,34 A3,3 0 1,1 54.01,34 M50,40 L56,46 L56,50 L50,48 Z',
  },
  spider: {
    body: 'M50,28 A16,13 0 1,1 50.01,28 M50,41 A12,10 0 1,1 50.01,41',
    detail: 'M34,32 L14,12 M30,38 L4,36 M30,46 L10,62 M34,52 L22,80 M66,32 L86,12 M70,38 L96,36 M70,46 L90,62 M66,52 L78,80',
    face: 'M42,26 A3,3 0 1,1 42.01,26 M58,26 A3,3 0 1,1 58.01,26 M46,26 A2,2 0 1,1 46.01,26 M54,26 A2,2 0 1,1 54.01,26 M48,34 L50,38 L52,34',
  },
  bat: {
    body: 'M50,18 A14,14 0 1,1 50.01,18 M36,28 L20,20 L12,32 L18,44 L28,50 L36,44 L36,28 M64,28 L80,20 L88,32 L82,44 L72,50 L64,44 L64,28 M46,46 L46,56 L48,60 L46,62 M54,46 L54,56 L52,60 L54,62',
    detail: 'M12,32 L8,24 M88,32 L92,24 M20,20 L16,14 M80,20 L84,14 M24,38 L20,42 M76,38 L80,42 M28,50 L24,56 M72,50 L76,56',
    face: 'M38,12 Q34,4 40,8 M62,12 Q66,4 60,8 M44,18 A3,3 0 1,1 44.01,18 M56,18 A3,3 0 1,1 56.01,18 M48,26 L50,30 L52,26',
  },
  snake: {
    body: 'M50,12 Q74,12 74,30 Q74,48 55,52 Q36,56 36,74 Q36,90 55,90 Q68,90 68,82',
    detail: 'M55,58 Q52,64 55,70 M40,78 Q38,84 42,88 M60,70 Q65,74 62,80',
    face: 'M42,20 A4,4 0 1,1 42.01,20 M58,20 A4,4 0 1,1 58.01,20 M48,28 L45,38 M52,28 L55,38 M44,38 L48,40 L52,40 L56,38',
  },
  wolf: {
    body: 'M50,20 Q68,16 70,36 L70,54 L64,72 L60,90 L40,90 L36,72 L30,54 L30,36 Q32,16 50,20 M26,50 L30,48 M74,50 L70,48',
    detail: 'M28,12 L36,26 M72,12 L64,26 M40,60 L36,65 M60,60 L64,65 M36,72 L32,76 M64,72 L68,76',
    face: 'M40,36 A4,4 0 1,1 40.01,36 M60,36 A4,4 0 1,1 60.01,36 M50,46 L50,58 L44,64 L50,68 L56,64 L50,58',
  },
  beetle: {
    body: 'M50,16 Q78,16 80,42 L80,64 Q80,90 50,90 Q20,90 20,64 L20,42 Q22,16 50,16',
    detail: 'M50,16 L50,90 M30,42 L30,75 M70,42 L70,75 M32,16 L26,4 M68,16 L74,4',
    face: 'M38,36 A5,5 0 1,1 38.01,36 M62,36 A5,5 0 1,1 62.01,36',
  },
  crow: {
    body: 'M50,20 Q68,16 68,38 L68,58 L56,88 L44,88 L32,58 L32,38 Q32,16 50,20 M26,44 L32,40 M74,44 L68,40',
    detail: 'M32,34 L18,30 L26,42 M68,34 L82,30 L74,42 M44,70 L40,80 M56,70 L60,80',
    face: 'M42,28 A3,3 0 1,1 42.01,28 M58,28 A3,3 0 1,1 58.01,28 M50,36 L50,54 L38,62 L42,58',
  },
  shark: {
    body: 'M15,50 Q26,32 50,32 Q74,32 90,50 Q84,60 74,60 L64,56 L50,60 L36,56 L26,60 Q15,60 15,50',
    detail: 'M50,18 L56,32 L44,32 Z M30,50 L26,54 M70,50 L74,54 M56,50 L60,54 M44,50 L40,54',
    face: 'M30,46 A4,4 0 1,1 30.01,46 M20,52 L14,46 L26,50 L20,58',
  },
  frog: {
    body: 'M50,32 Q82,32 82,58 Q82,85 50,85 Q18,85 18,58 Q18,32 50,32',
    detail: 'M10,65 L4,78 L14,72 L8,85 L18,78 M90,65 L96,78 L86,72 L92,85 L82,78 M35,72 L30,82 L40,78 M65,72 L70,82 L60,78',
    face: 'M30,20 A12,12 0 1,1 30.01,20 M70,20 A12,12 0 1,1 70.01,20 M34,20 A4,4 0 1,1 34.01,20 M66,20 A4,4 0 1,1 66.01,20 M45,55 Q50,60 55,55',
  },
  jellyfish: {
    body: 'M50,10 Q85,10 85,38 Q85,54 50,54 Q15,54 15,38 Q15,10 50,10',
    detail: 'M26,54 Q18,72 26,92 M36,54 Q42,76 36,96 M46,54 Q46,72 46,92 M54,54 Q54,76 54,96 M64,54 Q58,76 64,92 M74,54 Q82,72 74,88 M32,70 Q28,75 32,80 M68,70 Q72,75 68,80',
    face: 'M40,30 A4,4 0 1,1 40.01,30 M60,30 A4,4 0 1,1 60.01,30',
  },
};

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  pixels: string[][];
}

export interface SpriteData {
  width: number;
  height: number;
  layers: Layer[];
}

/**
 * Rasterize an SVG species sprite to pixel art
 * Uses an offscreen canvas to render the SVG and sample pixels
 */
export function svgToPixelArt(
  species: SpeciesType,
  size: number = 32,
  element: ElementType = 'normal',
  includeDetails: boolean = true
): Promise<SpriteData> {
  return new Promise((resolve) => {
    const paths = SPECIES_SVG_PATHS[species];
    const colors = ELEMENT_COLORS[element];
    
    // Create an offscreen canvas
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    
    // Scale factor from 100x100 SVG viewBox to target size
    const scale = size / 100;
    
    // Clear with transparent
    ctx.clearRect(0, 0, size, size);
    
    // Helper to draw an SVG path
    const drawPath = (pathData: string, fillColor: string | null, strokeColor: string, strokeWidth: number) => {
      const path = new Path2D(pathData);
      ctx.save();
      ctx.scale(scale, scale);
      if (fillColor) {
        ctx.fillStyle = fillColor;
        ctx.fill(path);
      }
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke(path);
      ctx.restore();
    };
    
    // Convert HSL string to CSS
    const hslToColor = (hsl: string, alpha: number = 1) => `hsla(${hsl} / ${alpha})`;
    
    // Draw body fill with element color
    drawPath(paths.body, hslToColor(colors.primary, 0.6), hslToColor('0 0% 10%', 1), 3.5);
    
    // Draw details
    if (includeDetails && paths.detail) {
      drawPath(paths.detail, null, hslToColor('0 0% 15%', 1), 2.5);
    }
    
    // Draw face
    if (paths.face) {
      drawPath(paths.face, hslToColor('0 0% 8%', 1), hslToColor('0 0% 5%', 1), 2.5);
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
          // Convert to hex
          const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
          row.push(hex);
        }
      }
      pixels.push(row);
    }
    
    const layer: Layer = {
      id: crypto.randomUUID(),
      name: `${species} (${element})`,
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
 * Convert pixel art back to SVG path data (simplified outline)
 * This creates a traced outline of the pixel art
 */
export function pixelArtToSvgPath(spriteData: SpriteData): { outline: string; filled: string } {
  const { width, height, layers } = spriteData;
  
  // Merge all visible layers into one
  const merged: string[][] = Array(height).fill(null).map(() => Array(width).fill('transparent'));
  
  for (const layer of layers) {
    if (!layer.visible) continue;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixel = layer.pixels[y]?.[x];
        if (pixel && pixel !== 'transparent') {
          merged[y][x] = pixel;
        }
      }
    }
  }
  
  // Scale factor to 100x100 viewBox
  const scaleX = 100 / width;
  const scaleY = 100 / height;
  
  // Generate filled rectangles for each pixel
  const rects: string[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (merged[y][x] !== 'transparent') {
        const sx = x * scaleX;
        const sy = y * scaleY;
        rects.push(`M${sx},${sy} h${scaleX} v${scaleY} h${-scaleX} Z`);
      }
    }
  }
  
  // Simple edge detection for outline
  const edges: string[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const isFilled = merged[y][x] !== 'transparent';
      if (!isFilled) continue;
      
      const sx = x * scaleX;
      const sy = y * scaleY;
      
      // Check each edge
      const top = y === 0 || merged[y - 1][x] === 'transparent';
      const bottom = y === height - 1 || merged[y + 1][x] === 'transparent';
      const left = x === 0 || merged[y][x - 1] === 'transparent';
      const right = x === width - 1 || merged[y][x + 1] === 'transparent';
      
      if (top) edges.push(`M${sx},${sy} h${scaleX}`);
      if (bottom) edges.push(`M${sx},${sy + scaleY} h${scaleX}`);
      if (left) edges.push(`M${sx},${sy} v${scaleY}`);
      if (right) edges.push(`M${sx + scaleX},${sy} v${scaleY}`);
    }
  }
  
  return {
    outline: edges.join(' '),
    filled: rects.join(' '),
  };
}

// Get list of all available species for the import browser
export function getAvailableSpecies(): Array<{ species: SpeciesType; name: string; category: 'fantasy' | 'real' }> {
  return Object.entries(SPECIES_DATA).map(([species, data]) => ({
    species: species as SpeciesType,
    name: data.name,
    category: data.category,
  }));
}
