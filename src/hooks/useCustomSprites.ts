import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PixelLayer {
  id: string;
  name: string;
  visible?: boolean;
  pixels: string[][];
}

interface SpriteData {
  width: number;
  height: number;
  layers: PixelLayer[];
}

interface CustomSprite {
  id: string;
  sprite_key: string;
  sprite_data: SpriteData;
  created_at: string;
  updated_at: string;
}

// Global cache to avoid re-fetching on every component mount
let globalSpriteCache: Map<string, SpriteData> = new Map();
let globalCacheLoaded = false;
let globalCachePromise: Promise<void> | null = null;

// Ramer-Douglas-Peucker algorithm for path simplification
function rdpSimplify(points: { x: number; y: number }[], epsilon: number): { x: number; y: number }[] {
  if (points.length <= 2) return points;
  
  let maxDist = 0;
  let maxIndex = 0;
  const first = points[0];
  const last = points[points.length - 1];
  
  for (let i = 1; i < points.length - 1; i++) {
    const dx = last.x - first.x;
    const dy = last.y - first.y;
    let dist: number;
    
    if (dx === 0 && dy === 0) {
      dist = Math.sqrt((points[i].x - first.x) ** 2 + (points[i].y - first.y) ** 2);
    } else {
      const t = ((points[i].x - first.x) * dx + (points[i].y - first.y) * dy) / (dx * dx + dy * dy);
      const nearestX = first.x + t * dx;
      const nearestY = first.y + t * dy;
      dist = Math.sqrt((points[i].x - nearestX) ** 2 + (points[i].y - nearestY) ** 2);
    }
    
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }
  
  if (maxDist > epsilon) {
    const left = rdpSimplify(points.slice(0, maxIndex + 1), epsilon);
    const right = rdpSimplify(points.slice(maxIndex), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  
  return [first, last];
}

// Chaikin corner-cutting for smooth curves
function chaikinSmooth(points: { x: number; y: number }[], iterations: number = 2): { x: number; y: number }[] {
  if (points.length < 3) return points;
  
  let result = [...points];
  
  for (let iter = 0; iter < iterations; iter++) {
    const smoothed: { x: number; y: number }[] = [];
    
    for (let i = 0; i < result.length; i++) {
      const curr = result[i];
      const next = result[(i + 1) % result.length];
      
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

// Convert pixel art to SVG path data using RDP + Chaikin smoothing
function pixelArtToSvgPaths(spriteData: SpriteData): { body: string; detail: string; face: string } {
  // Check if this is direct SVG data (not pixel art)
  const data = spriteData as any;
  if (data._type === 'direct_svg' && data.paths) {
    return data.paths;
  }
  
  const { width, height, layers } = spriteData;
  
  // Merge all visible layers into a single grid
  const mergedGrid: boolean[][] = Array(height).fill(null).map(() => Array(width).fill(false));
  const colorGrid: string[][] = Array(height).fill(null).map(() => Array(width).fill('transparent'));
  
  for (const layer of layers) {
    if (layer.visible === false) continue;
    for (let y = 0; y < Math.min(layer.pixels.length, height); y++) {
      for (let x = 0; x < Math.min(layer.pixels[y]?.length || 0, width); x++) {
        const color = layer.pixels[y][x];
        if (color && color !== 'transparent') {
          mergedGrid[y][x] = true;
          colorGrid[y][x] = color;
        }
      }
    }
  }
  
  const scaleX = 100 / width;
  const scaleY = 100 / height;
  
  // Find all connected regions
  const visited = Array(height).fill(null).map(() => Array(width).fill(false));
  const regions: boolean[][][] = [];
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mergedGrid[y][x] && !visited[y][x]) {
        const region = Array(height).fill(null).map(() => Array(width).fill(false));
        const stack: [number, number][] = [[x, y]];
        
        while (stack.length > 0) {
          const [px, py] = stack.pop()!;
          if (px < 0 || px >= width || py < 0 || py >= height) continue;
          if (visited[py][px] || !mergedGrid[py][px]) continue;
          
          visited[py][px] = true;
          region[py][px] = true;
          stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
        }
        
        regions.push(region);
      }
    }
  }
  
  if (regions.length === 0) {
    return { body: '', detail: '', face: '' };
  }
  
  const bodyPaths: string[] = [];
  
  for (const region of regions) {
    // Moore-neighbor contour tracing
    let startX = -1, startY = -1;
    outerLoop: for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (region[y][x]) {
          startX = x;
          startY = y;
          break outerLoop;
        }
      }
    }
    
    if (startX === -1) continue;
    
    const directions: [number, number][] = [
      [0, -1], [1, -1], [1, 0], [1, 1],
      [0, 1], [-1, 1], [-1, 0], [-1, -1],
    ];
    
    const isFilled = (x: number, y: number) =>
      x >= 0 && x < width && y >= 0 && y < height && region[y][x];
    
    const contour: { x: number; y: number }[] = [];
    let x = startX, y = startY;
    let dir = 7;
    
    do {
      contour.push({ x: x + 0.5, y: y + 0.5 });
      
      let found = false;
      for (let i = 0; i < 8; i++) {
        const checkDir = (dir + i) % 8;
        const [dx, dy] = directions[checkDir];
        const nx = x + dx;
        const ny = y + dy;
        
        if (isFilled(nx, ny)) {
          x = nx;
          y = ny;
          dir = (checkDir + 6) % 8;
          found = true;
          break;
        }
      }
      
      if (!found || contour.length > width * height * 2) break;
    } while (x !== startX || y !== startY);
    
    if (contour.length < 3) continue;
    
    // RDP simplification + Chaikin smoothing
    const simplified = rdpSimplify(contour, 0.3);
    if (simplified.length < 3) continue;
    
    const smoothed = chaikinSmooth(simplified, 2);
    if (smoothed.length < 3) continue;
    
    // Build cubic bezier path
    const pathParts: string[] = [];
    const first = smoothed[0];
    pathParts.push(`M${(first.x * scaleX).toFixed(1)},${(first.y * scaleY).toFixed(1)}`);
    
    for (let i = 0; i < smoothed.length; i++) {
      const p0 = smoothed[(i - 1 + smoothed.length) % smoothed.length];
      const p1 = smoothed[i];
      const p2 = smoothed[(i + 1) % smoothed.length];
      const p3 = smoothed[(i + 2) % smoothed.length];
      
      const tension = 6;
      const cp1x = p1.x + (p2.x - p0.x) / tension;
      const cp1y = p1.y + (p2.y - p0.y) / tension;
      const cp2x = p2.x - (p3.x - p1.x) / tension;
      const cp2y = p2.y - (p3.y - p1.y) / tension;
      
      pathParts.push(`C${(cp1x * scaleX).toFixed(1)},${(cp1y * scaleY).toFixed(1)} ${(cp2x * scaleX).toFixed(1)},${(cp2y * scaleY).toFixed(1)} ${(p2.x * scaleX).toFixed(1)},${(p2.y * scaleY).toFixed(1)}`);
    }
    pathParts.push('Z');
    
    bodyPaths.push(pathParts.join(' '));
  }
  
  const bodyPath = bodyPaths.join(' ');
  
  // Extract detail/face paths from dark pixels
  const detailPaths: string[] = [];
  const facePaths: string[] = [];
  const faceY = Math.floor(height * 0.5);
  
  const getBrightness = (hex: string): number => {
    if (!hex || hex === 'transparent' || hex.length < 7) return 1;
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return 0.299 * r + 0.587 * g + 0.114 * b;
  };
  
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const pixel = colorGrid[py]?.[px];
      if (pixel && pixel !== 'transparent') {
        const brightness = getBrightness(pixel);
        const sx = (px + 0.5) * scaleX;
        const sy = (py + 0.5) * scaleY;
        const r = Math.min(scaleX, scaleY) * 0.4;
        
        if (brightness < 0.2 && py < faceY) {
          facePaths.push(`M${sx.toFixed(1)},${sy.toFixed(1)} m-${r.toFixed(1)},0 a${r.toFixed(1)},${r.toFixed(1)} 0 1,1 ${(r * 2).toFixed(1)},0 a${r.toFixed(1)},${r.toFixed(1)} 0 1,1 -${(r * 2).toFixed(1)},0`);
        } else if (brightness < 0.4) {
          detailPaths.push(`M${sx.toFixed(1)},${sy.toFixed(1)} l${(scaleX * 0.3).toFixed(1)},0`);
        }
      }
    }
  }
  
  return {
    body: bodyPath,
    detail: detailPaths.join(' '),
    face: facePaths.join(' '),
  };
}

export function useCustomSprites() {
  const [sprites, setSprites] = useState<Map<string, SpriteData>>(globalSpriteCache);
  const [loading, setLoading] = useState(!globalCacheLoaded);

  const fetchSprites = useCallback(async () => {
    // If already loading, wait for that promise
    if (globalCachePromise) {
      await globalCachePromise;
      setSprites(new Map(globalSpriteCache));
      setLoading(false);
      return;
    }

    // If already loaded, just use the cache
    if (globalCacheLoaded) {
      setSprites(new Map(globalSpriteCache));
      setLoading(false);
      return;
    }

    setLoading(true);
    
    globalCachePromise = (async () => {
      try {
        const { data, error } = await supabase
          .from('custom_sprites')
          .select('*')
          .order('updated_at', { ascending: false });

        if (error) throw error;

        const newCache = new Map<string, SpriteData>();
        for (const sprite of (data || [])) {
          newCache.set(sprite.sprite_key, sprite.sprite_data as unknown as SpriteData);
        }
        
        globalSpriteCache = newCache;
        globalCacheLoaded = true;
      } catch (err) {
        console.error('Failed to fetch custom sprites:', err);
      } finally {
        globalCachePromise = null;
      }
    })();

    await globalCachePromise;
    setSprites(new Map(globalSpriteCache));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSprites();
  }, [fetchSprites]);

  const getSpriteOverride = useCallback((speciesKey: string, _elementKey: string): { body: string; detail: string; face: string } | null => {
    // Look up by species only - custom sprites are base shapes colored by element system
    const spriteData = sprites.get(speciesKey);
    
    if (!spriteData) return null;
    
    return pixelArtToSvgPaths(spriteData);
  }, [sprites]);

  const invalidateCache = useCallback(() => {
    globalCacheLoaded = false;
    globalSpriteCache = new Map();
    fetchSprites();
  }, [fetchSprites]);

  return {
    sprites,
    loading,
    getSpriteOverride,
    refetch: invalidateCache,
  };
}

// Singleton context for sprite overrides - looks up by species only
export function getGlobalSpriteOverride(speciesKey: string, _elementKey: string): { body: string; detail: string; face: string } | null {
  // Look up by species only - custom sprites provide base shapes that game colorizes with elements
  const spriteData = globalSpriteCache.get(speciesKey);
  
  if (!spriteData) return null;
  
  return pixelArtToSvgPaths(spriteData);
}

// Invalidate cache and force reload
export function invalidateSpriteCache(): void {
  globalCacheLoaded = false;
  globalSpriteCache = new Map();
}

// Pre-load sprites on app init (or force reload if invalidated)
export async function preloadCustomSprites(force = false): Promise<void> {
  if (globalCacheLoaded && !force) return;
  
  // Reset for force reload
  if (force) {
    globalCacheLoaded = false;
    globalSpriteCache = new Map();
  }
  
  try {
    const { data, error } = await supabase
      .from('custom_sprites')
      .select('*');

    if (error) throw error;

    const newCache = new Map<string, SpriteData>();
    for (const sprite of (data || [])) {
      newCache.set(sprite.sprite_key, sprite.sprite_data as unknown as SpriteData);
    }
    
    globalSpriteCache = newCache;
    globalCacheLoaded = true;
    
    if (newCache.size > 0) {
      console.log(`[CustomSprites] Loaded ${newCache.size} custom sprites:`, Array.from(newCache.keys()));
    }
  } catch (err) {
    console.error('Failed to preload custom sprites:', err);
  }
}
