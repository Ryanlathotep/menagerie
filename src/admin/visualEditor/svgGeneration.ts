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
 * Ramer-Douglas-Peucker algorithm for path simplification
 * Reduces points while preserving overall shape
 */
function rdpSimplify(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2) return points;
  
  // Find point with max distance from line between first and last
  let maxDist = 0;
  let maxIndex = 0;
  const first = points[0];
  const last = points[points.length - 1];
  
  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], first, last);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }
  
  // If max distance exceeds epsilon, recursively simplify
  if (maxDist > epsilon) {
    const left = rdpSimplify(points.slice(0, maxIndex + 1), epsilon);
    const right = rdpSimplify(points.slice(maxIndex), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  
  return [first, last];
}

/**
 * Calculate perpendicular distance from point to line
 */
function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  
  if (dx === 0 && dy === 0) {
    return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2);
  }
  
  const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy);
  const nearestX = lineStart.x + t * dx;
  const nearestY = lineStart.y + t * dy;
  
  return Math.sqrt((point.x - nearestX) ** 2 + (point.y - nearestY) ** 2);
}

/**
 * Chaikin corner-cutting algorithm for curve smoothing
 * Creates smooth curves by iteratively cutting corners
 */
function chaikinSmooth(points: Point[], iterations: number = 2): Point[] {
  if (points.length < 3) return points;
  
  let result = [...points];
  
  for (let iter = 0; iter < iterations; iter++) {
    const smoothed: Point[] = [];
    
    for (let i = 0; i < result.length; i++) {
      const curr = result[i];
      const next = result[(i + 1) % result.length];
      
      // 1/4 and 3/4 points between curr and next
      smoothed.push({
        x: curr.x * 0.75 + next.x * 0.25,
        y: curr.y * 0.75 + next.y * 0.25,
      });
      smoothed.push({
        x: curr.x * 0.25 + next.x * 0.75,
        y: curr.y * 0.25 + next.y * 0.75,
      });
    }
    
    result = smoothed;
  }
  
  return result;
}

/**
 * Convert contour points to smooth SVG path with cubic bezier curves
 * Uses RDP simplification + Chaikin smoothing for high-quality output
 */
function contourToSmoothPath(contour: Point[], scaleX: number, scaleY: number): string {
  if (contour.length < 3) return '';
  
  // Step 1: Simplify with RDP to remove redundant points
  // Epsilon of 0.3 preserves shape while removing noise
  const simplified = rdpSimplify(contour, 0.3);
  
  if (simplified.length < 3) return '';
  
  // Step 2: Apply Chaikin smoothing (2 iterations for nice curves)
  const smoothed = chaikinSmooth(simplified, 2);
  
  if (smoothed.length < 3) return '';
  
  // Step 3: Build cubic bezier path for maximum smoothness
  const path: string[] = [];
  
  // Start at first point
  const first = smoothed[0];
  path.push(`M${(first.x * scaleX).toFixed(1)},${(first.y * scaleY).toFixed(1)}`);
  
  // Use cubic beziers with Catmull-Rom to bezier conversion for smooth curves
  for (let i = 0; i < smoothed.length; i++) {
    const p0 = smoothed[(i - 1 + smoothed.length) % smoothed.length];
    const p1 = smoothed[i];
    const p2 = smoothed[(i + 1) % smoothed.length];
    const p3 = smoothed[(i + 2) % smoothed.length];
    
    // Catmull-Rom to cubic bezier conversion
    const tension = 6; // Higher = tighter curves
    const cp1x = p1.x + (p2.x - p0.x) / tension;
    const cp1y = p1.y + (p2.y - p0.y) / tension;
    const cp2x = p2.x - (p3.x - p1.x) / tension;
    const cp2y = p2.y - (p3.y - p1.y) / tension;
    
    path.push(`C${(cp1x * scaleX).toFixed(1)},${(cp1y * scaleY).toFixed(1)} ${(cp2x * scaleX).toFixed(1)},${(cp2y * scaleY).toFixed(1)} ${(p2.x * scaleX).toFixed(1)},${(p2.y * scaleY).toFixed(1)}`);
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
