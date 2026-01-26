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
function pixelArtToSvgPaths(spriteData: SpriteData): { body: string; detail: string; face: string } {
  const { width, height, layers } = spriteData;
  
  // Merge all visible layers into a single grid
  const mergedGrid: string[][] = Array(height).fill(null).map(() => Array(width).fill('transparent'));
  
  for (const layer of layers) {
    if (layer.visible === false) continue;
    for (let y = 0; y < Math.min(layer.pixels.length, height); y++) {
      for (let x = 0; x < Math.min(layer.pixels[y]?.length || 0, width); x++) {
        const color = layer.pixels[y][x];
        if (color && color !== 'transparent') {
          mergedGrid[y][x] = color;
        }
      }
    }
  }
  
  // Scale factor to map pixel grid to 100x100 SVG viewBox
  const scaleX = 100 / width;
  const scaleY = 100 / height;
  
  // Generate filled rectangles for each non-transparent pixel
  let pathData = '';
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mergedGrid[y][x] !== 'transparent') {
        const sx = x * scaleX;
        const sy = y * scaleY;
        pathData += `M${sx},${sy} h${scaleX} v${scaleY} h-${scaleX} Z `;
      }
    }
  }
  
  return {
    body: pathData.trim(),
    detail: '',
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
