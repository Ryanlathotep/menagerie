import { useState, useRef, useCallback, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { 
  Paintbrush, 
  Eraser, 
  PaintBucket, 
  Pipette, 
  Undo, 
  Redo, 
  Save, 
  Trash2,
  Plus,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  Search,
  Download,
  Upload,
  Code
} from 'lucide-react';
import { toast } from 'sonner';
import { svgToPixelArt, pixelArtToSvgPath, getAvailableSpecies } from './spriteConversion';
import { ElementType, SpeciesType, ELEMENT_COLORS } from '@/game/types';
import { preloadCustomSprites } from '@/hooks/useCustomSprites';

interface Layer {
  id: string;
  name: string;
  visible: boolean;
  pixels: string[][]; // 2D array of colors
}

interface SpriteData {
  width: number;
  height: number;
  layers: Layer[];
}

interface SavedSprite {
  sprite_key: string;
  sprite_data: SpriteData;
  updated_at: string;
}

type Tool = 'brush' | 'eraser' | 'fill' | 'picker';

const DEFAULT_SIZE = 16;
const MAX_SIZE = 64;
const ZOOM_LEVELS = [4, 8, 12, 16, 24, 32];
const THUMBNAIL_SIZE = 48;

const PRESET_COLORS = [
  '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff',
  '#ffff00', '#ff00ff', '#00ffff', '#808080', '#c0c0c0',
  '#800000', '#008000', '#000080', '#808000', '#800080',
  '#008080', '#ff8000', '#ff0080', '#80ff00', '#0080ff',
];

// Sprite Thumbnail Component - renders a small preview of sprite data
function SpriteThumbnail({ data }: { data: SpriteData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calculate scale to fit sprite in thumbnail
    const scale = Math.min(THUMBNAIL_SIZE / data.width, THUMBNAIL_SIZE / data.height);
    const offsetX = (THUMBNAIL_SIZE - data.width * scale) / 2;
    const offsetY = (THUMBNAIL_SIZE - data.height * scale) / 2;

    // Draw checkerboard background
    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);
    for (let y = 0; y < THUMBNAIL_SIZE; y += 4) {
      for (let x = 0; x < THUMBNAIL_SIZE; x += 4) {
        if ((x + y) % 8 === 0) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x, y, 4, 4);
        }
      }
    }

    // Draw layers from bottom to top
    for (const layer of data.layers) {
      if (!layer.visible) continue;
      for (let y = 0; y < data.height; y++) {
        for (let x = 0; x < data.width; x++) {
          const pixelColor = layer.pixels[y]?.[x];
          if (pixelColor && pixelColor !== 'transparent') {
            ctx.fillStyle = pixelColor;
            ctx.fillRect(
              offsetX + x * scale,
              offsetY + y * scale,
              Math.ceil(scale),
              Math.ceil(scale)
            );
          }
        }
      }
    }
  }, [data]);

  return (
    <canvas
      ref={canvasRef}
      width={THUMBNAIL_SIZE}
      height={THUMBNAIL_SIZE}
      className="border rounded shrink-0"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}

export function SpriteEditor() {
  const [spriteKey, setSpriteKey] = useState('');
  const [spriteData, setSpriteData] = useState<SpriteData>(() => createEmptySprite(DEFAULT_SIZE, DEFAULT_SIZE));
  const [activeLayerIndex, setActiveLayerIndex] = useState(0);
  const [tool, setTool] = useState<Tool>('brush');
  const [color, setColor] = useState('#000000');
  const [zoom, setZoom] = useState(16);
  const [history, setHistory] = useState<SpriteData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isDrawing, setIsDrawing] = useState(false);
  const [savedSprites, setSavedSprites] = useState<SavedSprite[]>([]);
  const [loadingSprites, setLoadingSprites] = useState(true);
  const [spriteSearch, setSpriteSearch] = useState('');
  const [importSpecies, setImportSpecies] = useState<SpeciesType>('slime');
  const [importElement, setImportElement] = useState<ElementType>('normal');
  const [importSize, setImportSize] = useState(32);
  const [importingFromCode, setImportingFromCode] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  // Load saved sprites with full data for thumbnails
  const loadSavedSprites = useCallback(async () => {
    setLoadingSprites(true);
    try {
      const { data, error } = await supabase
        .from('custom_sprites')
        .select('sprite_key, sprite_data, updated_at')
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      
      if (data) {
        setSavedSprites(data.map(s => ({
          sprite_key: s.sprite_key,
          sprite_data: s.sprite_data as unknown as SpriteData,
          updated_at: s.updated_at,
        })));
      }
    } catch (err) {
      console.error('Failed to load sprites:', err);
      toast.error('Failed to load saved sprites');
    } finally {
      setLoadingSprites(false);
    }
  }, []);

  useEffect(() => {
    loadSavedSprites();
  }, [loadSavedSprites]);

  // Filter sprites by search term
  const filteredSprites = savedSprites.filter(sprite =>
    sprite.sprite_key.toLowerCase().includes(spriteSearch.toLowerCase())
  );

  function createEmptySprite(width: number, height: number): SpriteData {
    return {
      width,
      height,
      layers: [createEmptyLayer('Layer 1', width, height)],
    };
  }

  function createEmptyLayer(name: string, width: number, height: number): Layer {
    return {
      id: crypto.randomUUID(),
      name,
      visible: true,
      pixels: Array(height).fill(null).map(() => Array(width).fill('transparent')),
    };
  }

  // Save state to history for undo/redo
  const saveToHistory = useCallback(() => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(spriteData)));
    setHistory(newHistory.slice(-50)); // Keep last 50 states
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex, spriteData]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setSpriteData(JSON.parse(JSON.stringify(history[historyIndex - 1])));
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setSpriteData(JSON.parse(JSON.stringify(history[historyIndex + 1])));
    }
  }, [history, historyIndex]);

  // Render canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height, layers } = spriteData;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw checkerboard background
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#e0e0e0' : '#ffffff';
        ctx.fillRect(x * zoom, y * zoom, zoom, zoom);
      }
    }
    
    // Draw layers from bottom to top
    for (const layer of layers) {
      if (!layer.visible) continue;
      
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const pixelColor = layer.pixels[y]?.[x];
          if (pixelColor && pixelColor !== 'transparent') {
            ctx.fillStyle = pixelColor;
            ctx.fillRect(x * zoom, y * zoom, zoom, zoom);
          }
        }
      }
    }
    
    // Draw grid
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x++) {
      ctx.beginPath();
      ctx.moveTo(x * zoom, 0);
      ctx.lineTo(x * zoom, height * zoom);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * zoom);
      ctx.lineTo(width * zoom, y * zoom);
      ctx.stroke();
    }
  }, [spriteData, zoom]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Drawing functions
  const getPixelPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / zoom);
    const y = Math.floor((e.clientY - rect.top) / zoom);
    
    if (x < 0 || x >= spriteData.width || y < 0 || y >= spriteData.height) {
      return null;
    }
    
    return { x, y };
  };

  const setPixel = useCallback((x: number, y: number, pixelColor: string) => {
    setSpriteData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      const layer = newData.layers[activeLayerIndex];
      if (layer && layer.pixels[y]) {
        layer.pixels[y][x] = pixelColor;
      }
      return newData;
    });
  }, [activeLayerIndex]);

  const floodFill = useCallback((startX: number, startY: number, fillColor: string) => {
    setSpriteData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      const layer = newData.layers[activeLayerIndex];
      if (!layer) return prev;

      const targetColor = layer.pixels[startY]?.[startX];
      if (targetColor === fillColor) return prev;

      const stack: [number, number][] = [[startX, startY]];
      const visited = new Set<string>();

      while (stack.length > 0) {
        const [x, y] = stack.pop()!;
        const key = `${x},${y}`;
        
        if (visited.has(key)) continue;
        if (x < 0 || x >= prev.width || y < 0 || y >= prev.height) continue;
        if (layer.pixels[y]?.[x] !== targetColor) continue;

        visited.add(key);
        layer.pixels[y][x] = fillColor;

        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }

      return newData;
    });
  }, [activeLayerIndex]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getPixelPos(e);
    if (!pos) return;

    saveToHistory();
    setIsDrawing(true);
    lastPosRef.current = pos;

    if (tool === 'picker') {
      const layer = spriteData.layers[activeLayerIndex];
      const pixelColor = layer?.pixels[pos.y]?.[pos.x];
      if (pixelColor && pixelColor !== 'transparent') {
        setColor(pixelColor);
        setTool('brush');
      }
    } else if (tool === 'fill') {
      floodFill(pos.x, pos.y, color);
    } else {
      const pixelColor = tool === 'eraser' ? 'transparent' : color;
      setPixel(pos.x, pos.y, pixelColor);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || tool === 'fill' || tool === 'picker') return;
    
    const pos = getPixelPos(e);
    if (!pos) return;

    const pixelColor = tool === 'eraser' ? 'transparent' : color;
    
    // Draw line from last position to current
    if (lastPosRef.current) {
      const dx = Math.abs(pos.x - lastPosRef.current.x);
      const dy = Math.abs(pos.y - lastPosRef.current.y);
      const sx = lastPosRef.current.x < pos.x ? 1 : -1;
      const sy = lastPosRef.current.y < pos.y ? 1 : -1;
      let err = dx - dy;
      let x = lastPosRef.current.x;
      let y = lastPosRef.current.y;

      while (true) {
        setPixel(x, y, pixelColor);
        if (x === pos.x && y === pos.y) break;
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x += sx; }
        if (e2 < dx) { err += dx; y += sy; }
      }
    }

    lastPosRef.current = pos;
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    lastPosRef.current = null;
  };

  // Layer management
  const addLayer = () => {
    setSpriteData(prev => ({
      ...prev,
      layers: [
        ...prev.layers,
        createEmptyLayer(`Layer ${prev.layers.length + 1}`, prev.width, prev.height),
      ],
    }));
    setActiveLayerIndex(spriteData.layers.length);
  };

  const toggleLayerVisibility = (index: number) => {
    setSpriteData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      newData.layers[index].visible = !newData.layers[index].visible;
      return newData;
    });
  };

  const moveLayer = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index + 1 : index - 1;
    if (newIndex < 0 || newIndex >= spriteData.layers.length) return;

    setSpriteData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      [newData.layers[index], newData.layers[newIndex]] = [newData.layers[newIndex], newData.layers[index]];
      return newData;
    });
    setActiveLayerIndex(newIndex);
  };

  const deleteLayer = (index: number) => {
    if (spriteData.layers.length <= 1) return;
    
    setSpriteData(prev => ({
      ...prev,
      layers: prev.layers.filter((_, i) => i !== index),
    }));
    if (activeLayerIndex >= spriteData.layers.length - 1) {
      setActiveLayerIndex(Math.max(0, spriteData.layers.length - 2));
    }
  };

  // Save/Load
  const handleSave = async () => {
    if (!spriteKey.trim()) {
      toast.error('Please enter a sprite key');
      return;
    }

    try {
      // Check if sprite exists
      const { data: existing } = await supabase
        .from('custom_sprites')
        .select('id')
        .eq('sprite_key', spriteKey)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('custom_sprites')
          .update({ sprite_data: spriteData as unknown as Record<string, never> })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('custom_sprites')
          .insert([{
            sprite_key: spriteKey,
            sprite_data: spriteData as unknown as Record<string, never>,
          }]);
        if (error) throw error;
      }
      
      toast.success(`Saved sprite: ${spriteKey}`);
      // Refresh the list to get updated thumbnails
      loadSavedSprites();
      // Invalidate and reload the global sprite cache so game uses new sprite immediately
      await preloadCustomSprites(true);
    } catch (err) {
      console.error('Failed to save sprite:', err);
      toast.error('Failed to save sprite');
    }
  };

  const handleLoad = (sprite: SavedSprite) => {
    setSpriteKey(sprite.sprite_key);
    setSpriteData(sprite.sprite_data);
    setHistory([]);
    setHistoryIndex(-1);
    toast.success(`Loaded sprite: ${sprite.sprite_key}`);
  };

  const handleDeleteSprite = async (key: string) => {
    if (!confirm(`Delete sprite "${key}"?`)) return;
    
    try {
      const { error } = await supabase
        .from('custom_sprites')
        .delete()
        .eq('sprite_key', key);
      
      if (error) throw error;
      
      toast.success(`Deleted sprite: ${key}`);
      loadSavedSprites();
      
      // Clear editor if we deleted the current sprite
      if (spriteKey === key) {
        setSpriteKey('');
        setSpriteData(createEmptySprite(DEFAULT_SIZE, DEFAULT_SIZE));
      }
    } catch (err) {
      console.error('Failed to delete sprite:', err);
      toast.error('Failed to delete sprite');
    }
  };

  const handleClear = () => {
    saveToHistory();
    setSpriteData(createEmptySprite(spriteData.width, spriteData.height));
    toast.success('Canvas cleared');
  };

  // Import a species sprite from code as pixel art
  const handleImportFromCode = async () => {
    setImportingFromCode(true);
    try {
      const pixelData = await svgToPixelArt(importSpecies, importSize, importElement, true);
      setSpriteData(pixelData);
      setSpriteKey(`species_${importSpecies}_${importElement}`);
      setHistory([]);
      setHistoryIndex(-1);
      setActiveLayerIndex(0);
      toast.success(`Imported ${importSpecies} (${importElement}) as ${importSize}x${importSize} pixel art`);
    } catch (err) {
      console.error('Failed to import sprite:', err);
      toast.error('Failed to import sprite from code');
    } finally {
      setImportingFromCode(false);
    }
  };

  // Export current pixel art to SVG path data
  const handleExportToSvg = () => {
    const { outline, filled } = pixelArtToSvgPath(spriteData);
    
    // Copy to clipboard
    const svgCode = `// Filled path (for solid fill)
body: '${filled}',
// Outline path (for stroke)
detail: '${outline}',`;
    
    navigator.clipboard.writeText(svgCode);
    toast.success('SVG path data copied to clipboard!');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Tools Panel */}
      <Card className="p-4 space-y-4">
        <div>
          <Label>Sprite Key</Label>
          <Input
            value={spriteKey}
            onChange={(e) => setSpriteKey(e.target.value)}
            placeholder="e.g., species_slime, element_fire"
          />
        </div>

        <div>
          <Label>Tools</Label>
          <div className="flex gap-2 mt-2">
            <Button
              variant={tool === 'brush' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setTool('brush')}
            >
              <Paintbrush className="w-4 h-4" />
            </Button>
            <Button
              variant={tool === 'eraser' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setTool('eraser')}
            >
              <Eraser className="w-4 h-4" />
            </Button>
            <Button
              variant={tool === 'fill' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setTool('fill')}
            >
              <PaintBucket className="w-4 h-4" />
            </Button>
            <Button
              variant={tool === 'picker' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setTool('picker')}
            >
              <Pipette className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div>
          <Label>Color</Label>
          <div className="flex gap-2 items-center mt-2">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-10 h-10 border rounded cursor-pointer"
            />
            <Input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="flex-1"
            />
          </div>
          <div className="grid grid-cols-10 gap-1 mt-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                className={`w-6 h-6 rounded border ${color === c ? 'ring-2 ring-primary' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>

        <div>
          <Label>Zoom: {zoom}x</Label>
          <Slider
            value={[ZOOM_LEVELS.indexOf(zoom)]}
            min={0}
            max={ZOOM_LEVELS.length - 1}
            step={1}
            onValueChange={([i]) => setZoom(ZOOM_LEVELS[i])}
            className="mt-2"
          />
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={undo} disabled={historyIndex <= 0}>
            <Undo className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={redo} disabled={historyIndex >= history.length - 1}>
            <Redo className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleClear}>
            <Trash2 className="w-4 h-4" />
          </Button>
          <Button onClick={handleSave} className="flex-1 gap-2">
            <Save className="w-4 h-4" />
            Save
          </Button>
        </div>

        {/* Tabs for Saved Sprites and Import from Code */}
        <Tabs defaultValue="saved" className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="saved" className="text-xs gap-1">
              <Save className="w-3 h-3" />
              Saved
            </TabsTrigger>
            <TabsTrigger value="import" className="text-xs gap-1">
              <Code className="w-3 h-3" />
              From Code
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="saved" className="mt-2 space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={spriteSearch}
                onChange={(e) => setSpriteSearch(e.target.value)}
                placeholder="Search sprites..."
                className="pl-8 h-8"
              />
            </div>
            <ScrollArea className="h-36">
              <div className="space-y-1">
                {loadingSprites ? (
                  <div className="text-sm text-muted-foreground p-2">Loading...</div>
                ) : filteredSprites.length === 0 ? (
                  <div className="text-sm text-muted-foreground p-2">
                    {savedSprites.length === 0 ? 'No sprites saved yet' : 'No matches found'}
                  </div>
                ) : (
                  filteredSprites.map((sprite) => (
                    <div
                      key={sprite.sprite_key}
                      className={`flex items-center gap-2 p-2 rounded hover:bg-muted transition-colors cursor-pointer ${
                        spriteKey === sprite.sprite_key ? 'bg-primary/20' : ''
                      }`}
                      onClick={() => handleLoad(sprite)}
                    >
                      <SpriteThumbnail data={sprite.sprite_data} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{sprite.sprite_key}</div>
                        <div className="text-xs text-muted-foreground">
                          {sprite.sprite_data.width}×{sprite.sprite_data.height} • {sprite.sprite_data.layers.length} layer{sprite.sprite_data.layers.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSprite(sprite.sprite_key);
                        }}
                      >
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="import" className="mt-2 space-y-3">
            <div className="text-xs text-muted-foreground">
              Import existing game sprites as editable pixel art
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Species</Label>
                <Select value={importSpecies} onValueChange={(v) => setImportSpecies(v as SpeciesType)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableSpecies().map(({ species, name, category }) => (
                      <SelectItem key={species} value={species} className="text-xs">
                        {name} <span className="text-muted-foreground">({category})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label className="text-xs">Element</Label>
                <Select value={importElement} onValueChange={(v) => setImportElement(v as ElementType)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(['normal', 'fire', 'water', 'earth', 'air', 'void'] as ElementType[]).map((el) => (
                      <SelectItem key={el} value={el} className="text-xs capitalize">
                        {el}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label className="text-xs">Size: {importSize}×{importSize}</Label>
              <Slider
                value={[importSize]}
                min={16}
                max={64}
                step={8}
                onValueChange={([v]) => setImportSize(v)}
                className="mt-1"
              />
            </div>
            
            <Button 
              onClick={handleImportFromCode} 
              disabled={importingFromCode}
              className="w-full gap-2"
              size="sm"
            >
              <Download className="w-4 h-4" />
              {importingFromCode ? 'Importing...' : 'Import to Editor'}
            </Button>
            
            <div className="border-t pt-3 mt-3">
              <Label className="text-xs">Export Current Sprite</Label>
              <Button 
                onClick={handleExportToSvg} 
                variant="outline"
                className="w-full gap-2 mt-2"
                size="sm"
                disabled={spriteData.layers.every(l => l.pixels.flat().every(p => p === 'transparent'))}
              >
                <Upload className="w-4 h-4" />
                Copy SVG Path Data
              </Button>
              <p className="text-xs text-muted-foreground mt-1">
                Copies SVG path code for use in sprites.tsx
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </Card>

      {/* Canvas */}
      <Card className="p-4 flex items-center justify-center overflow-auto">
        <canvas
          ref={canvasRef}
          width={spriteData.width * zoom}
          height={spriteData.height * zoom}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="border cursor-crosshair"
          style={{ imageRendering: 'pixelated' }}
        />
      </Card>

      {/* Layers Panel */}
      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Label>Layers</Label>
          <Button variant="outline" size="sm" onClick={addLayer}>
            <Plus className="w-4 h-4 mr-1" />
            Add
          </Button>
        </div>

        <ScrollArea className="h-64">
          <div className="space-y-2">
            {[...spriteData.layers].reverse().map((layer, reversedIndex) => {
              const index = spriteData.layers.length - 1 - reversedIndex;
              return (
                <div
                  key={layer.id}
                  className={`p-2 rounded border flex items-center gap-2 ${
                    index === activeLayerIndex ? 'bg-primary/20 border-primary' : ''
                  }`}
                >
                  <button onClick={() => toggleLayerVisibility(index)}>
                    {layer.visible ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                  <button
                    className="flex-1 text-left text-sm"
                    onClick={() => setActiveLayerIndex(index)}
                  >
                    {layer.name}
                  </button>
                  <button onClick={() => moveLayer(index, 'up')}>
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button onClick={() => moveLayer(index, 'down')}>
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  {spriteData.layers.length > 1 && (
                    <button onClick={() => deleteLayer(index)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div>
          <Label>Canvas Size</Label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div>
              <Label className="text-xs">Width</Label>
              <Input
                type="number"
                value={spriteData.width}
                min={1}
                max={MAX_SIZE}
                onChange={(e) => {
                  const newWidth = Math.min(MAX_SIZE, Math.max(1, parseInt(e.target.value) || 16));
                  setSpriteData(prev => {
                    const newData = JSON.parse(JSON.stringify(prev));
                    newData.width = newWidth;
                    newData.layers = newData.layers.map((layer: Layer) => ({
                      ...layer,
                      pixels: layer.pixels.map((row: string[]) => {
                        if (row.length < newWidth) {
                          return [...row, ...Array(newWidth - row.length).fill('transparent')];
                        }
                        return row.slice(0, newWidth);
                      }),
                    }));
                    return newData;
                  });
                }}
              />
            </div>
            <div>
              <Label className="text-xs">Height</Label>
              <Input
                type="number"
                value={spriteData.height}
                min={1}
                max={MAX_SIZE}
                onChange={(e) => {
                  const newHeight = Math.min(MAX_SIZE, Math.max(1, parseInt(e.target.value) || 16));
                  setSpriteData(prev => {
                    const newData = JSON.parse(JSON.stringify(prev));
                    newData.height = newHeight;
                    newData.layers = newData.layers.map((layer: Layer) => {
                      const pixels = [...layer.pixels];
                      while (pixels.length < newHeight) {
                        pixels.push(Array(newData.width).fill('transparent'));
                      }
                      return {
                        ...layer,
                        pixels: pixels.slice(0, newHeight),
                      };
                    });
                    return newData;
                  });
                }}
              />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
