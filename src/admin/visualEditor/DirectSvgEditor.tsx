 // Direct SVG Path Editor - For hand-crafting high-quality sprite paths
 // Bypasses pixel art conversion for maximum quality
 
 import React, { useState, useEffect } from 'react';
 import { Card } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Label } from '@/components/ui/label';
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 import { supabase } from '@/integrations/supabase/client';
 import { Save, Copy, Code } from 'lucide-react';
 import { toast } from 'sonner';
 import { preloadCustomSprites } from '@/hooks/useCustomSprites';
 import { SpeciesType, ClassType, SPECIES_DATA } from '@/game/types';
 import { EquipmentSlot } from '@/game/equipment';
 import { formatSvgExport } from './svgGeneration';
 
 const SPECIES_LIST = Object.entries(SPECIES_DATA).map(([key, data]) => ({
   key: key as SpeciesType,
   name: data.name,
 })).sort((a, b) => a.name.localeCompare(b.name));
 
 const CLASS_LIST: ClassType[] = ['normal', 'kinetic', 'energy', 'biological', 'chemical', 'political'];
 const EQUIPMENT_SLOTS: EquipmentSlot[] = ['helmet', 'armor', 'gloves', 'boots', 'mainHand', 'offHand', 'accessory', 'back'];
 
 type EditorTarget = 'species' | 'class' | 'equipment';
 
 export function DirectSvgEditor() {
   const [target, setTarget] = useState<EditorTarget>('species');
   const [selectedSpecies, setSelectedSpecies] = useState<SpeciesType>('slime');
   const [selectedClass, setSelectedClass] = useState<ClassType>('normal');
   const [selectedSlot, setSelectedSlot] = useState<EquipmentSlot>('helmet');
   
   const [bodyPath, setBodyPath] = useState('');
   const [detailPath, setDetailPath] = useState('');
   const [facePath, setFacePath] = useState('');
   
   const spriteKey = 
     target === 'species' ? selectedSpecies :
     target === 'class' ? `class:${selectedClass}` :
     `equipment:${selectedSlot}`;
   
   // Load existing saved paths when key changes
   useEffect(() => {
     const loadExisting = async () => {
       const { data } = await supabase
         .from('custom_sprites')
         .select('sprite_data')
         .eq('sprite_key', spriteKey)
         .maybeSingle();
       
       if (data?.sprite_data) {
         const sd = data.sprite_data as any;
         if (sd._type === 'direct_svg' && sd.paths) {
           setBodyPath(sd.paths.body || '');
           setDetailPath(sd.paths.detail || '');
           setFacePath(sd.paths.face || '');
         }
       }
     };
     loadExisting();
   }, [spriteKey]);
   
   const handleSave = async () => {
     try {
       if (!bodyPath.trim()) {
         toast.error('Body path is required');
         return;
       }
       
       const directSvgData = {
         _type: 'direct_svg',
         paths: {
           body: bodyPath,
           detail: detailPath,
           face: facePath,
         }
       };
       
       const { data: existing } = await supabase
         .from('custom_sprites')
         .select('id')
         .eq('sprite_key', spriteKey)
         .maybeSingle();
       
       if (existing) {
         const { error } = await supabase
           .from('custom_sprites')
           .update({ 
             sprite_data: directSvgData as unknown as Record<string, never>,
             updated_at: new Date().toISOString(),
           })
           .eq('id', existing.id);
         if (error) throw error;
       } else {
         const { error } = await supabase
           .from('custom_sprites')
           .insert([{
             sprite_key: spriteKey,
             sprite_data: directSvgData as unknown as Record<string, never>,
           }]);
         if (error) throw error;
       }
       
       toast.success(`Saved: ${spriteKey}`);
       await preloadCustomSprites(true);
     } catch (err) {
       console.error('Save failed:', err);
       toast.error(`Failed to save: ${err instanceof Error ? err.message : 'Unknown error'}`);
     }
   };
   
   const handleCopy = () => {
     const code = formatSvgExport(spriteKey, {
       body: bodyPath,
       detail: detailPath,
       face: facePath,
     });
     navigator.clipboard.writeText(code);
     toast.success('Copied to clipboard');
   };
   
   return (
     <div className="grid grid-cols-[400px_1fr] gap-4 h-[calc(100vh-120px)]">
       <Card className="p-4 space-y-4 overflow-auto">
         <div className="bg-blue-100 dark:bg-blue-900/20 p-3 rounded text-xs space-y-2">
           <h3 className="font-semibold flex items-center gap-1">
             <Code className="w-4 h-4" />
             Direct SVG Editor
           </h3>
           <p>✅ <strong>Best Quality</strong> - No pixel conversion loss</p>
           <p>📝 Edit SVG path strings directly</p>
           <p>💡 Use hand-crafted bezier curves for production sprites</p>
         </div>
         
         <div>
           <Label className="text-xs">Target Type</Label>
           <Select value={target} onValueChange={(v) => setTarget(v as EditorTarget)}>
             <SelectTrigger className="h-8 text-xs">
               <SelectValue />
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="species">Species</SelectItem>
               <SelectItem value="class">Class Overlay</SelectItem>
               <SelectItem value="equipment">Equipment</SelectItem>
             </SelectContent>
           </Select>
         </div>
         
         <div>
           <Label className="text-xs">Select {target}</Label>
           {target === 'species' && (
             <Select value={selectedSpecies} onValueChange={(v) => setSelectedSpecies(v as SpeciesType)}>
               <SelectTrigger className="h-8 text-xs">
                 <SelectValue />
               </SelectTrigger>
               <SelectContent>
                 {SPECIES_LIST.map(({ key, name }) => (
                   <SelectItem key={key} value={key} className="text-xs">{name}</SelectItem>
                 ))}
               </SelectContent>
             </Select>
           )}
           {target === 'class' && (
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
           )}
           {target === 'equipment' && (
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
           )}
         </div>
         
         <div className="text-xs bg-muted p-2 rounded">
           <strong>Key:</strong> {spriteKey}
         </div>
         
         <div>
           <Label className="text-xs font-semibold">Body Path (Required)</Label>
           <textarea
             value={bodyPath}
             onChange={(e) => setBodyPath(e.target.value)}
             className="w-full h-32 text-xs font-mono p-2 border rounded mt-1"
             placeholder="M50,18 Q80,18 80,50 Q80,82 50,85 Q20,82 20,50 Q20,18 50,18"
           />
           <p className="text-xs text-muted-foreground mt-1">Main body shape. Use M (move), L (line), Q (quadratic), C (cubic), A (arc), Z (close)</p>
         </div>
         
         <div>
           <Label className="text-xs font-semibold">Detail Path (Optional)</Label>
           <textarea
             value={detailPath}
             onChange={(e) => setDetailPath(e.target.value)}
             className="w-full h-24 text-xs font-mono p-2 border rounded mt-1"
             placeholder="M35,55 Q30,60 35,65"
           />
           <p className="text-xs text-muted-foreground mt-1">Outlines, texture, clothing details</p>
         </div>
         
         <div>
           <Label className="text-xs font-semibold">Face Path (Optional)</Label>
           <textarea
             value={facePath}
             onChange={(e) => setFacePath(e.target.value)}
             className="w-full h-24 text-xs font-mono p-2 border rounded mt-1"
             placeholder="M38,42 A5,5 0 1,1 38.01,42 M62,42 A5,5 0 1,1 62.01,42"
           />
           <p className="text-xs text-muted-foreground mt-1">Eyes, mouth, facial features</p>
         </div>
         
         <div className="flex gap-2 pt-2">
           <Button onClick={handleSave} className="flex-1">
             <Save className="w-4 h-4 mr-2" />
             Save to Database
           </Button>
           <Button variant="outline" onClick={handleCopy}>
             <Copy className="w-4 h-4" />
           </Button>
         </div>
       </Card>
       
       <Card className="p-4 overflow-auto">
         <div className="space-y-4">
           <div>
             <h3 className="font-semibold text-sm mb-2">Live Preview</h3>
             <svg viewBox="0 0 100 100" className="w-64 h-64 border rounded bg-white">
               {bodyPath && (
                 <path d={bodyPath} fill="hsl(var(--primary))" fillOpacity="0.7" stroke="hsl(var(--primary))" strokeWidth="1" />
               )}
               {detailPath && (
                 <path d={detailPath} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" opacity="0.8" />
               )}
               {facePath && (
                 <path d={facePath} fill="hsl(var(--foreground))" />
               )}
             </svg>
           </div>
           
           <div className="text-xs space-y-2 bg-muted p-3 rounded">
             <h4 className="font-semibold">SVG Path Syntax Quick Reference</h4>
             <ul className="space-y-1 ml-4">
               <li><code>M x,y</code> - Move to point</li>
               <li><code>L x,y</code> - Line to point</li>
               <li><code>Q cx,cy x,y</code> - Quadratic bezier</li>
               <li><code>C cx1,cy1 cx2,cy2 x,y</code> - Cubic bezier</li>
               <li><code>A rx,ry rotation large-arc,sweep x,y</code> - Arc</li>
               <li><code>Z</code> - Close path</li>
             </ul>
             <p className="mt-2">Coordinate space: 0-100 in both X and Y</p>
           </div>
         </div>
       </Card>
     </div>
   );
 }