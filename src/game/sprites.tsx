// Layered Monster Sprite System
// Species = base shape/outline, Element = color palette, Class = equipment overlay

import { SpeciesType, ElementType, ClassType, ELEMENT_COLORS } from './types';

// SVG path data for each species (simplified silhouettes)
const SPECIES_PATHS: Record<SpeciesType, { body: string; detail?: string }> = {
  // Fantasy creatures
  slime: {
    body: 'M50,80 C20,80 10,60 15,45 C20,25 35,15 50,15 C65,15 80,25 85,45 C90,60 80,80 50,80',
    detail: 'M35,40 A4,4 0 1,1 35.01,40 M55,40 A4,4 0 1,1 55.01,40',
  },
  skeleton: {
    body: 'M50,10 A10,10 0 1,1 50,30 A10,10 0 1,1 50,10 M45,30 L45,55 M55,30 L55,55 M40,35 L30,50 M60,35 L70,50 M45,55 L45,80 M55,55 L55,80 M45,80 L40,90 M55,80 L60,90',
  },
  goblin: {
    body: 'M50,15 Q65,10 60,25 L55,30 L55,45 L65,60 L55,75 L45,75 L35,60 L45,45 L45,30 L40,25 Q35,10 50,15',
    detail: 'M42,35 L38,30 M58,35 L62,30',
  },
  mushroom: {
    body: 'M50,20 Q70,20 75,35 Q80,50 60,55 L60,80 L40,80 L40,55 Q20,50 25,35 Q30,20 50,20',
    detail: 'M35,30 A3,3 0 1,1 35,31 M55,28 A4,4 0 1,1 55,29 M62,38 A2,2 0 1,1 62,39',
  },
  ghost: {
    body: 'M50,15 Q75,15 75,40 L75,70 Q70,65 65,70 Q60,75 55,70 Q50,75 45,70 Q40,75 35,70 Q30,65 25,70 L25,40 Q25,15 50,15',
    detail: 'M40,35 A4,4 0 1,1 40.01,35 M60,35 A4,4 0 1,1 60.01,35',
  },
  imp: {
    body: 'M50,10 L60,5 L55,15 L50,20 L45,15 L40,5 L50,10 M50,20 Q60,25 55,40 L55,55 L60,70 L55,85 L50,70 L45,85 L40,70 L45,55 L45,40 Q40,25 50,20',
    detail: 'M35,35 L30,25 M65,35 L70,25',
  },
  golem: {
    body: 'M35,15 L65,15 L70,25 L70,50 L75,55 L75,85 L60,85 L60,60 L55,55 L55,85 L45,85 L45,55 L40,60 L40,85 L25,85 L25,55 L30,50 L30,25 L35,15',
  },
  wisp: {
    body: 'M50,30 A15,15 0 1,1 50.01,30 M50,45 Q60,55 55,70 Q50,85 45,70 Q40,55 50,45',
    detail: 'M40,25 L35,15 M60,25 L65,15 M45,30 A2,2 0 1,1 45,31 M55,30 A2,2 0 1,1 55,31',
  },
  chimera: {
    body: 'M30,20 Q25,10 35,15 L40,25 M70,20 Q75,10 65,15 L60,25 M50,20 Q55,10 50,5 Q45,10 50,20 M40,25 L40,45 L30,55 L30,80 M60,25 L60,45 L70,55 L70,80 M45,45 L45,80 L55,80 L55,45',
    detail: 'M35,30 A2,2 0 1,1 35,31 M65,30 A2,2 0 1,1 65,31 M50,25 A2,2 0 1,1 50,26',
  },
  dragon: {
    body: 'M50,10 Q70,10 70,30 L75,40 L70,45 L70,60 L80,80 L65,75 L55,85 L50,80 L45,85 L35,75 L20,80 L30,60 L30,45 L25,40 L30,30 Q30,10 50,10',
    detail: 'M35,25 Q30,20 30,30 M65,25 Q70,20 70,30 M40,30 A2,2 0 1,1 40,31 M55,30 A2,2 0 1,1 55,31',
  },
  // Real creatures
  rat: {
    body: 'M50,20 Q65,15 70,25 L65,35 L65,50 L75,60 L75,75 L60,70 L50,75 L40,70 L25,75 L25,60 L35,50 L35,35 L30,25 Q35,15 50,20',
    detail: 'M20,25 Q15,20 25,25 M80,25 Q85,20 75,25 M40,30 A2,2 0 1,1 40,31 M55,30 A2,2 0 1,1 55,31',
  },
  spider: {
    body: 'M50,35 A15,12 0 1,1 50.01,35 M50,50 A10,8 0 1,1 50.01,50',
    detail: 'M35,35 L20,20 M30,40 L10,45 M30,50 L15,65 M35,55 L25,75 M65,35 L80,20 M70,40 L90,45 M70,50 L85,65 M65,55 L75,75',
  },
  bat: {
    body: 'M50,30 A8,8 0 1,1 50.01,30 M50,45 L50,70 M50,45 L30,25 L20,35 L25,55 L40,50 M50,45 L70,25 L80,35 L75,55 L60,50',
    detail: 'M45,28 A2,2 0 1,1 45,29 M55,28 A2,2 0 1,1 55,29',
  },
  snake: {
    body: 'M50,15 Q70,15 70,30 Q70,45 50,50 Q30,55 30,70 Q30,85 50,85 Q60,85 60,80',
    detail: 'M45,22 A2,2 0 1,1 45,23 M55,22 A2,2 0 1,1 55,23 M52,28 L58,35 M48,28 L52,35',
  },
  wolf: {
    body: 'M50,15 Q60,10 65,15 L60,25 L60,35 L65,45 L70,65 L60,80 L50,75 L40,80 L30,65 L35,45 L40,35 L40,25 L35,15 Q40,10 50,15',
    detail: 'M35,15 L30,5 M65,15 L70,5 M42,28 A2,2 0 1,1 42,29 M58,28 A2,2 0 1,1 58,29',
  },
  beetle: {
    body: 'M50,15 Q70,15 75,35 L75,60 Q75,80 50,80 Q25,80 25,60 L25,35 Q30,15 50,15',
    detail: 'M50,15 L50,80 M35,25 L30,15 M65,25 L70,15 M40,35 A3,3 0 1,1 40,36 M60,35 A3,3 0 1,1 60,36',
  },
  crow: {
    body: 'M50,20 Q60,15 60,25 L55,35 L55,50 L65,60 L60,75 L50,80 L40,75 L35,60 L45,50 L45,35 L40,25 Q40,15 50,20',
    detail: 'M40,25 L30,20 L35,30 M60,25 L70,20 L65,30 M50,30 L50,45',
  },
  shark: {
    body: 'M20,50 Q30,35 50,35 Q70,35 85,50 Q80,55 70,55 L60,70 L50,55 L40,55 L30,55 Q20,55 20,50',
    detail: 'M50,25 L50,35 M35,45 A2,2 0 1,1 35,46 M25,50 L20,55 L30,52 L25,57 L35,50',
  },
  frog: {
    body: 'M50,25 Q75,25 75,45 Q75,65 50,75 Q25,65 25,45 Q25,25 50,25',
    detail: 'M35,30 A6,6 0 1,1 35,31 M65,30 A6,6 0 1,1 65,31 M20,50 L10,65 L25,60 M80,50 L90,65 L75,60',
  },
  jellyfish: {
    body: 'M50,15 Q80,15 80,40 Q80,50 50,50 Q20,50 20,40 Q20,15 50,15',
    detail: 'M30,50 Q25,70 30,85 M40,50 Q45,75 40,90 M50,50 Q50,70 50,85 M60,50 Q55,75 60,90 M70,50 Q75,70 70,85',
  },
};

// Class equipment overlays
const CLASS_OVERLAYS: Record<ClassType, { weapon?: string; armor?: string; accessory?: string }> = {
  kinetic: {
    weapon: 'M75,40 L90,25 L88,27 L92,23', // Sword
    armor: 'M40,45 L60,45 L58,55 L42,55 Z', // Chest plate
  },
  energy: {
    weapon: 'M80,35 A8,8 0 1,1 80,36', // Energy orb
    accessory: 'M30,20 L25,10 M70,20 L75,10', // Antenna
  },
  biological: {
    armor: 'M35,40 Q30,50 35,60 Q40,55 45,60 M65,40 Q70,50 65,60 Q60,55 55,60', // Vines
    accessory: 'M50,10 L50,5 Q55,0 50,0 Q45,0 50,5', // Sprout
  },
  chemical: {
    weapon: 'M80,50 L85,45 L90,50 L85,55 Z', // Flask shape
    accessory: 'M25,35 Q20,30 25,25 M30,30 Q25,25 30,20', // Bubbles
  },
  political: {
    accessory: 'M50,5 L45,15 L55,15 Z', // Crown point
    armor: 'M35,50 L30,55 L35,60 M65,50 L70,55 L65,60', // Medals
  },
};

// Element glow filter
function getElementGlow(element: ElementType): string {
  const colors = ELEMENT_COLORS[element];
  return `drop-shadow(0 0 4px hsl(${colors.secondary}))`;
}

interface MonsterSpriteProps {
  species: SpeciesType;
  element: ElementType;
  classType: ClassType;
  size?: number;
  className?: string;
  animated?: boolean;
}

export function MonsterSprite({ 
  species, 
  element, 
  classType, 
  size = 64,
  className = '',
  animated = true,
}: MonsterSpriteProps) {
  const colors = ELEMENT_COLORS[element];
  const paths = SPECIES_PATHS[species];
  const overlay = CLASS_OVERLAYS[classType];
  
  const fillColor = `hsl(${colors.primary})`;
  const strokeColor = `hsl(${colors.accent})`;
  const secondaryColor = `hsl(${colors.secondary})`;
  
  const animationClass = animated ? 'animate-pulse-glow' : '';

  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      className={`${className} ${animationClass}`}
      style={{ filter: getElementGlow(element) }}
    >
      {/* Background glow */}
      <circle 
        cx="50" 
        cy="50" 
        r="45" 
        fill={`hsl(${colors.primary} / 0.15)`}
      />
      
      {/* Species body */}
      <path
        d={paths.body}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Species detail (eyes, features) */}
      {paths.detail && (
        <path
          d={paths.detail}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}
      
      {/* Class weapon overlay */}
      {overlay.weapon && (
        <path
          d={overlay.weapon}
          fill="none"
          stroke={secondaryColor}
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.9"
        />
      )}
      
      {/* Class armor overlay */}
      {overlay.armor && (
        <path
          d={overlay.armor}
          fill={`hsl(${colors.secondary} / 0.4)`}
          stroke={secondaryColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.8"
        />
      )}
      
      {/* Class accessory overlay */}
      {overlay.accessory && (
        <path
          d={overlay.accessory}
          fill="none"
          stroke={secondaryColor}
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.9"
        />
      )}
    </svg>
  );
}

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
    fire: ['Pyro', 'Blaze', 'Ember', 'Scorch', 'Inferno'],
    water: ['Aqua', 'Tide', 'Torrent', 'Deluge', 'Surge'],
    earth: ['Terra', 'Stone', 'Bedrock', 'Granite', 'Seismic'],
    air: ['Aero', 'Zephyr', 'Gale', 'Tempest', 'Cyclone'],
    void: ['Nether', 'Shadow', 'Eclipse', 'Null', 'Abyssal'],
  };
  
  const classSuffixes: Record<ClassType, string[]> = {
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