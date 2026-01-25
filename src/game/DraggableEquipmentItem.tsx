// Draggable Equipment Item Component

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { EquipmentItem, EquipmentSlot, SLOT_INFO, RARITY_COLORS, EQUIPMENT_SETS, SetId } from './equipment';
import { EquipmentIcon } from './EquipmentIcon';
import { SetBadge } from './SetBonusDisplay';
import { GripVertical, Layers } from 'lucide-react';

export interface DragData {
  item: EquipmentItem;
  sourceType: 'inventory' | 'equipped';
  sourceSlot?: EquipmentSlot;
}

interface DraggableEquipmentItemProps {
  item: EquipmentItem;
  onEquip: () => void;
  onDrop: () => void;
  currentLevel: number;
  isDragging?: boolean;
  onDragStart?: (data: DragData) => void;
  onDragEnd?: () => void;
  showLayerControl?: boolean;
  layer?: number;
  onLayerChange?: (layer: number) => void;
}

export function DraggableEquipmentItem({ 
  item, 
  onEquip, 
  onDrop, 
  currentLevel,
  isDragging = false,
  onDragStart,
  onDragEnd,
  showLayerControl = false,
  layer = 1,
  onLayerChange,
}: DraggableEquipmentItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const rarityStyle = RARITY_COLORS[item.rarity];
  const canEquip = currentLevel >= item.level;
  
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify({ itemId: item.id }));
    onDragStart?.({ item, sourceType: 'inventory' });
  };
  
  return (
    <div 
      className={`
        p-3 rounded-lg border transition-all
        ${rarityStyle.bg} ${rarityStyle.border}
        ${isDragging ? 'opacity-50 scale-95' : 'hover:scale-[1.02]'}
        ${canEquip ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed opacity-70'}
      `}
      draggable={canEquip}
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start gap-2">
        {/* Drag handle */}
        <div className="flex flex-col items-center gap-1">
          <GripVertical className="w-4 h-4 text-muted-foreground/50" />
          <EquipmentIcon item={item} size={36} showStatPreview />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className={`font-semibold text-sm truncate ${rarityStyle.text}`}>
              {item.name}
            </p>
            {item.setId && <SetBadge setId={item.setId as SetId} size="sm" />}
          </div>
          <p className="text-xs text-muted-foreground capitalize">
            {SLOT_INFO[item.slot].label} • Lv.{item.level}
          </p>
          <div className="flex flex-wrap gap-1 mt-1">
            {Object.entries(item.stats).map(([stat, value]) => (
              value !== 0 && (
                <span 
                  key={stat} 
                  className={`text-[10px] px-1 rounded ${value > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}
                >
                  {value > 0 ? '+' : ''}{value} {stat.replace('max', '').slice(0, 3).toUpperCase()}
                </span>
              )
            ))}
          </div>
        </div>
        
        {/* Layer control (for visual customization) */}
        {showLayerControl && onLayerChange && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onLayerChange(layer >= 3 ? 1 : layer + 1);
                  }}
                >
                  <Layers className="w-3 h-3" />
                  <span className="text-[8px] ml-0.5">{layer}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p className="text-xs">Layer: {layer}/3</p>
                <p className="text-[10px] text-muted-foreground">Click to change render order</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      
      <div className="flex gap-2 mt-2">
        <Button 
          size="sm" 
          className="flex-1 h-7 text-xs"
          disabled={!canEquip}
          onClick={onEquip}
        >
          {canEquip ? 'Equip' : `Req. Lv.${item.level}`}
        </Button>
        <Button 
          size="sm" 
          variant="destructive" 
          className="h-7 text-xs px-2"
          onClick={onDrop}
        >
          Drop
        </Button>
      </div>
    </div>
  );
}

// Compact version for equipped slots
interface EquippedSlotDisplayProps {
  slot: EquipmentSlot;
  item: EquipmentItem | null;
  isSelected: boolean;
  onSelect: () => void;
  onDrop?: () => void;
  onDragOver?: () => void;
  isDragOver?: boolean;
}

export function EquippedSlotDisplay({ 
  slot, 
  item, 
  isSelected, 
  onSelect,
  onDrop,
  onDragOver,
  isDragOver = false,
}: EquippedSlotDisplayProps) {
  const info = SLOT_INFO[slot];
  const rarityStyle = item ? RARITY_COLORS[item.rarity] : null;
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    onDragOver?.();
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    onDrop?.();
  };
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onSelect}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`
              w-14 h-14 rounded-lg border-2 flex items-center justify-center
              transition-all hover:scale-105 active:scale-95
              ${isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}
              ${isDragOver ? 'ring-2 ring-accent scale-110 bg-accent/20' : ''}
              ${item 
                ? `${rarityStyle?.bg} ${rarityStyle?.border} ${rarityStyle?.glow ? `shadow-lg ${rarityStyle.glow}` : ''}` 
                : 'bg-muted/50 border-dashed border-muted-foreground/30'
              }
            `}
          >
            {item ? (
              <EquipmentIcon item={item} size={40} showStatPreview={false} />
            ) : (
              <span className="text-2xl opacity-40">{info.icon}</span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-[200px]">
          {item ? (
            <div className="space-y-1">
              <p className={`font-semibold ${rarityStyle?.text}`}>{item.name}</p>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground capitalize">{item.rarity} {info.label}</span>
                {item.setId && <SetBadge setId={item.setId as SetId} size="sm" />}
              </div>
              <div className="text-xs space-y-0.5">
                {Object.entries(item.stats).map(([stat, value]) => (
                  value !== 0 && (
                    <p key={stat} className={value > 0 ? 'text-green-400' : 'text-red-400'}>
                      {value > 0 ? '+' : ''}{value} {stat.replace('max', '').toUpperCase()}
                    </p>
                  )
                ))}
              </div>
              {item.element && (
                <p className="text-xs text-primary">⚡ {item.element} element</p>
              )}
              {item.setId && (
                <p className="text-xs text-amber-400 italic">
                  Part of {EQUIPMENT_SETS[item.setId as SetId]?.name} set
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Empty {info.label} slot<br/><span className="text-xs">Drag item here</span></p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
