// Layered Monster Sprite System
// Species = base shape/outline, Element = color palette, Class = equipment overlay

import React, { forwardRef } from 'react';
import { SpeciesType, ElementType, ClassType, ELEMENT_COLORS } from './types';

// SVG path data for each species - now more recognizable
const SPECIES_PATHS: Record<SpeciesType, { body: string; detail?: string; outline?: string }> = {
  // Fantasy creatures
  slime: {
    body: 'M50,85 C15,85 5,60 10,40 C15,20 30,10 50,10 C70,10 85,20 90,40 C95,60 85,85 50,85',
    detail: 'M32,38 A6,6 0 1,1 32.01,38 M58,38 A6,6 0 1,1 58.01,38 M40,55 Q50,65 60,55',
  },
  skeleton: {
    // Skull and ribcage visible
    body: 'M50,8 A14,14 0 1,1 50,36 A14,14 0 1,1 50,8',
    detail: 'M42,20 A3,3 0 1,1 42,21 M58,20 A3,3 0 1,1 58,21 M50,28 L50,32 M44,30 L56,30 M40,40 L40,65 L42,65 L42,45 L48,45 L48,65 L52,65 L52,45 L58,45 L58,65 L60,65 L60,40 M40,55 L60,55 M40,65 L35,85 M60,65 L65,85 M45,65 L45,85 M55,65 L55,85',
    outline: 'M35,36 L35,70 L65,70 L65,36',
  },
  goblin: {
    // Pointy ears, big nose
    body: 'M50,25 Q65,25 65,45 L65,70 L55,85 L45,85 L35,70 L35,45 Q35,25 50,25',
    detail: 'M25,20 L35,35 L30,40 M75,20 L65,35 L70,40 M42,42 A4,4 0 1,1 42,43 M58,42 A4,4 0 1,1 58,43 M50,50 L50,58 L45,62 M40,70 L60,70',
  },
  mushroom: {
    // Clear mushroom cap
    body: 'M50,10 Q85,10 85,35 Q85,50 50,55 Q15,50 15,35 Q15,10 50,10',
    detail: 'M35,25 A5,5 0 1,1 35,26 M55,20 A7,7 0 1,1 55,21 M68,30 A4,4 0 1,1 68,31 M42,55 L42,85 L58,85 L58,55',
    outline: 'M42,55 L42,85 L58,85 L58,55',
  },
  ghost: {
    // Classic ghost shape with wavy bottom
    body: 'M50,10 Q80,10 80,40 L80,70 Q75,65 70,70 Q65,75 60,70 Q55,75 50,70 Q45,75 40,70 Q35,75 30,70 Q25,65 20,70 L20,40 Q20,10 50,10',
    detail: 'M35,35 A8,8 0 1,1 35.01,35 M55,35 A8,8 0 1,1 55.01,35 M38,35 A3,3 0 1,1 38,36 M58,35 A3,3 0 1,1 58,36',
  },
  imp: {
    // Wings and horns
    body: 'M50,30 Q60,30 60,45 L60,65 L55,80 L45,80 L40,65 L40,45 Q40,30 50,30',
    detail: 'M40,15 L45,30 L50,20 L55,30 L60,15 M25,40 Q15,30 20,50 Q15,60 30,55 L40,45 M75,40 Q85,30 80,50 Q85,60 70,55 L60,45 M45,42 A3,3 0 1,1 45,43 M55,42 A3,3 0 1,1 55,43 M45,55 L55,55',
  },
  golem: {
    // Blocky rock creature
    body: 'M30,15 L70,15 L75,30 L75,55 L70,60 L70,85 L55,85 L55,60 L45,60 L45,85 L30,85 L30,60 L25,55 L25,30 L30,15',
    detail: 'M38,30 A5,5 0 1,1 38,31 M62,30 A5,5 0 1,1 62,31 M35,45 L45,45 M55,45 L65,45 M40,55 L60,55',
  },
  wisp: {
    // Glowing orb with trailing flames
    body: 'M50,25 A18,18 0 1,1 50.01,25',
    detail: 'M50,43 Q60,55 55,70 Q50,85 45,70 Q40,55 50,43 M35,35 Q25,25 30,40 M65,35 Q75,25 70,40 M42,28 A4,4 0 1,1 42,29 M58,28 A4,4 0 1,1 58,29',
  },
  chimera: {
    // Multiple heads hint
    body: 'M50,30 Q60,25 60,40 L60,55 L65,65 L65,85 L55,85 L55,60 L45,60 L45,85 L35,85 L35,65 L40,55 L40,40 Q40,25 50,30',
    detail: 'M30,20 Q20,10 25,25 L35,35 M70,20 Q80,10 75,25 L65,35 M50,15 Q55,5 50,10 Q45,5 50,15 M42,38 A3,3 0 1,1 42,39 M58,38 A3,3 0 1,1 58,39 M35,25 A3,3 0 1,1 35,26 M65,25 A3,3 0 1,1 65,26',
  },
  dragon: {
    // Wings and snout
    body: 'M50,15 Q70,15 70,35 L68,45 L70,55 L70,70 L55,85 L45,85 L30,70 L30,55 L32,45 L30,35 Q30,15 50,15',
    detail: 'M15,30 Q10,20 20,40 Q10,60 30,50 M85,30 Q90,20 80,40 Q90,60 70,50 M40,30 A4,4 0 1,1 40,31 M55,30 A4,4 0 1,1 55,31 M50,40 L50,48 M45,55 L55,55 M48,55 L45,62 M52,55 L55,62 M30,15 L25,5 M70,15 L75,5',
  },
  // Real creatures  
  rat: {
    // Long tail, big ears
    body: 'M45,30 Q60,25 65,40 L65,55 L60,70 L45,75 L30,70 L25,55 L25,40 Q30,25 45,30',
    detail: 'M20,25 Q10,15 15,35 L25,40 M55,25 Q60,15 58,35 L55,40 M35,45 A3,3 0 1,1 35,46 M50,45 A3,3 0 1,1 50,46 M42,55 L45,60 M70,50 Q80,55 90,50 Q95,55 90,60',
  },
  spider: {
    // Eight legs clearly visible
    body: 'M50,35 A15,12 0 1,1 50.01,35',
    detail: 'M50,47 A12,10 0 1,1 50.01,47 M35,35 L15,15 M30,40 L5,40 M30,50 L10,65 M35,55 L20,80 M65,35 L85,15 M70,40 L95,40 M70,50 L90,65 M65,55 L80,80 M45,33 A2,2 0 1,1 45,34 M55,33 A2,2 0 1,1 55,34',
  },
  bat: {
    // Large wing span
    body: 'M50,25 A10,10 0 1,1 50.01,25',
    detail: 'M50,35 L50,60 M15,20 L25,35 L20,50 L35,55 L45,40 L50,35 M85,20 L75,35 L80,50 L65,55 L55,40 L50,35 M15,20 L10,15 M85,20 L90,15 M25,35 L20,30 M75,35 L80,30 M46,22 A3,3 0 1,1 46,23 M54,22 A3,3 0 1,1 54,23 M47,30 L50,35 L53,30',
  },
  snake: {
    // Coiled serpent
    body: 'M50,15 Q75,15 75,30 Q75,45 55,50 Q35,55 35,70 Q35,85 55,85 Q65,85 65,78',
    detail: 'M42,22 A3,3 0 1,1 42,23 M58,22 A3,3 0 1,1 58,23 M48,28 L44,35 M52,28 L56,35 M50,30 L50,35',
  },
  wolf: {
    // Pointed ears, snout
    body: 'M50,25 Q68,20 70,40 L70,55 L65,75 L55,85 L45,85 L35,75 L30,55 L30,40 Q32,20 50,25',
    detail: 'M28,15 L35,30 L40,25 M72,15 L65,30 L60,25 M40,40 A4,4 0 1,1 40,41 M60,40 A4,4 0 1,1 60,41 M50,50 L50,58 L45,62 L55,62 L50,58 M42,70 L58,70',
  },
  beetle: {
    // Hard shell, antennae
    body: 'M50,20 Q75,20 80,45 L80,65 Q80,85 50,85 Q20,85 20,65 L20,45 Q25,20 50,20',
    detail: 'M50,20 L50,85 M35,20 L28,8 L25,12 M65,20 L72,8 L75,12 M38,40 A5,5 0 1,1 38,41 M62,40 A5,5 0 1,1 62,41',
  },
  crow: {
    // Beak, wing hints
    body: 'M50,25 Q65,20 65,40 L65,60 L55,80 L45,80 L35,60 L35,40 Q35,20 50,25',
    detail: 'M35,35 L20,30 L25,40 L35,42 M65,35 L80,30 L75,40 L65,42 M50,35 L50,50 L40,55 M42,30 A3,3 0 1,1 42,31 M58,30 A3,3 0 1,1 58,31',
  },
  shark: {
    // Dorsal fin, streamlined
    body: 'M15,50 Q25,35 50,35 Q75,35 90,50 Q85,58 75,58 L65,55 L50,58 L35,55 L25,58 Q15,58 15,50',
    detail: 'M50,20 L55,35 L45,35 Z M30,48 A3,3 0 1,1 30,49 M20,52 L15,48 L25,50 L20,55 L28,52',
  },
  frog: {
    // Big eyes, webbed feet
    body: 'M50,30 Q80,30 80,55 Q80,80 50,80 Q20,80 20,55 Q20,30 50,30',
    detail: 'M30,25 A10,10 0 1,1 30.01,25 M70,25 A10,10 0 1,1 70.01,25 M33,25 A4,4 0 1,1 33,26 M67,25 A4,4 0 1,1 67,26 M10,60 L5,75 L15,70 L10,80 L20,72 L18,60 M90,60 L95,75 L85,70 L90,80 L80,72 L82,60',
  },
  jellyfish: {
    // Dome top, trailing tentacles
    body: 'M50,10 Q85,10 85,40 Q85,55 50,55 Q15,55 15,40 Q15,10 50,10',
    detail: 'M25,55 Q20,70 25,90 M35,55 Q40,75 35,95 M45,55 Q45,70 45,90 M55,55 Q55,75 55,95 M65,55 Q60,75 65,90 M75,55 Q80,70 75,85 M40,30 A4,4 0 1,1 40,31 M60,30 A4,4 0 1,1 60,31',
  },
};

// Class equipment overlays - positioned at consistent anchor points
// Crown/headgear at top (y: -5 to 15), weapons at right side (x: 70-95), armor on body (centered)
const CLASS_OVERLAYS: Record<ClassType, { weapon?: string; armor?: string; accessory?: string; color: string; secondaryColor?: string }> = {
  normal: {
    // No equipment for normal class - plain appearance
    color: '0 0% 70%', // Gray for normal
  },
  kinetic: {
    // Sword on right side, positioned outside body
    weapon: 'M75,15 L92,2 L95,5 L80,22 L83,25 L76,25 L75,18 Z',
    // Belt/armor accent on body center
    armor: 'M40,50 L60,50 L62,55 L58,58 L42,58 L38,55 Z',
    color: '45 90% 48%', // Orange for kinetic
    secondaryColor: '35 85% 40%',
  },
  energy: {
    // Glowing orb floating to the right
    weapon: 'M82,25 A8,8 0 1,1 82.01,25',
    // Energy aura/halo around head area
    accessory: 'M50,5 A25,10 0 1,1 50.01,5',
    color: '280 80% 60%', // Purple for energy
    secondaryColor: '270 90% 70%',
  },
  biological: {
    // Scale pattern armor on chest (like reptile/insect plates)
    armor: 'M35,40 Q40,35 50,35 Q60,35 65,40 L65,55 Q60,60 50,60 Q40,60 35,55 Z M40,42 L45,45 L40,48 M50,40 L55,45 L50,50 M60,42 L55,47 L60,52',
    // Small antennae/feelers on top
    accessory: 'M40,8 Q35,2 38,0 M60,8 Q65,2 62,0',
    color: '120 70% 45%', // Green for biological
    secondaryColor: '110 60% 35%',
  },
  chemical: {
    // Flask/vial on right side
    weapon: 'M78,35 L82,25 A6,6 0 1,1 88,25 L92,35 L90,40 L80,40 Z M83,42 A3,3 0 1,1 83,43 M88,44 A2,2 0 1,1 88,45',
    // Bubbles floating around
    accessory: 'M18,25 A4,4 0 1,1 18.01,25 M12,35 A3,3 0 1,1 12.01,35 M20,42 A2,2 0 1,1 20.01,42',
    color: '50 90% 50%', // Yellow/toxic
    secondaryColor: '80 85% 45%',
  },
  political: {
    // Prominent crown on top
    accessory: 'M30,5 L35,0 L40,8 L45,2 L50,-2 L55,2 L60,8 L65,0 L70,5 L68,15 L32,15 Z',
    // Regal cape/mantle
    armor: 'M25,35 Q20,50 25,70 L35,65 L35,40 Z M75,35 Q80,50 75,70 L65,65 L65,40 Z',
    color: '45 90% 55%', // Gold for political
    secondaryColor: '320 70% 45%',
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
  
  const fillColor = `hsl(${colors.primary})`;
  const strokeColor = `hsl(${colors.accent})`;
  const classColor = `hsl(${overlay.color})`;
  
  const animationClass = animated ? 'animate-pulse-glow' : '';

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
        <clipPath id={`body-clip-${species}-${element}-${classType}`}>
          <path d={paths.body} />
        </clipPath>
      </defs>
      
      {/* Subtle background circle - not element colored */}
      <circle 
        cx="50" 
        cy="50" 
        r="45" 
        fill="hsl(var(--muted) / 0.1)"
      />
      
      {/* Species body - element color contained within body shape */}
      <path
        d={paths.body}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Species outline (if exists) */}
      {paths.outline && (
        <path
          d={paths.outline}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}
      
      {/* Species detail (eyes, features) - rendered above body */}
      {paths.detail && (
        <path
          d={paths.detail}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}
      
      {/* Class equipment rendered on top of everything */}
      {/* Class armor overlay - rendered first so it's behind other equipment */}
      {overlay.armor && (
        <path
          d={overlay.armor}
          fill={`hsl(${classColor} / 0.7)`}
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
          fill={`hsl(${overlay.secondaryColor || classColor} / 0.85)`}
          stroke={`hsl(${classColor})`}
          strokeWidth="2"
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
  
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      className={className}
    >
      <path
        d={paths.body}
        fill={`hsl(${colors.primary})`}
        stroke={`hsl(${colors.accent})`}
        strokeWidth="3"
      />
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