// Layered Monster Sprite System
// Species = base shape/outline, Element = color palette, Class = equipment overlay

import React, { forwardRef } from 'react';
import { SpeciesType, ElementType, ClassType, ELEMENT_COLORS } from './types';

// SVG path data for each species - centered bodies with standardized positions
// All bodies centered at x=50, legs at y=75-90, arms at x=25-35 and x=65-75
const SPECIES_PATHS: Record<SpeciesType, { body: string; detail: string; face: string }> = {
  // Fantasy creatures
  slime: {
    body: 'M50,85 C20,85 10,60 15,40 C20,20 35,12 50,12 C65,12 80,20 85,40 C90,60 80,85 50,85',
    detail: '',
    face: 'M38,40 A5,5 0 1,1 38.01,40 M62,40 A5,5 0 1,1 62.01,40 M42,55 Q50,65 58,55',
  },
  skeleton: {
    body: 'M50,12 A12,12 0 1,1 50.01,12 M38,36 L38,55 M62,36 L62,55 M42,55 L42,55 L58,55 M42,55 L42,75 M58,55 L58,75 M42,75 L38,90 M58,75 L62,90',
    detail: 'M45,36 L45,55 M50,36 L50,55 M55,36 L55,55 M38,42 L62,42 M38,48 L62,48',
    face: 'M44,18 A3,3 0 1,1 44.01,18 M56,18 A3,3 0 1,1 56.01,18 M47,26 L50,30 L53,26',
  },
  goblin: {
    body: 'M50,20 Q62,20 62,35 L62,55 L58,75 L55,90 L45,90 L42,75 L38,55 L38,35 Q38,20 50,20 M28,55 L38,50 M72,55 L62,50',
    detail: 'M22,18 L35,30 M78,18 L65,30',
    face: 'M43,32 A3,3 0 1,1 43.01,32 M57,32 A3,3 0 1,1 57.01,32 M50,40 L50,48 L47,52',
  },
  mushroom: {
    body: 'M50,8 Q82,8 82,32 Q82,48 50,52 Q18,48 18,32 Q18,8 50,8 M42,52 L42,90 L58,90 L58,52',
    detail: 'M32,22 A6,6 0 1,1 32.01,22 M58,18 A8,8 0 1,1 58.01,18 M72,28 A4,4 0 1,1 72.01,28',
    face: 'M42,35 A3,3 0 1,1 42.01,35 M58,35 A3,3 0 1,1 58.01,35',
  },
  ghost: {
    body: 'M50,12 Q78,12 78,42 L78,72 Q72,68 66,72 Q60,76 54,72 Q50,76 46,72 Q40,76 34,72 Q28,68 22,72 L22,42 Q22,12 50,12',
    detail: '',
    face: 'M38,38 A7,7 0 1,1 38.01,38 M62,38 A7,7 0 1,1 62.01,38 M42,38 A2,2 0 1,1 42.01,38 M66,38 A2,2 0 1,1 66.01,38',
  },
  imp: {
    body: 'M50,28 Q58,28 58,40 L58,58 L55,75 L52,90 L48,90 L45,75 L42,58 L42,40 Q42,28 50,28 M28,45 L42,42 M72,45 L58,42',
    detail: 'M42,15 L46,28 M58,15 L54,28 M20,38 Q12,30 18,48 Q12,58 30,52 M80,38 Q88,30 82,48 Q88,58 70,52',
    face: 'M46,38 A2,2 0 1,1 46.01,38 M54,38 A2,2 0 1,1 54.01,38 M47,48 L53,48',
  },
  golem: {
    body: 'M35,15 L65,15 L70,28 L70,52 L65,58 L65,90 L55,90 L55,58 L45,58 L45,90 L35,90 L35,58 L30,52 L30,28 Z M25,35 L35,38 M75,35 L65,38',
    detail: 'M38,42 L48,42 M52,42 L62,42 M42,52 L58,52',
    face: 'M42,28 A4,4 0 1,1 42.01,28 M58,28 A4,4 0 1,1 58.01,28',
  },
  wisp: {
    body: 'M50,22 A16,16 0 1,1 50.01,22',
    detail: 'M50,38 Q58,50 54,65 Q50,82 46,65 Q42,50 50,38 M35,30 Q28,22 32,38 M65,30 Q72,22 68,38',
    face: 'M44,26 A3,3 0 1,1 44.01,26 M56,26 A3,3 0 1,1 56.01,26',
  },
  chimera: {
    body: 'M50,28 Q58,25 58,38 L58,52 L62,62 L62,90 L55,90 L52,58 L48,58 L45,90 L38,90 L38,62 L42,52 L42,38 Q42,25 50,28 M28,48 L42,45 M72,48 L58,45',
    detail: 'M32,18 Q22,10 28,25 M68,18 Q78,10 72,25 M50,12 Q55,5 50,8',
    face: 'M45,35 A2,2 0 1,1 45.01,35 M55,35 A2,2 0 1,1 55.01,35 M35,22 A2,2 0 1,1 35.01,22 M65,22 A2,2 0 1,1 65.01,22',
  },
  dragon: {
    body: 'M50,18 Q68,18 68,35 L66,45 L68,55 L68,70 L58,90 L42,90 L32,70 L32,55 L34,45 L32,35 Q32,18 50,18 M28,50 L32,48 M72,50 L68,48',
    detail: 'M18,32 Q12,22 22,40 Q12,58 32,50 M82,32 Q88,22 78,40 Q88,58 68,50 M32,18 L28,8 M68,18 L72,8',
    face: 'M42,32 A3,3 0 1,1 42.01,32 M58,32 A3,3 0 1,1 58.01,32 M50,42 L50,50 M46,55 L54,55',
  },
  // Real creatures - all centered with proper proportions
  rat: {
    body: 'M50,25 Q65,22 68,38 L68,52 L62,68 L55,90 L45,90 L38,68 L32,52 L32,38 Q35,22 50,25 M28,50 L32,48 M72,50 L68,48',
    detail: 'M25,22 Q15,12 20,32 M75,22 Q85,12 80,32 M72,55 Q82,58 92,52 Q96,58 92,62',
    face: 'M42,38 A3,3 0 1,1 42.01,38 M58,38 A3,3 0 1,1 58.01,38 M48,50 L50,55 L52,50',
  },
  spider: {
    body: 'M50,32 A14,11 0 1,1 50.01,32 M50,43 A10,8 0 1,1 50.01,43',
    detail: 'M36,35 L18,18 M32,40 L8,40 M32,48 L15,62 M36,52 L25,78 M64,35 L82,18 M68,40 L92,40 M68,48 L85,62 M64,52 L75,78',
    face: 'M45,30 A2,2 0 1,1 45.01,30 M55,30 A2,2 0 1,1 55.01,30 M48,30 A1,1 0 1,1 48.01,30 M52,30 A1,1 0 1,1 52.01,30',
  },
  bat: {
    body: 'M50,25 A9,9 0 1,1 50.01,25 M50,34 L50,55',
    detail: 'M18,22 L28,35 L22,48 L38,52 L46,38 L50,34 M82,22 L72,35 L78,48 L62,52 L54,38 L50,34 M18,22 L12,15 M82,22 L88,15',
    face: 'M46,22 A2,2 0 1,1 46.01,22 M54,22 A2,2 0 1,1 54.01,22 M48,30 L50,34 L52,30',
  },
  snake: {
    body: 'M50,15 Q72,15 72,32 Q72,48 54,52 Q36,56 36,72 Q36,88 54,88 Q65,88 65,80',
    detail: '',
    face: 'M44,22 A3,3 0 1,1 44.01,22 M56,22 A3,3 0 1,1 56.01,22 M48,30 L46,38 M52,30 L54,38',
  },
  wolf: {
    body: 'M50,22 Q66,18 68,38 L68,55 L62,72 L58,90 L42,90 L38,72 L32,55 L32,38 Q34,18 50,22 M28,52 L32,50 M72,52 L68,50',
    detail: 'M30,15 L38,28 M70,15 L62,28',
    face: 'M42,38 A3,3 0 1,1 42.01,38 M58,38 A3,3 0 1,1 58.01,38 M50,48 L50,58 L46,62 L54,62 Z',
  },
  beetle: {
    body: 'M50,18 Q75,18 78,42 L78,62 Q78,88 50,88 Q22,88 22,62 L22,42 Q25,18 50,18',
    detail: 'M50,18 L50,88 M35,18 L30,8 M65,18 L70,8',
    face: 'M40,38 A4,4 0 1,1 40.01,38 M60,38 A4,4 0 1,1 60.01,38',
  },
  crow: {
    body: 'M50,22 Q65,18 65,38 L65,58 L55,85 L45,85 L35,58 L35,38 Q35,18 50,22 M28,45 L35,42 M72,45 L65,42',
    detail: 'M35,35 L22,32 L28,42 M65,35 L78,32 L72,42',
    face: 'M44,30 A2,2 0 1,1 44.01,30 M56,30 A2,2 0 1,1 56.01,30 M50,38 L50,52 L42,58',
  },
  shark: {
    body: 'M18,50 Q28,35 50,35 Q72,35 88,50 Q82,58 72,58 L62,55 L50,58 L38,55 L28,58 Q18,58 18,50',
    detail: 'M50,22 L55,35 L45,35 Z',
    face: 'M32,48 A3,3 0 1,1 32.01,48 M22,52 L18,48 L28,50 L22,56',
  },
  frog: {
    body: 'M50,28 Q78,28 78,55 Q78,82 50,82 Q22,82 22,55 Q22,28 50,28',
    detail: 'M12,62 L8,78 L18,72 L12,82 L22,75 M88,62 L92,78 L82,72 L88,82 L78,75',
    face: 'M32,22 A9,9 0 1,1 32.01,22 M68,22 A9,9 0 1,1 68.01,22 M35,22 A3,3 0 1,1 35.01,22 M65,22 A3,3 0 1,1 65.01,22',
  },
  jellyfish: {
    body: 'M50,12 Q82,12 82,38 Q82,52 50,52 Q18,52 18,38 Q18,12 50,12',
    detail: 'M28,52 Q22,68 28,88 M38,52 Q42,72 38,92 M48,52 Q48,68 48,88 M52,52 Q52,72 52,92 M62,52 Q58,72 62,88 M72,52 Q78,68 72,85',
    face: 'M42,30 A3,3 0 1,1 42.01,30 M58,30 A3,3 0 1,1 58.01,30',
  },
};

// Class equipment overlays - improved with requested designs
// Kinetic: Boxing gloves, Biological: Camo pattern (clipped), Energy: Eye lasers, Chemical: Bubbles, Political: Crown
const CLASS_OVERLAYS: Record<ClassType, { weapon?: string; armor?: string; accessory?: string; camoPattern?: boolean; color: string; secondaryColor?: string }> = {
  normal: {
    color: '0 0% 70%',
  },
  kinetic: {
    // Boxing gloves on both sides
    weapon: 'M22,48 Q15,42 15,52 Q15,62 25,62 L32,55 L28,48 Z M78,48 Q85,42 85,52 Q85,62 75,62 L68,55 L72,48 Z',
    // Belt/waist band
    armor: 'M38,52 L62,52 L64,58 L60,60 L40,60 L36,58 Z',
    color: '15 85% 50%', // Red-orange for fighting
    secondaryColor: '0 80% 45%',
  },
  energy: {
    // Eye laser beams shooting outward
    weapon: 'M35,32 L8,25 L10,30 L35,35 M65,32 L92,25 L90,30 L65,35 M8,25 L5,22 M92,25 L95,22',
    // Glowing aura around head - larger and more visible
    accessory: 'M50,2 A22,10 0 1,1 50.01,2',
    color: '280 85% 60%', // Purple energy
    secondaryColor: '300 90% 70%',
  },
  biological: {
    // Camo pattern rendered inside body via clip path
    camoPattern: true,
    color: '120 55% 35%', // Dark green base
    secondaryColor: '90 45% 45%', // Olive
  },
  chemical: {
    // Bubbles floating around - more prominent
    accessory: 'M16,25 A6,6 0 1,1 16.01,25 M8,40 A5,5 0 1,1 8.01,40 M20,55 A4,4 0 1,1 20.01,55 M84,25 A6,6 0 1,1 84.01,25 M92,40 A5,5 0 1,1 92.01,40 M80,55 A4,4 0 1,1 80.01,55 M12,62 A3,3 0 1,1 12.01,62 M88,62 A3,3 0 1,1 88.01,62',
    color: '60 95% 50%', // Yellow-green toxic
    secondaryColor: '90 90% 55%',
  },
  political: {
    // Prominent golden crown - larger
    accessory: 'M25,10 L30,0 L37,12 L44,2 L50,-4 L56,2 L63,12 L70,0 L75,10 L72,22 L28,22 Z',
    // Royal cape/mantle sides
    armor: 'M20,38 Q15,55 20,75 L32,70 L32,45 Z M80,38 Q85,55 80,75 L68,70 L68,45 Z',
    color: '45 95% 55%', // Gold
    secondaryColor: '38 90% 45%',
  },
};

// Element glow filter
function getElementGlow(element: ElementType): string {
  const colors = ELEMENT_COLORS[element];
  return `drop-shadow(0 0 6px hsl(${colors.secondary})) drop-shadow(0 0 2px hsl(${colors.primary}))`;
}

interface MonsterSpriteProps {
  species: SpeciesType;
  element: ElementType;
  classType: ClassType;
  size?: number;
  className?: string;
  animated?: boolean;
}

export const MonsterSprite = forwardRef<SVGSVGElement, MonsterSpriteProps>(({ 
  species, 
  element, 
  classType, 
  size = 64,
  className = '',
  animated = true,
}, ref) => {
  const colors = ELEMENT_COLORS[element];
  const paths = SPECIES_PATHS[species];
  const overlay = CLASS_OVERLAYS[classType];
  const classColor = overlay.color;
  
  const animationClass = animated ? 'animate-pulse-glow' : '';
  const uniqueId = `sprite-${species}-${element}-${classType}-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <svg 
      ref={ref}
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      className={`${className} ${animationClass}`}
      style={{ filter: getElementGlow(element) }}
    >
      {/* Define clip path from species body for contained fill */}
      <defs>
        <clipPath id={`body-clip-${uniqueId}`}>
          <path d={paths.body} />
        </clipPath>
        {/* Camo pattern for biological class */}
        {overlay.camoPattern && (
          <pattern id={`camo-${uniqueId}`} patternUnits="userSpaceOnUse" width="20" height="20">
            <rect width="20" height="20" fill={`hsl(${overlay.color})`} />
            <ellipse cx="5" cy="5" rx="6" ry="4" fill={`hsl(${overlay.secondaryColor})`} />
            <ellipse cx="15" cy="12" rx="5" ry="3" fill={`hsl(80 40% 30%)`} />
            <ellipse cx="10" cy="18" rx="4" ry="3" fill={`hsl(${overlay.secondaryColor})`} />
            <ellipse cx="2" cy="14" rx="3" ry="2" fill={`hsl(100 35% 28%)`} />
            <ellipse cx="18" cy="4" rx="3" ry="2" fill={`hsl(80 40% 30%)`} />
          </pattern>
        )}
      </defs>
      
      {/* Subtle background circle - not element colored */}
      <circle 
        cx="50" 
        cy="50" 
        r="45" 
        fill="hsl(var(--muted) / 0.1)"
      />
      
      {/* Species body - element color with transparency, clipped to body shape */}
      <g clipPath={`url(#body-clip-${uniqueId})`}>
        {/* Base element fill - contained within body */}
        <rect x="0" y="0" width="100" height="100" fill={`hsl(${colors.primary} / 0.6)`} />
        
        {/* Biological camo overlay - only rendered for biological class */}
        {overlay.camoPattern && (
          <rect x="0" y="0" width="100" height="100" fill={`url(#camo-${uniqueId})`} opacity="0.7" />
        )}
      </g>
      
      {/* Species body outline - dark and opaque */}
      <path
        d={paths.body}
        fill="none"
        stroke="hsl(0 0% 10%)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Species detail (body details like ribs, wings, etc) - clipped */}
      {paths.detail && (
        <g clipPath={`url(#body-clip-${uniqueId})`}>
          <path
            d={paths.detail}
            fill="none"
            stroke="hsl(0 0% 15%)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      )}
      
      {/* Face features - dark and very opaque for visibility */}
      {paths.face && (
        <path
          d={paths.face}
          fill="hsl(0 0% 8%)"
          stroke="hsl(0 0% 5%)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      )}
      
      {/* Class equipment rendered on top of everything */}
      {/* Class armor overlay - rendered first so it's behind other equipment */}
      {overlay.armor && (
        <path
          d={overlay.armor}
          fill={`hsl(${classColor} / 0.8)`}
          stroke={`hsl(${classColor})`}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      
      {/* Class weapon overlay - positioned to the side */}
      {overlay.weapon && (
        <path
          d={overlay.weapon}
          fill={`hsl(${classColor} / 0.9)`}
          stroke={`hsl(${classColor})`}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      
      {/* Class accessory overlay - crown/aura/etc */}
      {overlay.accessory && (
        <path
          d={overlay.accessory}
          fill={`hsl(${overlay.secondaryColor || classColor} / 0.9)`}
          stroke={`hsl(${classColor})`}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
});

MonsterSprite.displayName = 'MonsterSprite';

// Compact sprite for dungeon tiles
export function MonsterSpriteSmall({ 
  species, 
  element, 
  size = 24,
  className = '',
}: { 
  species: SpeciesType; 
  element: ElementType; 
  size?: number;
  className?: string;
}) {
  const colors = ELEMENT_COLORS[element];
  const paths = SPECIES_PATHS[species];
  const uniqueId = `small-${species}-${element}-${Math.random().toString(36).substr(2, 9)}`;
  
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      className={className}
    >
      <defs>
        <clipPath id={`body-clip-${uniqueId}`}>
          <path d={paths.body} />
        </clipPath>
      </defs>
      
      {/* Clipped element fill */}
      <g clipPath={`url(#body-clip-${uniqueId})`}>
        <rect x="0" y="0" width="100" height="100" fill={`hsl(${colors.primary} / 0.6)`} />
      </g>
      
      {/* Dark outline */}
      <path
        d={paths.body}
        fill="none"
        stroke="hsl(0 0% 10%)"
        strokeWidth="4"
      />
      
      {/* Dark face */}
      {paths.face && (
        <path
          d={paths.face}
          fill="hsl(0 0% 8%)"
          stroke="hsl(0 0% 5%)"
          strokeWidth="2"
        />
      )}
    </svg>
  );
}

// Get a procedurally generated name for a monster
export function generateMonsterName(
  species: SpeciesType,
  element: ElementType,
  classType: ClassType
): string {
  const elementPrefixes: Record<ElementType, string[]> = {
    normal: ['Common', 'Plain', 'Basic', 'Simple', 'Pure'],
    fire: ['Pyro', 'Blaze', 'Ember', 'Scorch', 'Inferno'],
    water: ['Aqua', 'Tide', 'Torrent', 'Deluge', 'Surge'],
    earth: ['Terra', 'Stone', 'Bedrock', 'Granite', 'Seismic'],
    air: ['Aero', 'Zephyr', 'Gale', 'Tempest', 'Cyclone'],
    void: ['Nether', 'Shadow', 'Eclipse', 'Null', 'Abyssal'],
  };
  
  const classSuffixes: Record<ClassType, string[]> = {
    normal: ['Beast', 'Creature', 'Being', 'Entity', 'Form'],
    kinetic: ['Striker', 'Brawler', 'Warrior', 'Fighter', 'Champion'],
    energy: ['Caster', 'Channeler', 'Weaver', 'Adept', 'Mage'],
    biological: ['Symbiote', 'Growth', 'Bloom', 'Organism', 'Hybrid'],
    chemical: ['Alchemist', 'Reactor', 'Catalyst', 'Compound', 'Venom'],
    political: ['Diplomat', 'Sovereign', 'Regent', 'Noble', 'Envoy'],
  };
  
  // Use species name as a seed for consistency
  const speciesIndex = species.charCodeAt(0) % 5;
  const elementPrefix = elementPrefixes[element][speciesIndex];
  const classSuffix = classSuffixes[classType][(speciesIndex + 2) % 5];
  
  return `${elementPrefix} ${classSuffix}`;
}