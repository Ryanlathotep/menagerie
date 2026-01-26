// Layered Monster Sprite System
// Species = base shape/outline, Element = color palette, Class = equipment overlay
// Equipment = visual overlays for equipped items

import React, { forwardRef } from "react";
import { SpeciesType, ElementType, ClassType, ELEMENT_COLORS } from "./types";
import { MonsterEquipment, EquipmentSlot, Rarity, RARITY_COLORS } from "./equipment";
import { getGlobalSpriteOverride } from "@/hooks/useCustomSprites";

// SVG path data for each species - centered bodies with standardized positions
// All bodies centered at x=50, legs at y=75-90, arms at x=25-35 and x=65-75
const SPECIES_PATHS: Record<SpeciesType, { body: string; detail: string; face: string }> = {
  // ============= FANTASY CREATURES =============
  slime: {
    // Classic blob with drippy bottom, shiny highlights
    body: "M50,15 C75,15 85,35 85,55 C85,75 75,88 60,90 C55,91 52,88 50,90 C48,88 45,91 40,90 C25,88 15,75 15,55 C15,35 25,15 50,15 Z",
    detail: "M30,35 Q35,32 38,36 M62,35 Q67,32 70,36", // Highlight curves
    face: "M35,45 A6,6 0 1,1 35.01,45 M65,45 A6,6 0 1,1 65.01,45 M42,62 Q50,70 58,62", // Big cute eyes, smile
  },
  skeleton: {
    // Skull on top, visible ribcage, pelvis structure
    body: "M50,5 C65,5 72,15 72,28 C72,38 65,45 55,46 L58,50 L62,50 L62,68 L58,68 L55,72 L58,90 L52,90 L50,75 L48,90 L42,90 L45,72 L42,68 L38,68 L38,50 L42,50 L45,46 C35,45 28,38 28,28 C28,15 35,5 50,5 Z",
    detail: "M42,52 L58,52 M44,56 L56,56 M46,60 L54,60 M48,64 L52,64 M35,78 L38,85 M65,78 L62,85", // Ribs and leg bones
    face: "M40,20 A7,8 0 1,1 40.01,20 M60,20 A7,8 0 1,1 60.01,20 M42,35 L50,40 L58,35", // Hollow eye sockets, nasal hole
  },
  goblin: {
    // Hunched posture, big ears, long nose, gangly limbs
    body: "M50,12 C60,10 68,18 68,30 L68,45 C68,52 64,56 60,58 L58,75 L62,90 L54,90 L50,70 L46,90 L38,90 L42,75 L40,58 C36,56 32,52 32,45 L32,30 C32,18 40,10 50,12 Z",
    detail: "M25,15 L35,28 M75,15 L65,28 M30,45 L22,55 M70,45 L78,55", // Pointy ears, reaching arms
    face: "M42,28 A4,4 0 1,1 42.01,28 M58,28 A4,4 0 1,1 58.01,28 M50,35 L50,48 L46,52 M44,55 L56,55", // Beady eyes, long nose, wide grin
  },
  mushroom: {
    // Large spotted cap, stout stem with face on stem
    body: "M50,8 C80,8 92,28 88,45 C85,55 70,58 50,58 C30,58 15,55 12,45 C8,28 20,8 50,8 Z M42,58 L42,90 L58,90 L58,58 Z",
    detail: "M30,22 A8,8 0 1,1 30.01,22 M55,18 A10,10 0 1,1 55.01,18 M70,30 A6,6 0 1,1 70.01,30 M40,38 A5,5 0 1,1 40.01,38", // Cap spots
    face: "M45,70 A3,3 0 1,1 45.01,70 M55,70 A3,3 0 1,1 55.01,70 M48,78 Q50,82 52,78", // Face on stem
  },
  ghost: {
    // Classic sheet ghost with wavy bottom, hollow eyes
    body: "M50,8 C75,8 85,25 85,45 L85,70 C85,75 78,72 72,78 C66,84 60,78 55,82 C50,86 45,82 40,78 C35,74 28,80 22,75 L15,70 L15,45 C15,25 25,8 50,8 Z",
    detail: "M30,50 Q25,58 30,66 M70,50 Q75,58 70,66", // Flowing trails
    face: "M35,35 A10,12 0 1,1 35.01,35 M65,35 A10,12 0 1,1 65.01,35 M50,55 A6,8 0 1,1 50.01,55", // Hollow eyes, "O" mouth
  },
  imp: {
    // Small devil with horns, bat wings, pointed tail, mischievous
    body: "M50,22 C62,22 68,32 68,45 L68,60 L60,90 L40,90 L32,60 L32,45 C32,32 38,22 50,22 Z",
    detail: "M38,10 L42,22 M62,10 L58,22 M22,40 L32,45 L28,58 L18,52 L22,40 M78,40 L68,45 L72,58 L82,52 L78,40 M50,90 L55,88 L60,94 L65,90", // Horns, wings, tail
    face: "M42,38 A4,4 0 1,1 42.01,38 M58,38 A4,4 0 1,1 58.01,38 M45,50 L50,55 L55,50 M42,55 L58,55", // Sly eyes, grin
  },
  golem: {
    // Blocky, massive, stone construct with cracks
    body: "M30,15 L70,15 L75,25 L75,55 L70,60 L70,90 L55,90 L55,62 L45,62 L45,90 L30,90 L30,60 L25,55 L25,25 Z",
    detail: "M35,30 L48,30 M52,30 L65,30 M35,40 L48,40 M52,40 L65,40 M38,50 L62,50 M22,35 L30,40 M78,35 L70,40 M45,70 L45,82 M55,70 L55,82", // Cracks, arms, leg lines
    face: "M38,22 A6,4 0 1,1 38.01,22 M62,22 A6,4 0 1,1 62.01,22", // Glowing rectangular eyes
  },
  wisp: {
    // Floating orb of light with trailing wisps of energy
    body: "M50,20 A18,18 0 1,1 50.01,20 Z",
    detail: "M50,38 Q58,50 55,65 Q52,80 48,90 M32,28 Q22,22 26,38 Q20,48 28,52 M68,28 Q78,22 74,38 Q80,48 72,52 M38,42 Q32,50 36,58 M62,42 Q68,50 64,58", // Flowing trails
    face: "M42,26 A5,5 0 1,1 42.01,26 M58,26 A5,5 0 1,1 58.01,26", // Simple glowing eyes
  },
  chimera: {
    // Lion body with multiple heads hinted, wings, snake tail
    body: "M50,18 C68,18 75,30 75,45 L75,60 L70,75 L65,90 L35,90 L30,75 L25,60 L25,45 C25,30 32,18 50,18 Z",
    detail: "M30,8 Q20,5 28,18 M70,8 Q80,5 72,18 M22,50 L28,48 M78,50 L72,48 M18,38 L25,45 L20,55 L12,48 M82,38 L75,45 L80,55 L88,48 M65,90 L72,88 L78,92 L85,88", // Mane hints, wings, snake tail
    face: "M42,32 A4,4 0 1,1 42.01,32 M58,32 A4,4 0 1,1 58.01,32 M50,42 L50,52 L46,56", // Main face
  },
  dragon: {
    // Majestic dragon with horns, wings, scales, long neck
    body: "M50,12 C70,12 80,28 80,45 L78,55 L80,65 L75,80 L60,92 L40,92 L25,80 L20,65 L22,55 L20,45 C20,28 30,12 50,12 Z",
    detail: "M18,35 L8,20 L22,40 L10,55 L25,50 M82,35 L92,20 L78,40 L90,55 L75,50 M28,10 L35,20 M72,10 L65,20 M35,75 L38,85 M65,75 L62,85 M42,55 L50,52 L58,55 M42,62 L50,60 L58,62", // Wings, horns, scales
    face: "M40,30 A5,5 0 1,1 40.01,30 M60,30 A5,5 0 1,1 60.01,30 M48,42 L50,50 L52,42 M45,55 L50,60 L55,55", // Reptilian eyes, snout, nostrils
  },
  // ============= REAL CREATURES =============
  rat: {
    // Distinct pointed snout, round ears, hunched body, long tail
    body: "M50,22 C68,20 78,35 78,50 L76,65 L68,80 L58,90 L42,90 L32,80 L24,65 L22,50 C22,35 32,20 50,22 Z",
    detail: "M32,12 Q40,5 45,18 M68,12 Q60,5 55,18 M58,90 L68,88 L78,92 L88,88 L95,92 M32,55 L26,58 M38,55 L32,60 M68,55 L74,58 M62,55 L68,60", // Round ears, long tail, whiskers
    face: "M38,38 A5,5 0 1,1 38.01,38 M62,38 A5,5 0 1,1 62.01,38 M50,48 L50,62 L44,68 M44,62 L50,62 L56,62", // Beady eyes, pointed snout
  },
  spider: {
    // Two-segment body (cephalothorax + abdomen), 8 distinct legs
    body: "M50,22 A14,12 0 1,1 50.01,22 M50,50 A18,18 0 1,1 50.01,50 Z",
    detail: "M36,26 L18,8 M32,32 L8,28 M30,40 L6,52 M34,48 L16,72 M64,26 L82,8 M68,32 L92,28 M70,40 L94,52 M66,48 L84,72", // 8 legs
    face: "M42,22 A3,3 0 1,1 42.01,22 M48,20 A2,2 0 1,1 48.01,20 M52,20 A2,2 0 1,1 52.01,20 M58,22 A3,3 0 1,1 58.01,22 M48,30 L50,35 L52,30", // Multiple eyes, fangs
  },
  bat: {
    // Round fuzzy body, huge wing membranes, big ears, tiny feet
    body: "M50,18 A12,12 0 1,1 50.01,18 M46,42 L46,52 L48,56 M54,42 L54,52 L52,56 Z",
    detail: "M38,22 L14,12 L8,28 L12,42 L22,50 L32,44 L38,32 M62,22 L86,12 L92,28 L88,42 L78,50 L68,44 L62,32 M16,18 L14,12 M20,35 L12,38 M80,35 L88,38 M84,18 L86,12", // Wing membrane with finger bones
    face: "M35,8 Q30,0 38,6 M65,8 Q70,0 62,6 M44,18 A3,4 0 1,1 44.01,18 M56,18 A3,4 0 1,1 56.01,18 M48,28 L50,32 L52,28", // Big ears, eyes, nose
  },
  snake: {
    // Sinuous S-curve body, distinct head, forked tongue
    body: "M45,10 C70,10 80,25 80,38 C80,52 65,55 55,58 C40,62 30,68 30,78 C30,88 45,92 60,90 L65,85",
    detail: "M45,58 Q50,65 48,75 M35,82 Q38,88 42,85 M55,70 Q60,76 58,82", // Body curves/scales
    face: "M38,18 A5,6 0 1,1 38.01,18 M52,18 A5,6 0 1,1 52.01,18 M45,30 L42,42 M48,30 L51,42 M40,42 L45,45 L48,45 L53,42", // Slit eyes, forked tongue
  },
  wolf: {
    // Proud canine with pointed ears, snout, fluffy chest, strong legs
    body: "M50,18 C70,16 80,32 80,48 L78,62 L72,78 L65,92 L55,92 L52,78 L48,78 L45,92 L35,92 L28,78 L22,62 L20,48 C20,32 30,16 50,18 Z",
    detail: "M28,8 L38,22 M72,8 L62,22 M35,55 L30,60 M65,55 L70,60 M22,40 L28,45 M78,40 L72,45 M38,70 L35,75 M62,70 L65,75", // Pointy ears, shoulder/leg definition
    face: "M40,38 A5,5 0 1,1 40.01,38 M60,38 A5,5 0 1,1 60.01,38 M50,48 L50,62 L42,68 L50,72 L58,68 L50,62", // Eyes, long snout with nose
  },
  beetle: {
    // Domed shell with wing line, small head, antennae, 6 legs
    body: "M50,25 C78,25 88,45 88,62 C88,82 72,92 50,92 C28,92 12,82 12,62 C12,45 22,25 50,25 Z M40,12 C45,18 55,18 60,12 L60,25 L40,25 Z",
    detail: "M50,25 L50,92 M30,45 L30,78 M70,45 L70,78 M35,12 L28,2 M65,12 L72,2 M12,55 L5,52 M12,70 L5,75 M88,55 L95,52 M88,70 L95,75", // Shell split, antennae, legs
    face: "M45,18 A3,3 0 1,1 45.01,18 M55,18 A3,3 0 1,1 55.01,18", // Small compound eyes
  },
  crow: {
    // Sleek bird with beak, wings, tail feathers
    body: "M50,15 C68,15 78,30 78,48 L75,65 L60,90 L40,90 L25,65 L22,48 C22,30 32,15 50,15 Z",
    detail: "M22,40 L8,35 L12,45 L6,55 L20,50 M78,40 L92,35 L88,45 L94,55 L80,50 M45,75 L40,88 M55,75 L60,88 M50,90 L50,96", // Wings, tail feathers
    face: "M42,30 A4,4 0 1,1 42.01,30 M58,30 A4,4 0 1,1 58.01,30 M50,38 L50,58 L35,62 L40,58", // Beady eyes, long beak
  },
  shark: {
    // Streamlined body, dorsal fin on top, tail, open jaw with teeth
    body: "M10,50 C20,35 40,32 60,32 C80,32 95,42 95,50 C95,58 80,65 60,65 L55,60 L45,60 L40,65 C30,65 15,60 10,50 Z",
    detail: "M50,18 L58,32 L42,32 Z M88,50 L98,42 L98,58 Z M30,52 L25,56 M70,52 L75,56 M55,52 L60,56 M45,52 L40,56", // Dorsal fin, tail, gills
    face: "M25,48 A5,4 0 1,1 25.01,48 M15,55 L8,50 L22,52 L15,60 L18,55", // Eye, open jaw with teeth
  },
  frog: {
    // Wide squat body, huge bulging eyes on top, webbed feet
    body: "M50,35 C82,35 90,55 90,68 C90,85 75,92 50,92 C25,92 10,85 10,68 C10,55 18,35 50,35 Z",
    detail: "M8,72 L0,82 L10,78 L4,90 L15,82 M92,72 L100,82 L90,78 L96,90 L85,82 M32,85 L28,92 L38,88 M68,85 L72,92 L62,88", // Webbed back feet, front feet
    face: "M30,22 A14,14 0 1,1 30.01,22 M70,22 A14,14 0 1,1 70.01,22 M35,22 A5,5 0 1,1 35.01,22 M65,22 A5,5 0 1,1 65.01,22 M42,58 Q50,66 58,58", // Huge bulging eyes with pupils, smile
  },
  jellyfish: {
    // Dome/bell on top, many trailing tentacles
    body: "M50,8 C85,8 92,30 92,42 C92,55 75,60 50,60 C25,60 8,55 8,42 C8,30 15,8 50,8 Z",
    detail: "M20,60 Q15,75 22,92 M32,60 Q35,78 30,96 M44,60 Q44,76 46,94 M56,60 Q56,78 54,96 M68,60 Q65,78 70,94 M80,60 Q85,75 78,92 M26,72 Q22,78 28,82 M74,72 Q78,78 72,82 M38,78 Q40,84 36,88 M62,78 Q60,84 64,88", // Many tentacles
    face: "M38,32 A5,5 0 1,1 38.01,32 M62,32 A5,5 0 1,1 62.01,32", // Simple eyes
  },
};

// Equipment visual overlays - SVG paths for equipped items
// Each slot has a visual representation that renders on top of the monster
const EQUIPMENT_VISUALS: Record<EquipmentSlot, { path: string; position: "top" | "body" | "hands" | "feet" | "back" }> =
  {
    helmet: {
      path: "M30,6 L35,2 L50,0 L65,2 L70,6 L68,14 L32,14 Z",
      position: "top",
    },
    armor: {
      path: "M35,35 L38,30 L62,30 L65,35 L68,50 L65,58 L35,58 L32,50 Z",
      position: "body",
    },
    gloves: {
      path: "M20,52 L28,48 L32,54 L26,60 Z M80,52 L72,48 L68,54 L74,60 Z",
      position: "hands",
    },
    boots: {
      path: "M36,82 L44,80 L46,90 L34,92 Z M64,82 L56,80 L54,90 L66,92 Z",
      position: "feet",
    },
    mainHand: {
      path: "M18,35 L12,25 L8,40 L14,50 L22,45 Z",
      position: "hands",
    },
    offHand: {
      path: "M82,35 L88,25 L92,40 L86,50 L78,45 Z",
      position: "hands",
    },
    accessory: {
      path: "M45,60 A6,6 0 1,1 55,60 A6,6 0 1,1 45,60",
      position: "body",
    },
    back: {
      // Cape/cloak flowing behind the monster
      path: "M35,30 Q30,45 28,70 Q50,75 72,70 Q70,45 65,30 Z",
      position: "back",
    },
  };

// Get color for equipment based on rarity
function getEquipmentColor(rarity: Rarity): string {
  const colorMap: Record<Rarity, string> = {
    common: "0 0% 60%",
    uncommon: "120 50% 45%",
    rare: "210 70% 50%",
    epic: "280 60% 55%",
    legendary: "40 90% 55%",
  };
  return colorMap[rarity];
}

// Class equipment overlays - improved with requested designs
// Kinetic: Boxing gloves, Biological: Camo pattern (clipped), Energy: Eye lasers, Chemical: Bubbles, Political: Crown
const CLASS_OVERLAYS: Record<
  ClassType,
  { weapon?: string; armor?: string; accessory?: string; camoPattern?: boolean; color: string; secondaryColor?: string }
> = {
  normal: {
    color: "0 0% 70%",
  },
  kinetic: {
    // Boxing gloves on both sides
    weapon: "M22,48 Q15,42 15,52 Q15,62 25,62 L32,55 L28,48 Z M78,48 Q85,42 85,52 Q85,62 75,62 L68,55 L72,48 Z",
    // Belt/waist band
    armor: "M38,52 L62,52 L64,58 L60,60 L40,60 L36,58 Z",
    color: "15 85% 50%", // Red-orange for fighting
    secondaryColor: "0 80% 45%",
  },
  energy: {
    // Eye laser beams shooting outward
    weapon: "M35,32 L8,25 L10,30 L35,35 M65,32 L92,25 L90,30 L65,35 M8,25 L5,22 M92,25 L95,22",
    // Glowing aura around head - larger and more visible
    accessory: "M50,2 A22,10 0 1,1 50.01,2",
    color: "280 85% 60%", // Purple energy
    secondaryColor: "300 90% 70%",
  },
  biological: {
    // Camo pattern rendered inside body via clip path - with transparent gaps
    camoPattern: true,
    color: "120 45% 32%", // Dark green base
    secondaryColor: "85 40% 42%", // Olive
  },
  chemical: {
    // Bubbles floating around - more prominent
    accessory:
      "M16,25 A6,6 0 1,1 16.01,25 M8,40 A5,5 0 1,1 8.01,40 M20,55 A4,4 0 1,1 20.01,55 M84,25 A6,6 0 1,1 84.01,25 M92,40 A5,5 0 1,1 92.01,40 M80,55 A4,4 0 1,1 80.01,55 M12,62 A3,3 0 1,1 12.01,62 M88,62 A3,3 0 1,1 88.01,62",
    color: "60 95% 50%", // Yellow-green toxic
    secondaryColor: "90 90% 55%",
  },
  political: {
    // Prominent golden crown - larger
    accessory: "M25,10 L30,0 L37,12 L44,2 L50,-4 L56,2 L63,12 L70,0 L75,10 L72,22 L28,22 Z",
    // Royal cape/mantle sides
    armor: "M20,38 Q15,55 20,75 L32,70 L32,45 Z M80,38 Q85,55 80,75 L68,70 L68,45 Z",
    color: "45 95% 55%", // Gold
    secondaryColor: "38 90% 45%",
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
  equipment?: MonsterEquipment | null; // Optional equipment to display
}

export const MonsterSprite = forwardRef<SVGSVGElement, MonsterSpriteProps>(
  ({ species, element, classType, size = 64, className = "", animated = true, equipment = null }, ref) => {
    const colors = ELEMENT_COLORS[element];
    // Check for custom sprite override, fall back to hardcoded paths
    const customPaths = getGlobalSpriteOverride(species, element);
    const paths = customPaths && customPaths.body ? customPaths : SPECIES_PATHS[species];
    const overlay = CLASS_OVERLAYS[classType];
    const classColor = overlay.color;

    const animationClass = animated ? "animate-pulse-glow" : "";
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
          {/* Camo pattern for biological class - with transparent gaps for element to show */}
          {overlay.camoPattern && (
            <pattern id={`camo-${uniqueId}`} patternUnits="userSpaceOnUse" width="25" height="25">
              {/* Transparent base lets element show through */}
              <rect width="25" height="25" fill="transparent" />
              {/* Camo blobs - scattered to let element show in gaps */}
              <ellipse cx="6" cy="6" rx="5" ry="3" fill={`hsl(${overlay.color} / 0.85)`} />
              <ellipse cx="18" cy="4" rx="4" ry="2.5" fill={`hsl(${overlay.secondaryColor} / 0.8)`} />
              <ellipse cx="12" cy="14" rx="6" ry="3.5" fill={`hsl(80 35% 28% / 0.85)`} />
              <ellipse cx="3" cy="20" rx="4" ry="2.5" fill={`hsl(${overlay.secondaryColor} / 0.75)`} />
              <ellipse cx="22" cy="18" rx="5" ry="3" fill={`hsl(${overlay.color} / 0.8)`} />
              <ellipse cx="16" cy="23" rx="3" ry="2" fill={`hsl(95 30% 25% / 0.7)`} />
            </pattern>
          )}
        </defs>

        {/* Subtle background circle - not element colored */}
        <circle cx="50" cy="50" r="45" fill="hsl(var(--muted) / 0.1)" />

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

        {/* Species detail (body details like ribs, wings, etc) - NOT clipped so they show outside body */}
        {paths.detail && (
          <path d={paths.detail} fill="none" stroke="hsl(0 0% 15%)" strokeWidth="2.5" strokeLinecap="round" />
        )}

        {/* Face features - dark and very opaque for visibility */}
        {paths.face && (
          <path d={paths.face} fill="hsl(0 0% 8%)" stroke="hsl(0 0% 5%)" strokeWidth="2.5" strokeLinecap="round" />
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

        {/* Equipped items - render on top of everything */}
        {equipment && (
          <>
            {/* Helmet */}
            {equipment.helmet && (
              <path
                d={EQUIPMENT_VISUALS.helmet.path}
                fill={`hsl(${getEquipmentColor(equipment.helmet.rarity)} / 0.85)`}
                stroke={`hsl(${getEquipmentColor(equipment.helmet.rarity)})`}
                strokeWidth="2"
                strokeLinecap="round"
              />
            )}

            {/* Armor - chest piece */}
            {equipment.armor && (
              <path
                d={EQUIPMENT_VISUALS.armor.path}
                fill={`hsl(${getEquipmentColor(equipment.armor.rarity)} / 0.75)`}
                stroke={`hsl(${getEquipmentColor(equipment.armor.rarity)})`}
                strokeWidth="2"
                strokeLinecap="round"
              />
            )}

            {/* Main hand weapon */}
            {equipment.mainHand && (
              <path
                d={EQUIPMENT_VISUALS.mainHand.path}
                fill={`hsl(${getEquipmentColor(equipment.mainHand.rarity)} / 0.9)`}
                stroke={`hsl(${getEquipmentColor(equipment.mainHand.rarity)})`}
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            )}

            {/* Off hand */}
            {equipment.offHand && (
              <path
                d={EQUIPMENT_VISUALS.offHand.path}
                fill={`hsl(${getEquipmentColor(equipment.offHand.rarity)} / 0.9)`}
                stroke={`hsl(${getEquipmentColor(equipment.offHand.rarity)})`}
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            )}

            {/* Gloves */}
            {equipment.gloves && (
              <path
                d={EQUIPMENT_VISUALS.gloves.path}
                fill={`hsl(${getEquipmentColor(equipment.gloves.rarity)} / 0.85)`}
                stroke={`hsl(${getEquipmentColor(equipment.gloves.rarity)})`}
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            )}

            {/* Boots */}
            {equipment.boots && (
              <path
                d={EQUIPMENT_VISUALS.boots.path}
                fill={`hsl(${getEquipmentColor(equipment.boots.rarity)} / 0.85)`}
                stroke={`hsl(${getEquipmentColor(equipment.boots.rarity)})`}
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            )}

            {/* Accessory - glowing ring/amulet */}
            {equipment.accessory && (
              <path
                d={EQUIPMENT_VISUALS.accessory.path}
                fill={`hsl(${getEquipmentColor(equipment.accessory.rarity)} / 0.8)`}
                stroke={`hsl(${getEquipmentColor(equipment.accessory.rarity)})`}
                strokeWidth="2"
                strokeLinecap="round"
              />
            )}
          </>
        )}
      </svg>
    );
  },
);

MonsterSprite.displayName = "MonsterSprite";

// Compact sprite for dungeon tiles
export function MonsterSpriteSmall({
  species,
  element,
  size = 24,
  className = "",
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
    <svg width={size} height={size} viewBox="0 0 100 100" className={className}>
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
      <path d={paths.body} fill="none" stroke="hsl(0 0% 10%)" strokeWidth="4" />

      {/* Dark face */}
      {paths.face && <path d={paths.face} fill="hsl(0 0% 8%)" stroke="hsl(0 0% 5%)" strokeWidth="2" />}
    </svg>
  );
}

// Get a procedurally generated name for a monster
export function generateMonsterName(species: SpeciesType, element: ElementType, classType: ClassType): string {
  const elementPrefixes: Record<ElementType, string[]> = {
    normal: ["Common", "Plain", "Basic", "Simple", "Pure"],
    fire: ["Pyro", "Blaze", "Ember", "Scorch", "Inferno"],
    water: ["Aqua", "Tide", "Torrent", "Deluge", "Surge"],
    earth: ["Terra", "Stone", "Bedrock", "Granite", "Seismic"],
    air: ["Aero", "Zephyr", "Gale", "Tempest", "Cyclone"],
    void: ["Nether", "Shadow", "Eclipse", "Null", "Abyssal"],
  };

  const classSuffixes: Record<ClassType, string[]> = {
    normal: ["Beast", "Creature", "Being", "Entity", "Form"],
    kinetic: ["Striker", "Brawler", "Warrior", "Fighter", "Champion"],
    energy: ["Caster", "Channeler", "Weaver", "Adept", "Mage"],
    biological: ["Symbiote", "Growth", "Bloom", "Organism", "Hybrid"],
    chemical: ["Alchemist", "Reactor", "Catalyst", "Compound", "Venom"],
    political: ["Diplomat", "Sovereign", "Regent", "Noble", "Envoy"],
  };

  // Use species name as a seed for consistency
  const speciesIndex = species.charCodeAt(0) % 5;
  const elementPrefix = elementPrefixes[element][speciesIndex];
  const classSuffix = classSuffixes[classType][(speciesIndex + 2) % 5];

  return `${elementPrefix} ${classSuffix}`;
}
