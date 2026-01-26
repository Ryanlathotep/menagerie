// Live Preview Component
// Shows how edited components combine (species + element + class)

import React, { useMemo } from 'react';
import { SpeciesType, ElementType, ClassType, ELEMENT_COLORS } from '@/game/types';
import { SpriteData, mergeVisibleLayers, SVG_VIEWBOX_SIZE } from './types';
import { generateSvgPaths } from './svgGeneration';
import { SPECIES_SVG_PATHS } from '../spriteConversion';

interface LivePreviewProps {
  // Current editing data
  spriteData?: SpriteData;
  editingMode: 'species' | 'element' | 'class' | 'equipment';
  
  // Preview configuration
  previewSpecies: SpeciesType;
  previewElement: ElementType;
  previewClass: ClassType;
  
  // Size
  size?: number;
}

export function LivePreview({
  spriteData,
  editingMode,
  previewSpecies,
  previewElement,
  previewClass,
  size = 120,
}: LivePreviewProps) {
  // Get colors for selected element
  const colors = ELEMENT_COLORS[previewElement];
  
  // Generate paths from current sprite data (if editing)
  const customPaths = useMemo(() => {
    if (!spriteData || editingMode !== 'species') return null;
    
    // Check if there's any actual content
    const merged = mergeVisibleLayers(spriteData);
    const hasContent = merged.some(row => row.some(p => p !== 'transparent'));
    if (!hasContent) return null;
    
    return generateSvgPaths(spriteData);
  }, [spriteData, editingMode]);
  
  // Use custom paths if editing species, otherwise use hardcoded
  const paths = customPaths?.body ? customPaths : SPECIES_SVG_PATHS[previewSpecies];
  
  // Class overlay paths (simplified for preview)
  const classOverlay = getClassOverlay(previewClass);
  
  const uniqueId = `preview-${previewSpecies}-${previewElement}-${previewClass}-${Date.now()}`;
  
  return (
    <div className="relative">
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className="border rounded bg-muted/20"
      >
        {/* Clip path for body */}
        <defs>
          <clipPath id={`clip-${uniqueId}`}>
            <path d={paths.body} />
          </clipPath>
        </defs>
        
        {/* Background */}
        <circle cx="50" cy="50" r="45" fill="hsl(var(--muted) / 0.1)" />
        
        {/* Body with element color (clipped) */}
        <g clipPath={`url(#clip-${uniqueId})`}>
          <rect x="0" y="0" width="100" height="100" fill={`hsl(${colors.primary} / 0.6)`} />
        </g>
        
        {/* Body outline */}
        <path
          d={paths.body}
          fill="none"
          stroke="hsl(0 0% 10%)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Details */}
        {paths.detail && (
          <path
            d={paths.detail}
            fill="none"
            stroke="hsl(0 0% 15%)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        )}
        
        {/* Face */}
        {paths.face && (
          <path
            d={paths.face}
            fill="hsl(0 0% 8%)"
            stroke="hsl(0 0% 5%)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        )}
        
        {/* Class overlays */}
        {classOverlay.armor && (
          <path
            d={classOverlay.armor}
            fill={`hsl(${classOverlay.color} / 0.8)`}
            stroke={`hsl(${classOverlay.color})`}
            strokeWidth="2"
          />
        )}
        {classOverlay.weapon && (
          <path
            d={classOverlay.weapon}
            fill={`hsl(${classOverlay.color} / 0.9)`}
            stroke={`hsl(${classOverlay.color})`}
            strokeWidth="2"
          />
        )}
        {classOverlay.accessory && (
          <path
            d={classOverlay.accessory}
            fill={`hsl(${classOverlay.color} / 0.85)`}
            stroke={`hsl(${classOverlay.color})`}
            strokeWidth="1.5"
          />
        )}
      </svg>
      
      {/* Labels */}
      <div className="absolute -bottom-6 left-0 right-0 text-center text-xs text-muted-foreground">
        {previewSpecies} + {previewElement} + {previewClass}
      </div>
    </div>
  );
}

// Get class overlay data
function getClassOverlay(classType: ClassType): {
  weapon?: string;
  armor?: string;
  accessory?: string;
  color: string;
} {
  const overlays: Record<ClassType, { weapon?: string; armor?: string; accessory?: string; color: string }> = {
    normal: { color: '0 0% 70%' },
    kinetic: {
      weapon: 'M22,48 Q15,42 15,52 Q15,62 25,62 L32,55 L28,48 Z M78,48 Q85,42 85,52 Q85,62 75,62 L68,55 L72,48 Z',
      armor: 'M38,52 L62,52 L64,58 L60,60 L40,60 L36,58 Z',
      color: '15 85% 50%',
    },
    energy: {
      weapon: 'M35,32 L8,25 L10,30 L35,35 M65,32 L92,25 L90,30 L65,35',
      accessory: 'M50,2 A22,10 0 1,1 50.01,2',
      color: '280 85% 60%',
    },
    biological: {
      color: '120 45% 32%',
    },
    chemical: {
      accessory: 'M16,25 A6,6 0 1,1 16.01,25 M84,25 A6,6 0 1,1 84.01,25 M8,40 A5,5 0 1,1 8.01,40',
      color: '60 95% 50%',
    },
    political: {
      accessory: 'M25,10 L30,0 L37,12 L44,2 L50,-4 L56,2 L63,12 L70,0 L75,10 L72,22 L28,22 Z',
      armor: 'M20,38 Q15,55 20,75 L32,70 L32,45 Z M80,38 Q85,55 80,75 L68,70 L68,45 Z',
      color: '45 95% 55%',
    },
  };
  
  return overlays[classType];
}

// Multiple preview grid showing different element variations
export function ElementVariationsPreview({
  spriteData,
  species,
  classType,
  size = 64,
}: {
  spriteData?: SpriteData;
  species: SpeciesType;
  classType: ClassType;
  size?: number;
}) {
  const elements: ElementType[] = ['normal', 'fire', 'water', 'earth', 'air', 'void'];
  
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">Element Variations</div>
      <div className="grid grid-cols-3 gap-2">
        {elements.map(element => (
          <div key={element} className="text-center">
            <LivePreview
              spriteData={spriteData}
              editingMode="species"
              previewSpecies={species}
              previewElement={element}
              previewClass={classType}
              size={size}
            />
            <div className="text-xs mt-1 capitalize">{element}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
