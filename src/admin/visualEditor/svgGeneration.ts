// SVG Path Generation from Pixel Art
// Uses contour tracing to generate smooth bezier curves

import { SpriteData, mergeVisibleLayers, SVG_VIEWBOX_SIZE } from './types';

interface Point {
  x: number;
  y: number;
}

/**
 * Generate smooth SVG paths from pixel art using contour tracing
 * Returns body path (ALL filled shapes including disconnected regions) and detail/face paths
 */
export function generateSvgPaths(spriteData: SpriteData): {
  body: string;
  detail: string;
  face: string;
} {
  const { width, height } = spriteData;
  const merged = mergeVisibleLayers(spriteData);
  
  // Create binary grid (filled vs empty)
  const binaryGrid: boolean[][] = Array(height).fill(null)
    .map((_, y) => Array(width).fill(null)
      .map((_, x) => {
        const pixel = merged[y]?.[x];
        return pixel && pixel !== 'transparent';
      }));
  
  // Scale factor from pixel grid to 100x100 SVG viewBox
  const scaleX = SVG_VIEWBOX_SIZE / width;
  const scaleY = SVG_VIEWBOX_SIZE / height;

  // Find all connected regions (separate shapes like body, ears, tail, etc.)
  const regions = findConnectedRegions(binaryGrid, width, height);
  
  if (regions.length === 0) {
    return { body: '', detail: '', face: '' };
  }
  
  // Trace contour for each region and combine into a single path
  const bodyPaths: string[] = [];
  
  for (const region of regions) {
    const contour = traceRegionContour(region, width, height);
    if (contour.length >= 3) {
      const path = contourToSmoothPath(contour, scaleX, scaleY);
      if (path) bodyPaths.push(path);
    }
  }
  
  // Find internal details (darker pixels for outlines/features)
  const detailPath = extractDetailPaths(merged, width, height, scaleX, scaleY);
  
  // Face features are typically the darkest pixels in upper portion
  const facePath = extractFacePath(merged, width, height, scaleX, scaleY);
  
  return {
    body: bodyPaths.join(' '),
    detail: detailPath,
    face: facePath,
  };
}

/**
 * Find all connected regions (separate shapes in the sprite)
 */
function findConnectedRegions(grid: boolean[][], width: number, height: number): boolean[][][] {
  const visited = Array(height).fill(null).map(() => Array(width).fill(false));
  const regions: boolean[][][] = [];
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (grid[y][x] && !visited[y][x]) {
        // Found new region - flood fill to mark all connected pixels
        const region = Array(height).fill(null).map(() => Array(width).fill(false));
        const stack: [number, number][] = [[x, y]];
        
        while (stack.length > 0) {
          const [px, py] = stack.pop()!;
          if (px < 0 || px >= width || py < 0 || py >= height) continue;
          if (visited[py][px] || !grid[py][px]) continue;
          
          visited[py][px] = true;
          region[py][px] = true;
          
          // 4-connected neighbors
          stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
        }
        
        regions.push(region);
      }
    }
  }
  
  return regions;
}

/**
 * Moore-neighbor contour tracing for a single region
 */
function traceRegionContour(grid: boolean[][], width: number, height: number): Point[] {
  // Find starting point (topmost-leftmost filled pixel)
  let startX = -1, startY = -1;
  outerLoop: for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (grid[y][x]) {
        startX = x;
        startY = y;
        break outerLoop;
      }
    }
  }
  
  if (startX === -1) return [];
  
  // 8-directional neighbors (clockwise from N)
  const directions: [number, number][] = [
    [0, -1],  // N
    [1, -1],  // NE
    [1, 0],   // E
    [1, 1],   // SE
    [0, 1],   // S
    [-1, 1],  // SW
    [-1, 0],  // W
    [-1, -1], // NW
  ];
  
  const isFilled = (x: number, y: number) =>
    x >= 0 && x < width && y >= 0 && y < height && grid[y][x];
  
  const contour: Point[] = [];
  let x = startX, y = startY;
  let dir = 7; // Start looking NW
  
  do {
    contour.push({ x: x + 0.5, y: y + 0.5 }); // Use pixel centers
    
    // Search clockwise for next boundary pixel
    let found = false;
    for (let i = 0; i < 8; i++) {
      const checkDir = (dir + i) % 8;
      const [dx, dy] = directions[checkDir];
      const nx = x + dx;
      const ny = y + dy;
      
      if (isFilled(nx, ny)) {
        x = nx;
        y = ny;
        dir = (checkDir + 6) % 8; // Turn left for next search
        found = true;
        break;
      }
    }
    
    if (!found || contour.length > width * height * 2) break;
  } while (x !== startX || y !== startY);
  
  return contour;
}

/**
 * Convert contour points to smooth SVG path with quadratic bezier curves
 */
function contourToSmoothPath(contour: Point[], scaleX: number, scaleY: number): string {
  if (contour.length < 3) return '';
  
  // Sample points for smoother curves (skip some for simplification)
  const step = Math.max(1, Math.floor(contour.length / 30));
  const sampled: Point[] = [];
  
  for (let i = 0; i < contour.length; i += step) {
    sampled.push(contour[i]);
  }
  
  if (sampled.length < 3) {
    sampled.length = 0;
    sampled.push(...contour);
  }
  
  // Build path with smooth quadratic curves
  const path: string[] = [];
  
  // Start at first point
  const first = sampled[0];
  path.push(`M${(first.x * scaleX).toFixed(1)},${(first.y * scaleY).toFixed(1)}`);
  
  // Use quadratic beziers through midpoints
  for (let i = 0; i < sampled.length; i++) {
    const curr = sampled[i];
    const next = sampled[(i + 1) % sampled.length];
    
    // Midpoint between current and next
    const midX = (curr.x + next.x) / 2;
    const midY = (curr.y + next.y) / 2;
    
    // Quadratic curve to midpoint, with current as control
    path.push(`Q${(curr.x * scaleX).toFixed(1)},${(curr.y * scaleY).toFixed(1)} ${(midX * scaleX).toFixed(1)},${(midY * scaleY).toFixed(1)}`);
  }
  
  path.push('Z');
  
  return path.join(' ');
}

/**
 * Extract detail paths from darker pixels (outlines, features)
 */
function extractDetailPaths(
  pixels: string[][],
  width: number,
  height: number,
  scaleX: number,
  scaleY: number
): string {
  const paths: string[] = [];
  
  // Find dark pixels (potential detail lines)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixel = pixels[y]?.[x];
      if (pixel && pixel !== 'transparent') {
        const brightness = getPixelBrightness(pixel);
        // Dark pixels (< 40% brightness) are likely details/outlines
        if (brightness < 0.4) {
          // Check if this is an edge pixel (next to transparent or lighter)
          const isEdge = isEdgePixel(pixels, x, y, width, height);
          if (isEdge) {
            const sx = (x + 0.5) * scaleX;
            const sy = (y + 0.5) * scaleY;
            // Create small mark for this detail pixel
            paths.push(`M${sx.toFixed(1)},${sy.toFixed(1)} l${(scaleX * 0.5).toFixed(1)},0`);
          }
        }
      }
    }
  }
  
  return paths.join(' ');
}

/**
 * Extract face features (eyes, mouth) from darkest pixels in upper area
 */
function extractFacePath(
  pixels: string[][],
  width: number,
  height: number,
  scaleX: number,
  scaleY: number
): string {
  const paths: string[] = [];
  const faceY = Math.floor(height * 0.5); // Upper half is typically face area
  
  // Find very dark pixels in upper portion (likely eyes/face)
  for (let y = 0; y < faceY; y++) {
    for (let x = 0; x < width; x++) {
      const pixel = pixels[y]?.[x];
      if (pixel && pixel !== 'transparent') {
        const brightness = getPixelBrightness(pixel);
        // Very dark pixels (< 20% brightness) in upper area are face features
        if (brightness < 0.2) {
          const sx = (x + 0.5) * scaleX;
          const sy = (y + 0.5) * scaleY;
          const r = Math.min(scaleX, scaleY) * 0.4;
          // Create small circle for facial feature
          paths.push(`M${sx.toFixed(1)},${sy.toFixed(1)} m-${r.toFixed(1)},0 a${r.toFixed(1)},${r.toFixed(1)} 0 1,1 ${(r * 2).toFixed(1)},0 a${r.toFixed(1)},${r.toFixed(1)} 0 1,1 -${(r * 2).toFixed(1)},0`);
        }
      }
    }
  }
  
  return paths.join(' ');
}

/**
 * Get brightness of hex color (0-1)
 */
function getPixelBrightness(hex: string): number {
  if (!hex || hex === 'transparent' || hex.length < 7) return 1;
  
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  
  // Relative luminance
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Check if pixel is on edge (adjacent to transparent or significantly lighter)
 */
function isEdgePixel(
  pixels: string[][],
  x: number,
  y: number,
  width: number,
  height: number
): boolean {
  const neighbors = [
    [x - 1, y], [x + 1, y],
    [x, y - 1], [x, y + 1],
  ];
  
  for (const [nx, ny] of neighbors) {
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
      return true; // Edge of canvas
    }
    const neighbor = pixels[ny]?.[nx];
    if (!neighbor || neighbor === 'transparent') {
      return true;
    }
  }
  
  return false;
}

/**
 * Format SVG path code for export (ready to paste into sprites.tsx)
 */
export function formatSvgExport(
  componentName: string,
  paths: { body: string; detail: string; face: string }
): string {
  return `// ${componentName}
{
  body: '${paths.body}',
  detail: '${paths.detail}',
  face: '${paths.face}',
}`;
}
