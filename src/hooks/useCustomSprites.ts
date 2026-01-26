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

// Convert pixel art to SVG path data for rendering in MonsterSprite
// Uses contour tracing to generate smooth bezier curves from pixel data
function pixelArtToSvgPaths(spriteData: SpriteData): { body: string; detail: string; face: string } {
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
  
  // Scale factor to map pixel grid to 100x100 SVG viewBox
  const scaleX = 100 / width;
  const scaleY = 100 / height;
  
  // Find bounding box
  let minX = width, maxX = 0, minY = height, maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mergedGrid[y][x]) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }
  
  if (minX > maxX) {
    return { body: '', detail: '', face: '' };
  }
  
  // Moore-neighbor contour tracing for smooth outline
  const directions: [number, number][] = [
    [0, -1], [1, -1], [1, 0], [1, 1],
    [0, 1], [-1, 1], [-1, 0], [-1, -1],
  ];
  
  const isFilled = (x: number, y: number) =>
    x >= 0 && x < width && y >= 0 && y < height && mergedGrid[y][x];
  
  // Find starting point
  let startX = -1, startY = -1;
  outerLoop: for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mergedGrid[y][x]) {
        startX = x;
        startY = y;
        break outerLoop;
      }
    }
  }
  
  if (startX === -1) {
    return { body: '', detail: '', face: '' };
  }
  
  // Trace contour
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
  
  // Convert contour to smooth bezier path
  if (contour.length < 3) {
    return { body: '', detail: '', face: '' };
  }
  
  const step = Math.max(1, Math.floor(contour.length / 30));
  const sampled: { x: number; y: number }[] = [];
  for (let i = 0; i < contour.length; i += step) {
    sampled.push(contour[i]);
  }
  if (sampled.length < 3) sampled.push(...contour);
  
  const pathParts: string[] = [];
  const first = sampled[0];
  pathParts.push(`M${(first.x * scaleX).toFixed(1)},${(first.y * scaleY).toFixed(1)}`);
  
  for (let i = 0; i < sampled.length; i++) {
    const curr = sampled[i];
    const next = sampled[(i + 1) % sampled.length];
    const midX = (curr.x + next.x) / 2;
    const midY = (curr.y + next.y) / 2;
    pathParts.push(`Q${(curr.x * scaleX).toFixed(1)},${(curr.y * scaleY).toFixed(1)} ${(midX * scaleX).toFixed(1)},${(midY * scaleY).toFixed(1)}`);
  }
  pathParts.push('Z');
  
  const bodyPath = pathParts.join(' ');
  
  // Extract detail paths from dark pixels (brightness < 0.4)
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
        
        // Very dark pixels in upper half are face features
        if (brightness < 0.2 && py < faceY) {
          facePaths.push(`M${sx.toFixed(1)},${sy.toFixed(1)} m-${r.toFixed(1)},0 a${r.toFixed(1)},${r.toFixed(1)} 0 1,1 ${(r * 2).toFixed(1)},0 a${r.toFixed(1)},${r.toFixed(1)} 0 1,1 -${(r * 2).toFixed(1)},0`);
        } else if (brightness < 0.4) {
          // Dark pixels are detail lines
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
