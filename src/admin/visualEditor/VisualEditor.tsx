// Visual Editor - Comprehensive editor for Species, Elements, Classes, and Equipment
// Supports equipment placement templates, live preview, and SVG generation

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { 
  Paintbrush, Eraser, PaintBucket, Pipette, Undo, Redo, Save, Trash2,
  Plus, Eye, EyeOff, Download, Copy, Layers, Palette, Shield, Swords
} from 'lucide-react';
import { toast } from 'sonner';

import { SpeciesType, ElementType, ClassType, SPECIES_DATA } from '@/game/types';
import { EquipmentSlot } from '@/game/equipment';
import { preloadCustomSprites } from '@/hooks/useCustomSprites';

import { 
  EditorMode, Tool, SpriteData,
  PRESET_COLORS, ZOOM_LEVELS, DEFAULT_CANVAS_SIZE,
  createEmptySprite
} from './types';
import { generateSvgPaths, formatSvgExport } from './svgGeneration';
import { rasterizeSpecies, rasterizeClassOverlay, rasterizeEquipment } from './rasterization';
import { EquipmentPlacementTemplate, EquipmentTemplateLegend } from './EquipmentTemplate';
import { LivePreview, ElementVariationsPreview } from './LivePreview';

// Get available species for dropdown
const SPECIES_LIST = Object.entries(SPECIES_DATA).map(([key, data]) => ({
  key: key as SpeciesType,
  name: data.name,
  category: data.category,
})).sort((a, b) => a.name.localeCompare(b.name));

const CLASS_LIST: ClassType[] = ['normal', 'kinetic', 'energy', 'biological', 'chemical', 'political'];
const ELEMENT_LIST: ElementType[] = ['normal', 'fire', 'water', 'earth', 'air', 'void'];
const EQUIPMENT_SLOTS: EquipmentSlot[] = ['helmet', 'armor', 'gloves', 'boots', 'mainHand', 'offHand', 'accessory', 'back'];

interface SavedSprite {
  sprite_key: string;
  sprite_data: SpriteData;
  updated_at: string;
}

export function VisualEditor() {
  // Editor mode
  const [editorMode, setEditorMode] = useState<EditorMode>('species');
  
  // Selection state
  const [selectedSpecies, setSelectedSpecies] = useState<SpeciesType>('slime');
  const [selectedElement, setSelectedElement] = useState<ElementType>('normal');
  const [selectedClass, setSelectedClass] = useState<ClassType>('normal');
  const [selectedSlot, setSelectedSlot] = useState<EquipmentSlot>('helmet');
  
  // Canvas state
  const [spriteData, setSpriteData] = useState<SpriteData>(() => createEmptySprite(DEFAULT_CANVAS_SIZE, DEFAULT_CANVAS_SIZE));
  const [activeLayerIndex, setActiveLayerIndex] = useState(0);
  const [zoom, setZoom] = useState(12);
  
  // Drawing state
  const [tool, setTool] = useState<Tool>('brush');
  const [color, setColor] = useState('#000000');
  const [isDrawing, setIsDrawing] = useState(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  
  // History
  const [history, setHistory] = useState<SpriteData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  // UI state
  const [showTemplate, setShowTemplate] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [savedSprites, setSavedSprites] = useState<SavedSprite[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Canvas ref
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Get current sprite key based on mode
  const spriteKey = useMemo(() => {
    switch (editorMode) {
      case 'species': return selectedSpecies;
      case 'class': return `class:${selectedClass}`;
      case 'equipment': return `equipment:${selectedSlot}`;
      case 'element': return `element:${selectedElement}`;
    }
  }, [editorMode, selectedSpecies, selectedClass, selectedSlot, selectedElement]);
  
  // Load saved sprites
  const loadSavedSprites = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('custom_sprites')
        .select('sprite_key, sprite_data, updated_at')
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      setSavedSprites((data || []) as unknown as SavedSprite[]);
    } catch (err) {
      console.error('Failed to load sprites:', err);
    }
  }, []);
  
  useEffect(() => {
    loadSavedSprites();
  }, [loadSavedSprites]);
  
  // History management
  const saveToHistory = useCallback(() => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(spriteData)));
    setHistory(newHistory.slice(-50));
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
    
    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Checkerboard background
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#e0e0e0' : '#ffffff';
        ctx.fillRect(x * zoom, y * zoom, zoom, zoom);
      }
    }
    
    // Draw layers
    for (const layer of layers) {
      if (!layer.visible) continue;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const pixel = layer.pixels[y]?.[x];
          if (pixel && pixel !== 'transparent') {
            ctx.fillStyle = pixel;
            ctx.fillRect(x * zoom, y * zoom, zoom, zoom);
          }
        }
      }
    }
    
    // Grid
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
      if (layer?.pixels[y]) {
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
      const pixel = layer?.pixels[pos.y]?.[pos.x];
      if (pixel && pixel !== 'transparent') {
        setColor(pixel);
        setTool('brush');
      }
    } else if (tool === 'fill') {
      floodFill(pos.x, pos.y, color);
    } else {
      setPixel(pos.x, pos.y, tool === 'eraser' ? 'transparent' : color);
    }
  };
  
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || tool === 'fill' || tool === 'picker') return;
    
    const pos = getPixelPos(e);
    if (!pos) return;
    
    const pixelColor = tool === 'eraser' ? 'transparent' : color;
    
    // Bresenham line
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
      layers: [...prev.layers, {
        id: crypto.randomUUID(),
        name: `Layer ${prev.layers.length + 1}`,
        visible: true,
        pixels: Array(prev.height).fill(null).map(() => Array(prev.width).fill('transparent')),
      }],
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
  
  // Import from source
  const handleImport = async () => {
    setLoading(true);
    try {
      let imported: SpriteData;
      
      switch (editorMode) {
        case 'species':
          imported = await rasterizeSpecies(selectedSpecies, DEFAULT_CANVAS_SIZE);
          break;
        case 'class':
          imported = await rasterizeClassOverlay(selectedClass, DEFAULT_CANVAS_SIZE);
          break;
        case 'equipment':
          imported = await rasterizeEquipment(selectedSlot, DEFAULT_CANVAS_SIZE);
          break;
        default:
          toast.error('Element editing uses color pickers, not pixel art');
          return;
      }
      
      setSpriteData(imported);
      setHistory([]);
      setHistoryIndex(-1);
      toast.success('Imported from source');
    } catch (err) {
      console.error('Import failed:', err);
      toast.error('Failed to import');
    } finally {
      setLoading(false);
    }
  };
  
  // Save sprite
  const handleSave = async () => {
    try {
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
      
      toast.success(`Saved: ${spriteKey}`);
      loadSavedSprites();
      await preloadCustomSprites(true);
    } catch (err) {
      console.error('Save failed:', err);
      toast.error('Failed to save');
    }
  };
  
  // Export SVG
  const handleExportSvg = () => {
    const paths = generateSvgPaths(spriteData);
    const code = formatSvgExport(spriteKey, paths);
    navigator.clipboard.writeText(code);
    toast.success('SVG path code copied to clipboard!');
  };
  
  // Clear canvas
  const handleClear = () => {
    saveToHistory();
    setSpriteData(createEmptySprite(spriteData.width, spriteData.height));
  };
  
  // Check for existing saved sprite
  const existingSave = savedSprites.find(s => s.sprite_key === spriteKey);
  
  // Load existing save
  const handleLoadExisting = () => {
    if (existingSave) {
      setSpriteData(existingSave.sprite_data);
      setHistory([]);
      setHistoryIndex(-1);
      toast.success('Loaded saved version');
    }
  };
  
  return (
    <div className="grid grid-cols-[280px_1fr_280px] gap-4 h-[calc(100vh-120px)]">
      {/* Left Panel - Tools & Selection */}
      <Card className="p-4 space-y-4 overflow-auto">
        {/* Mode Tabs */}
        <Tabs value={editorMode} onValueChange={(v) => setEditorMode(v as EditorMode)}>
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="species" className="text-xs px-1">
              <Layers className="w-3 h-3 mr-1" />
              Species
            </TabsTrigger>
            <TabsTrigger value="class" className="text-xs px-1">
              <Swords className="w-3 h-3 mr-1" />
              Class
            </TabsTrigger>
            <TabsTrigger value="equipment" className="text-xs px-1">
              <Shield className="w-3 h-3 mr-1" />
              Equip
            </TabsTrigger>
            <TabsTrigger value="element" className="text-xs px-1">
              <Palette className="w-3 h-3 mr-1" />
              Color
            </TabsTrigger>
          </TabsList>
          
          {/* Species Selection */}
          <TabsContent value="species" className="space-y-3 mt-3">
            <div>
              <Label className="text-xs">Species</Label>
              <Select value={selectedSpecies} onValueChange={(v) => setSelectedSpecies(v as SpeciesType)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SPECIES_LIST.map(({ key, name, category }) => (
                    <SelectItem key={key} value={key} className="text-xs">
                      {name} <span className="text-muted-foreground">({category})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Editing base shape - works with all elements automatically
            </p>
          </TabsContent>
          
          {/* Class Selection */}
          <TabsContent value="class" className="space-y-3 mt-3">
            <div>
              <Label className="text-xs">Class Overlay</Label>
              <Select value={selectedClass} onValueChange={(v) => setSelectedClass(v as ClassType)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLASS_LIST.map(c => (
                    <SelectItem key={c} value={c} className="text-xs capitalize">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Editing class equipment overlay (weapons, armor, accessories)
            </p>
          </TabsContent>
          
          {/* Equipment Selection */}
          <TabsContent value="equipment" className="space-y-3 mt-3">
            <div>
              <Label className="text-xs">Equipment Slot</Label>
              <Select value={selectedSlot} onValueChange={(v) => setSelectedSlot(v as EquipmentSlot)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EQUIPMENT_SLOTS.map(slot => (
                    <SelectItem key={slot} value={slot} className="text-xs capitalize">{slot}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Editing slot-specific equipment visual
            </p>
          </TabsContent>
          
          {/* Element Color Editing */}
          <TabsContent value="element" className="space-y-3 mt-3">
            <div>
              <Label className="text-xs">Element</Label>
              <Select value={selectedElement} onValueChange={(v) => setSelectedElement(v as ElementType)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ELEMENT_LIST.map(el => (
                    <SelectItem key={el} value={el} className="text-xs capitalize">{el}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Element colors use HSL pickers (coming soon)
            </p>
          </TabsContent>
        </Tabs>
        
        {/* Import/Export */}
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleImport} 
            disabled={loading || editorMode === 'element'}
            className="flex-1 text-xs"
          >
            <Download className="w-3 h-3 mr-1" />
            Import Source
          </Button>
          {existingSave && (
            <Button variant="outline" size="sm" onClick={handleLoadExisting} className="text-xs">
              Load Saved
            </Button>
          )}
        </div>
        
        {/* Tools */}
        <div>
          <Label className="text-xs">Tools</Label>
          <div className="flex gap-1 mt-1">
            {[
              { id: 'brush', icon: Paintbrush, label: 'Brush' },
              { id: 'eraser', icon: Eraser, label: 'Eraser' },
              { id: 'fill', icon: PaintBucket, label: 'Fill' },
              { id: 'picker', icon: Pipette, label: 'Pick Color' },
            ].map(({ id, icon: Icon, label }) => (
              <Button
                key={id}
                variant={tool === id ? 'default' : 'outline'}
                size="icon"
                onClick={() => setTool(id as Tool)}
                title={label}
                className="h-8 w-8"
              >
                <Icon className="w-4 h-4" />
              </Button>
            ))}
          </div>
        </div>
        
        {/* Color */}
        <div>
          <Label className="text-xs">Color</Label>
          <div className="flex gap-2 items-center mt-1">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-8 h-8 border rounded cursor-pointer"
            />
            <Input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="flex-1 h-8 text-xs"
            />
          </div>
          <div className="grid grid-cols-10 gap-1 mt-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                className={`w-5 h-5 rounded border ${color === c ? 'ring-2 ring-primary' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>
        
        {/* Zoom */}
        <div>
          <Label className="text-xs">Zoom: {zoom}x</Label>
          <Slider
            value={[ZOOM_LEVELS.indexOf(zoom)]}
            min={0}
            max={ZOOM_LEVELS.length - 1}
            step={1}
            onValueChange={([i]) => setZoom(ZOOM_LEVELS[i])}
            className="mt-1"
          />
        </div>
        
        {/* Template Toggle */}
        <div className="flex items-center justify-between">
          <Label className="text-xs">Equipment Template</Label>
          <Switch checked={showTemplate} onCheckedChange={setShowTemplate} />
        </div>
        {showTemplate && <EquipmentTemplateLegend />}
        
        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={undo} disabled={historyIndex <= 0} className="h-8 w-8">
            <Undo className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={redo} disabled={historyIndex >= history.length - 1} className="h-8 w-8">
            <Redo className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleClear} className="h-8 w-8">
            <Trash2 className="w-4 h-4" />
          </Button>
          <Button onClick={handleSave} className="flex-1 h-8 text-xs">
            <Save className="w-3 h-3 mr-1" />
            Save
          </Button>
        </div>
        
        {/* Export SVG */}
        <Button variant="outline" onClick={handleExportSvg} className="w-full h-8 text-xs">
          <Copy className="w-3 h-3 mr-1" />
          Copy SVG Path Code
        </Button>
        
        <div className="text-xs text-muted-foreground">
          Key: <code className="bg-muted px-1 rounded">{spriteKey}</code>
        </div>
      </Card>
      
      {/* Center - Canvas */}
      <Card className="p-4 flex items-center justify-center overflow-auto relative">
        <div className="relative">
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
          <EquipmentPlacementTemplate
            visible={showTemplate}
            size={spriteData.width}
            zoom={zoom}
          />
        </div>
      </Card>
      
      {/* Right Panel - Layers & Preview */}
      <Card className="p-4 space-y-4 overflow-auto">
        {/* Layers */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs">Layers</Label>
            <Button variant="outline" size="sm" onClick={addLayer} className="h-6 text-xs">
              <Plus className="w-3 h-3 mr-1" />
              Add
            </Button>
          </div>
          <ScrollArea className="h-32">
            <div className="space-y-1">
              {[...spriteData.layers].reverse().map((layer, ri) => {
                const index = spriteData.layers.length - 1 - ri;
                return (
                  <div
                    key={layer.id}
                    className={`p-2 rounded border flex items-center gap-2 text-xs ${
                      index === activeLayerIndex ? 'bg-primary/20 border-primary' : ''
                    }`}
                    onClick={() => setActiveLayerIndex(index)}
                  >
                    <button onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(index); }}>
                      {layer.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3 text-muted-foreground" />}
                    </button>
                    <span className="flex-1 truncate">{layer.name}</span>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
        
        {/* Live Preview */}
        {showPreview && editorMode === 'species' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs">Live Preview</Label>
              <Switch checked={showPreview} onCheckedChange={setShowPreview} />
            </div>
            <ElementVariationsPreview
              spriteData={spriteData}
              species={selectedSpecies}
              classType={selectedClass}
              size={48}
            />
          </div>
        )}
        
        {/* Single Preview for other modes */}
        {showPreview && (editorMode === 'class' || editorMode === 'equipment' || editorMode === 'element') && (
          <div>
            <Label className="text-xs mb-2 block">Preview</Label>
            <LivePreview
              spriteData={undefined}
              editingMode={editorMode}
              previewSpecies={selectedSpecies}
              previewElement={selectedElement}
              previewClass={selectedClass}
              size={100}
            />
          </div>
        )}
        
        {/* Saved Sprites */}
        <div>
          <Label className="text-xs mb-2 block">Saved ({savedSprites.length})</Label>
          <ScrollArea className="h-40">
            <div className="space-y-1">
              {savedSprites.slice(0, 20).map(sprite => (
                <div
                  key={sprite.sprite_key}
                  className={`p-2 rounded border text-xs cursor-pointer hover:bg-muted ${
                    sprite.sprite_key === spriteKey ? 'bg-primary/20 border-primary' : ''
                  }`}
                  onClick={() => {
                    setSpriteData(sprite.sprite_data);
                    // Parse the key to set the correct mode/selection
                    if (sprite.sprite_key.startsWith('class:')) {
                      setEditorMode('class');
                      setSelectedClass(sprite.sprite_key.replace('class:', '') as ClassType);
                    } else if (sprite.sprite_key.startsWith('equipment:')) {
                      setEditorMode('equipment');
                      setSelectedSlot(sprite.sprite_key.replace('equipment:', '') as EquipmentSlot);
                    } else {
                      setEditorMode('species');
                      setSelectedSpecies(sprite.sprite_key as SpeciesType);
                    }
                  }}
                >
                  {sprite.sprite_key}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </Card>
    </div>
  );
}
