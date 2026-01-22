// Move Panel with drag-and-drop reordering and hide/unhide functionality

import { useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, GripVertical, Eye, EyeOff } from 'lucide-react';
import { Move } from './moves';
import { Monster } from './types';
import { ExpandedStats } from './CharacterSheet';

interface MovePanelProps {
  moves: Move[];
  monster: Monster;
  expandedStats?: ExpandedStats;
  moveOrder: string[];
  hiddenMoves: string[];
  onReorder: (newOrder: string[]) => void;
  onToggleHide: (moveId: string) => void;
}

export function MovePanel({ 
  moves, 
  monster, 
  expandedStats, 
  moveOrder, 
  hiddenMoves, 
  onReorder, 
  onToggleHide 
}: MovePanelProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverSection, setDragOverSection] = useState<'visible' | 'hidden' | null>(null);
  
  // Sort moves by order, putting unordered moves at the end
  const sortedMoves = [...moves].sort((a, b) => {
    const aIndex = moveOrder.indexOf(a.id);
    const bIndex = moveOrder.indexOf(b.id);
    if (aIndex === -1 && bIndex === -1) return 0;
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });
  
  const visibleMoves = sortedMoves.filter(m => !hiddenMoves.includes(m.id));
  const hiddenMovesList = sortedMoves.filter(m => hiddenMoves.includes(m.id));
  
  const handleDragStart = (e: React.DragEvent, moveId: string) => {
    setDraggedId(moveId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', moveId);
  };
  
  const handleDragOver = (e: React.DragEvent, moveId: string, section: 'visible' | 'hidden') => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(moveId);
    setDragOverSection(section);
  };
  
  const handleDragLeave = () => {
    setDragOverId(null);
    setDragOverSection(null);
  };
  
  const handleDrop = (e: React.DragEvent, targetId: string, targetSection: 'visible' | 'hidden') => {
    e.preventDefault();
    const sourceId = draggedId;
    if (!sourceId || sourceId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      setDragOverSection(null);
      return;
    }
    
    const sourceIsHidden = hiddenMoves.includes(sourceId);
    const targetIsHidden = targetSection === 'hidden';
    
    // If moving between sections, toggle hide state
    if (sourceIsHidden !== targetIsHidden) {
      onToggleHide(sourceId);
    }
    
    // Reorder within the full list
    const currentOrder = moveOrder.length > 0 ? [...moveOrder] : moves.map(m => m.id);
    const sourceIndex = currentOrder.indexOf(sourceId);
    const targetIndex = currentOrder.indexOf(targetId);
    
    if (sourceIndex !== -1) {
      currentOrder.splice(sourceIndex, 1);
    }
    
    const newTargetIndex = currentOrder.indexOf(targetId);
    if (newTargetIndex !== -1) {
      currentOrder.splice(newTargetIndex, 0, sourceId);
    } else {
      currentOrder.push(sourceId);
    }
    
    onReorder(currentOrder);
    setDraggedId(null);
    setDragOverId(null);
    setDragOverSection(null);
  };
  
  const handleDropOnSection = (e: React.DragEvent, section: 'visible' | 'hidden') => {
    e.preventDefault();
    const sourceId = draggedId;
    if (!sourceId) return;
    
    const sourceIsHidden = hiddenMoves.includes(sourceId);
    const targetIsHidden = section === 'hidden';
    
    // Toggle hide state if moving between sections
    if (sourceIsHidden !== targetIsHidden) {
      onToggleHide(sourceId);
    }
    
    setDraggedId(null);
    setDragOverId(null);
    setDragOverSection(null);
  };
  
  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
    setDragOverSection(null);
  };

  return (
    <div className="space-y-3">
      {/* Visible Moves */}
      <div 
        className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 min-h-[60px] p-1 rounded-lg transition-colors ${
          dragOverSection === 'visible' && dragOverId === null ? 'bg-primary/10 ring-2 ring-primary/30' : ''
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOverSection('visible'); }}
        onDragLeave={() => setDragOverSection(null)}
        onDrop={(e) => handleDropOnSection(e, 'visible')}
      >
        {visibleMoves.map(move => (
          <DraggableMoveCard
            key={move.id}
            move={move}
            monster={monster}
            expandedStats={expandedStats}
            isDragging={draggedId === move.id}
            isDragOver={dragOverId === move.id}
            onDragStart={(e) => handleDragStart(e, move.id)}
            onDragOver={(e) => handleDragOver(e, move.id, 'visible')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, move.id, 'visible')}
            onDragEnd={handleDragEnd}
            onToggleHide={() => onToggleHide(move.id)}
            isHidden={false}
          />
        ))}
        {visibleMoves.length === 0 && (
          <div className="col-span-full text-center py-4 text-muted-foreground text-xs">
            Drag moves here to show them
          </div>
        )}
      </div>
      
      {/* Hidden Moves (More Section) */}
      <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
        <CollapsibleTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full justify-between text-muted-foreground hover:text-foreground"
          >
            <span className="flex items-center gap-1">
              <EyeOff className="w-3 h-3" />
              More ({hiddenMovesList.length})
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div 
            className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mt-2 min-h-[40px] p-1 rounded-lg border border-dashed border-border/50 transition-colors ${
              dragOverSection === 'hidden' && dragOverId === null ? 'bg-muted/50 ring-2 ring-muted-foreground/30' : ''
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOverSection('hidden'); }}
            onDragLeave={() => setDragOverSection(null)}
            onDrop={(e) => handleDropOnSection(e, 'hidden')}
          >
            {hiddenMovesList.map(move => (
              <DraggableMoveCard
                key={move.id}
                move={move}
                monster={monster}
                expandedStats={expandedStats}
                isDragging={draggedId === move.id}
                isDragOver={dragOverId === move.id}
                onDragStart={(e) => handleDragStart(e, move.id)}
                onDragOver={(e) => handleDragOver(e, move.id, 'hidden')}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, move.id, 'hidden')}
                onDragEnd={handleDragEnd}
                onToggleHide={() => onToggleHide(move.id)}
                isHidden={true}
              />
            ))}
            {hiddenMovesList.length === 0 && (
              <div className="col-span-full text-center py-2 text-muted-foreground text-[10px]">
                Drag moves here to hide them
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

interface DraggableMoveCardProps {
  move: Move;
  monster: Monster;
  expandedStats?: ExpandedStats;
  isDragging: boolean;
  isDragOver: boolean;
  isHidden: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onToggleHide: () => void;
}

function DraggableMoveCard({
  move,
  monster,
  expandedStats,
  isDragging,
  isDragOver,
  isHidden,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onToggleHide,
}: DraggableMoveCardProps) {
  const typeColors: Record<Move['type'], string> = {
    melee: 'bg-orange-500/20 text-orange-600',
    ranged: 'bg-blue-500/20 text-blue-600',
    status: 'bg-purple-500/20 text-purple-600',
    heal: 'bg-green-500/20 text-green-600',
  };
  
  const attackStat = move.type === 'melee' 
    ? (expandedStats?.melee ?? monster.stats.attack) 
    : move.type === 'ranged' 
      ? (expandedStats?.ranged ?? monster.stats.special) 
      : 0;

  return (
    <Card 
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`p-2 cursor-grab active:cursor-grabbing transition-all ${
        isDragging ? 'opacity-50 scale-95' : ''
      } ${
        isDragOver ? 'ring-2 ring-primary bg-primary/10' : ''
      } ${
        isHidden ? 'opacity-70' : ''
      }`}
    >
      <div className="flex items-start gap-1">
        <GripVertical className="w-3 h-3 text-muted-foreground/50 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-semibold text-[11px] truncate">{move.name}</h4>
            <div className="flex items-center gap-1">
              <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${typeColors[move.type]}`}>
                {move.type}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="w-4 h-4 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleHide();
                }}
                title={isHidden ? "Show move" : "Hide move"}
              >
                {isHidden ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5" />}
              </Button>
            </div>
          </div>
          
          <p className="text-[9px] text-muted-foreground line-clamp-1 mb-1">{move.description}</p>
          
          <div className="flex flex-wrap gap-1.5 text-[9px]">
            {move.power > 0 && (
              <span>
                ⚔️{move.power}
                {attackStat > 0 && <span className="text-muted-foreground">+{Math.floor(attackStat / 2)}</span>}
              </span>
            )}
            <span>🎯{move.accuracy}%</span>
            <span>⚡{move.staminaCost}</span>
          </div>
          
          {move.effect && (
            <div className="mt-0.5 text-[8px] text-accent truncate">
              ✨ {move.effect.replace(/_/g, ' ')}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}