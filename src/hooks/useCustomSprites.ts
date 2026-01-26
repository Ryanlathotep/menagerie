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
// Uses marching squares to generate a smooth outline path from pixel data
function pixelArtToSvgPaths(spriteData: SpriteData): { body: string; detail: string; face: string } {
  const { width, height, layers } = spriteData;
  
  // Merge all visible layers into a single grid
  const mergedGrid: boolean[][] = Array(height).fill(null).map(() => Array(width).fill(false));
  
  for (const layer of layers) {
    if (layer.visible === false) continue;
    for (let y = 0; y < Math.min(layer.pixels.length, height); y++) {
      for (let x = 0; x < Math.min(layer.pixels[y]?.length || 0, width); x++) {
        const color = layer.pixels[y][x];
        if (color && color !== 'transparent') {
          mergedGrid[y][x] = true;
        }
      }
    }
  }
  
  // Scale factor to map pixel grid to 100x100 SVG viewBox
  const scaleX = 100 / width;
  const scaleY = 100 / height;
  
  // Find the bounding box and generate an outline path
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
    // No pixels found, return empty
    return { body: '', detail: '', face: '' };
  }
  
  // Generate outline edges using edge detection
  const edges: string[] = [];
  
  for (let y = minY; y <= maxY + 1; y++) {
    for (let x = minX; x <= maxX + 1; x++) {
      const current = y < height && x < width && mergedGrid[y]?.[x];
      const left = x > 0 && y < height && mergedGrid[y]?.[x - 1];
      const above = y > 0 && x < width && mergedGrid[y - 1]?.[x];
      
      const sx = x * scaleX;
      const sy = y * scaleY;
      
      // Vertical edge (between left and current)
      if (current !== left) {
        edges.push(`M${sx},${sy} v${scaleY}`);
      }
      // Horizontal edge (between above and current)
      if (current !== above) {
        edges.push(`M${sx},${sy} h${scaleX}`);
      }
    }
  }
  
  // Create a filled body shape using a simplified convex hull approach
  // Find outline points
  const outlinePoints: [number, number][] = [];
  
  // Top edge - scan from top
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      if (mergedGrid[y][x]) {
        outlinePoints.push([x * scaleX + scaleX / 2, y * scaleY]);
        break;
      }
    }
  }
  
  // Right edge - scan from right
  for (let y = minY; y <= maxY; y++) {
    for (let x = maxX; x >= minX; x--) {
      if (mergedGrid[y][x]) {
        outlinePoints.push([(x + 1) * scaleX, y * scaleY + scaleY / 2]);
        break;
      }
    }
  }
  
  // Bottom edge - scan from bottom (reverse)
  for (let x = maxX; x >= minX; x--) {
    for (let y = maxY; y >= minY; y--) {
      if (mergedGrid[y][x]) {
        outlinePoints.push([x * scaleX + scaleX / 2, (y + 1) * scaleY]);
        break;
      }
    }
  }
  
  // Left edge - scan from left (reverse)
  for (let y = maxY; y >= minY; y--) {
    for (let x = minX; x <= maxX; x++) {
      if (mergedGrid[y][x]) {
        outlinePoints.push([x * scaleX, y * scaleY + scaleY / 2]);
        break;
      }
    }
  }
  
  // Build body path from outline points
  let bodyPath = '';
  if (outlinePoints.length > 2) {
    bodyPath = `M${outlinePoints[0][0]},${outlinePoints[0][1]}`;
    for (let i = 1; i < outlinePoints.length; i++) {
      bodyPath += ` L${outlinePoints[i][0]},${outlinePoints[i][1]}`;
    }
    bodyPath += ' Z';
  }
  
  return {
    body: bodyPath,
    detail: edges.join(' '), // Use edges as detail overlay
    face: '',
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

  const getSpriteOverride = useCallback((speciesKey: string, elementKey: string): { body: string; detail: string; face: string } | null => {
    // Look for species-element specific sprite first, then fall back to species-only
    const specificKey = `${speciesKey} (${elementKey})`;
    const spriteData = sprites.get(specificKey) || sprites.get(speciesKey);
    
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

// Singleton context for sprite overrides - can be used without React context
export function getGlobalSpriteOverride(speciesKey: string, elementKey: string): { body: string; detail: string; face: string } | null {
  // Try multiple key formats for backwards compatibility
  const specificKey = `${speciesKey} (${elementKey})`;
  const underscoreKey = `species_${speciesKey}_${elementKey}`;
  
  const spriteData = globalSpriteCache.get(specificKey) 
    || globalSpriteCache.get(underscoreKey)
    || globalSpriteCache.get(speciesKey);
  
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
