// Equipment Placement Template Overlay
// Color-coded zones showing where equipment should be positioned

import React from 'react';
import { EquipmentSlot } from '@/game/equipment';
import { EQUIPMENT_PLACEMENT_ZONES, SVG_VIEWBOX_SIZE } from './types';

interface EquipmentTemplateProps {
  visible: boolean;
  size: number; // Canvas size in pixels
  zoom: number;
  activeSlots?: EquipmentSlot[]; // Which slots to highlight
}

export function EquipmentPlacementTemplate({ 
  visible, 
  size, 
  zoom,
  activeSlots 
}: EquipmentTemplateProps) {
  if (!visible) return null;
  
  const canvasSize = size * zoom;
  const scale = canvasSize / SVG_VIEWBOX_SIZE;
  
  // Slots to show - either specific ones or all
  const slots = activeSlots || (Object.keys(EQUIPMENT_PLACEMENT_ZONES) as EquipmentSlot[]);
  
  return (
    <div 
      className="absolute inset-0 pointer-events-none"
      style={{ width: canvasSize, height: canvasSize }}
    >
      <svg 
        width={canvasSize} 
        height={canvasSize} 
        viewBox={`0 0 ${SVG_VIEWBOX_SIZE} ${SVG_VIEWBOX_SIZE}`}
        className="absolute inset-0"
      >
        {slots.map((slot) => {
          const zone = EQUIPMENT_PLACEMENT_ZONES[slot];
          const { x1, y1, x2, y2 } = zone.bounds;
          const width = x2 - x1;
          const height = y2 - y1;
          
          return (
            <g key={slot}>
              {/* Zone rectangle with dashed border */}
              <rect
                x={x1}
                y={y1}
                width={width}
                height={height}
                fill={zone.color}
                fillOpacity={0.15}
                stroke={zone.color}
                strokeWidth={1.5}
                strokeDasharray="4 2"
              />
              
              {/* Label */}
              <text
                x={x1 + width / 2}
                y={y1 + height / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={zone.color}
                fontSize={6}
                fontWeight="bold"
                style={{ textShadow: '0 0 2px rgba(0,0,0,0.8)' }}
              >
                {slot.toUpperCase()}
              </text>
            </g>
          );
        })}
        
        {/* Center crosshair for alignment */}
        <line x1="50" y1="0" x2="50" y2="100" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" strokeDasharray="2 2" />
        <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" strokeDasharray="2 2" />
      </svg>
    </div>
  );
}

// Legend component for the template colors
export function EquipmentTemplateLegend() {
  const slots = Object.entries(EQUIPMENT_PLACEMENT_ZONES) as [EquipmentSlot, typeof EQUIPMENT_PLACEMENT_ZONES[EquipmentSlot]][];
  
  return (
    <div className="grid grid-cols-2 gap-1 text-xs">
      {slots.map(([slot, zone]) => (
        <div key={slot} className="flex items-center gap-1">
          <div 
            className="w-3 h-3 rounded border"
            style={{ backgroundColor: zone.color, opacity: 0.6 }}
          />
          <span className="truncate">{zone.label}</span>
        </div>
      ))}
    </div>
  );
}
