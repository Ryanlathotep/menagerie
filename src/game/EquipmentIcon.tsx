// Equipment SVG Icon Component - Renders simple silhouette icons for equipment

import React from 'react';
import { EquipmentItem, RARITY_COLORS, Rarity, EQUIPMENT_SETS, SetId } from './equipment';
import { getEquipmentIcon, getPrimaryStat, STAT_COLORS } from './equipmentUtils';

interface EquipmentIconProps {
  item: EquipmentItem;
  size?: number;
  showStatPreview?: boolean;
  className?: string;
}

// Rarity color mapping to HSL for SVG fills
const RARITY_HSL: Record<Rarity, string> = {
  common: '0 0% 60%',
  uncommon: '120 50% 45%',
  rare: '210 70% 55%',
  epic: '280 60% 55%',
  legendary: '40 90% 55%',
};

const RARITY_GLOW: Record<Rarity, string> = {
  common: '',
  uncommon: 'drop-shadow(0 0 3px hsl(120 50% 45% / 0.5))',
  rare: 'drop-shadow(0 0 4px hsl(210 70% 55% / 0.6))',
  epic: 'drop-shadow(0 0 5px hsl(280 60% 55% / 0.7))',
  legendary: 'drop-shadow(0 0 6px hsl(40 90% 55% / 0.8)) drop-shadow(0 0 2px hsl(40 100% 70% / 0.5))',
};

export function EquipmentIcon({ item, size = 40, showStatPreview = true, className = '' }: EquipmentIconProps) {
  const iconDef = getEquipmentIcon(item.name);
  const primaryStat = showStatPreview ? getPrimaryStat(item) : null;
  
  // Use set color if item is part of a set, otherwise use rarity color
  const setInfo = item.setId ? EQUIPMENT_SETS[item.setId as SetId] : null;
  const fillColor = setInfo 
    ? `hsl(${setInfo.color})`
    : `hsl(${RARITY_HSL[item.rarity]})`;
  
  // Enhanced glow for set items
  const glowFilter = setInfo 
    ? `drop-shadow(0 0 4px hsl(${setInfo.color} / 0.6)) drop-shadow(0 0 2px hsl(${setInfo.color} / 0.4))`
    : RARITY_GLOW[item.rarity];
  
  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg 
        width={size} 
        height={size} 
        viewBox={iconDef.viewBox}
        style={{ filter: glowFilter }}
        className="transition-transform"
      >
        {/* Background circle for contrast */}
        <circle 
          cx="50" 
          cy="50" 
          r="48" 
          fill="hsl(var(--muted) / 0.3)"
          stroke="hsl(var(--border))"
          strokeWidth="1"
        />
        
        {/* Equipment silhouette */}
        <path 
          d={iconDef.path}
          fill={fillColor}
          stroke="hsl(var(--foreground) / 0.8)"
          strokeWidth={iconDef.strokeWidth || 1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      
      {/* Bound indicator - shows item is protected */}
      {item.bound && (
        <div 
          className="absolute -top-1 -left-1 text-[8px] bg-blue-500/90 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center border border-blue-300"
          title="Bound - returns to town on death"
        >
          🔒
        </div>
      )}
      
      {/* Stat preview badge */}
      {primaryStat && (
        <div 
          className={`absolute -bottom-1 -right-1 text-[9px] font-bold px-1 rounded-sm bg-background/90 border border-border ${STAT_COLORS[primaryStat.stat]}`}
        >
          +{primaryStat.value}
        </div>
      )}
    </div>
  );
}

// Slot icon component - shows empty slot placeholder
interface SlotIconProps {
  slot: string;
  size?: number;
  className?: string;
}

const SLOT_PATHS: Record<string, string> = {
  helmet: 'M50,15 Q20,15 15,40 L15,55 L25,58 L25,48 Q30,35 50,30 Q70,35 75,48 L75,58 L85,55 L85,40 Q80,15 50,15 Z',
  armor: 'M50,15 L28,22 L22,45 L25,70 L40,70 L42,50 L50,45 L58,50 L60,70 L75,70 L78,45 L72,22 Z',
  gloves: 'M28,55 L22,20 L34,16 L38,35 L44,10 L54,12 L50,40 L58,15 L68,22 L56,50 L28,55 Z',
  boots: 'M22,55 L18,20 L35,15 L40,38 L60,38 L65,15 L82,20 L78,55 L22,55 Z',
  mainHand: 'M50,10 L56,45 L62,48 L56,52 L52,85 L50,90 L48,85 L44,52 L38,48 L44,45 Z',
  offHand: 'M50,10 Q85,20 85,50 Q85,85 50,95 Q15,85 15,50 Q15,20 50,10 Z',
  accessory: 'M50,20 A30,30 0 1,1 50,80 A30,30 0 1,1 50,20 M50,30 A20,20 0 1,1 50,70 A20,20 0 1,1 50,30',
  back: 'M50,10 L25,22 Q12,50 20,85 Q35,95 50,98 Q65,95 80,85 Q88,50 75,22 Z',
};

export function SlotIcon({ slot, size = 40, className = '' }: SlotIconProps) {
  const path = SLOT_PATHS[slot] || SLOT_PATHS.accessory;
  
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100"
      className={className}
    >
      <path 
        d={path}
        fill="none"
        stroke="hsl(var(--muted-foreground) / 0.4)"
        strokeWidth="2"
        strokeDasharray="4 3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
