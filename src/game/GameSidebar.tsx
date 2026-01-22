// Game Sidebar - Always visible menu with panels

import { useState, forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

import { User, Backpack, Map, DoorOpen, Swords, Shield, Wind, Target, Footprints, Trash2 } from 'lucide-react';
import { Monster, InventoryItem } from './types';
import { MonsterSprite } from './sprites';
import { getMonsterMoves, Move } from './moves';
import { ExpandedStats } from './CharacterSheet';
import { ITEMS } from './Inventory';

// Helper functions to get item info when not in ITEMS database
function getItemDescription(item: InventoryItem): string {
  if (item.effect === 'heal_hp') return `Restores ${item.value} HP`;
  if (item.effect === 'heal_stamina') return `Restores ${item.value} Stamina`;
  if (item.effect === 'cure_poison') return 'Cures poison';
  if (item.effect === 'cure_burn') return 'Cures burn';
  if (item.effect === 'cure_freeze') return 'Cures freeze';
  if (item.effect === 'cure_all') return 'Cures all status effects';
  return item.name;
}

function getItemIcon(item: InventoryItem): string {
  if (item.type === 'potion') return '🧪';
  if (item.type === 'equipment') return '⚔️';
  if (item.type === 'gold') return '💰';
  return '📦';
}
interface GameSidebarProps {
  monster: Monster | null;
  gold: number;
  floor: number;
  inventory?: InventoryItem[];
  onFlee?: () => void;
  onDropItem?: (itemId: string) => void;
  inBattle?: boolean;
  experience?: number;
  experienceToNext?: number;
  expandedStats?: ExpandedStats;
  onPanelChange?: (isOpen: boolean) => void;
}
export const GameSidebar = forwardRef<HTMLDivElement, GameSidebarProps>(({
  monster,
  gold,
  floor,
  inventory = [],
  onFlee,
  onDropItem,
  inBattle = false,
  experience = 0,
  experienceToNext = 100,
  expandedStats,
  onPanelChange
}, ref) => {
  const [activePanel, setActivePanel] = useState<'character' | 'inventory' | 'moves' | null>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  
  const handlePanelChange = (panel: typeof activePanel) => {
    const newPanel = activePanel === panel ? null : panel;
    setActivePanel(newPanel);
    onPanelChange?.(newPanel !== null);
  };
  
  if (!monster) return null;
  const moves = getMonsterMoves(monster.species, monster.element, monster.class);

  // Use expanded stats if provided, otherwise fall back to basic stats
  const currentHp = expandedStats?.currentHp ?? monster.stats.currentHp;
  const maxHp = expandedStats?.maxHp ?? monster.stats.maxHp;
  const currentStamina = expandedStats?.currentStamina ?? monster.stats.special;
  const maxStamina = expandedStats?.stamina ?? monster.stats.special;
  const hpPercent = currentHp / maxHp * 100;
  const staminaPercent = currentStamina / maxStamina * 100;
  const xpPercent = experience / experienceToNext * 100;
  return <>
      {/* Always visible bottom bar */}
      <div ref={ref} className="fixed bottom-0 left-0 right-0 h-16 bg-card border-t-2 border-primary/20 flex items-center px-4 gap-4 z-50 shadow-lg">
        {/* Monster portrait */}
        <div className="relative flex-shrink-0">
          <MonsterSprite species={monster.species} element={monster.element} classType={monster.class} size={48} animated={false} />
          {/* HP indicator ring */}
          <div className="absolute inset-0 rounded-full border-2 border-transparent" style={{
          background: `conic-gradient(hsl(var(--stat-hp)) ${hpPercent}%, transparent ${hpPercent}%)`,
          mask: 'radial-gradient(transparent 55%, black 56%)',
          WebkitMask: 'radial-gradient(transparent 55%, black 56%)'
        }} />
        </div>
        
        {/* Level badge and stamina */}
        <div className="flex flex-col gap-1">
          <div className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full text-center">
            Lv.{monster.level}
          </div>
          <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden" title={`Stamina: ${currentStamina}/${maxStamina}`}>
            <div className="h-full bg-stat-special transition-all" style={{
            width: `${staminaPercent}%`
          }} />
          </div>
        </div>
        
        {/* Menu buttons */}
        <div className="flex gap-2">
          <Button variant={activePanel === 'character' ? 'default' : 'ghost'} size="icon" className="w-10 h-10" onClick={() => handlePanelChange('character')} title="Character Sheet">
            <User className="w-5 h-5" />
          </Button>
          
          <Button variant={activePanel === 'moves' ? 'default' : 'ghost'} size="icon" className="w-10 h-10" onClick={() => handlePanelChange('moves')} title="Moves">
            <Swords className="w-5 h-5" />
          </Button>
          
          <Button variant={activePanel === 'inventory' ? 'default' : 'ghost'} size="icon" className="w-10 h-10" onClick={() => handlePanelChange('inventory')} title="Inventory">
            <Backpack className="w-5 h-5" />
          </Button>
        </div>
        
        {/* Floor and gold */}
        <div className="flex items-center gap-3 text-xs ml-auto">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Map className="w-3 h-3" />
            <span>F{floor}</span>
          </div>
          <div className="text-primary font-bold">💰{gold}</div>
        </div>
        
        {/* Flee button */}
        {onFlee && !inBattle && <Button variant="destructive" size="icon" className="w-10 h-10" onClick={onFlee} title="Flee from dungeon">
            <DoorOpen className="w-5 h-5" />
          </Button>}
      </div>
      
      {/* Compact slide-up panels */}
      {activePanel && <div className="fixed bottom-16 left-0 right-0 bg-card border-t-2 border-primary/20 shadow-xl z-40 animate-fade-in">
          <div className="p-3">
            {/* Panel header */}
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-primary">
                {activePanel === 'character' && '📋 Character'}
                {activePanel === 'moves' && '⚔️ Moves'}
                {activePanel === 'inventory' && '🎒 Inventory'}
              </h2>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handlePanelChange(null)}>✕</Button>
            </div>
            
            {/* Character Panel - Compact Grid */}
            {activePanel === 'character' && <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {/* Monster Identity */}
                <div className="bg-muted/30 rounded-lg p-2 flex items-center gap-2">
                  <MonsterSprite species={monster.species} element={monster.element} classType={monster.class} size={40} />
                  <div className="min-w-0">
                    <p className="font-bold text-xs truncate">{monster.name}</p>
                    <div className="flex gap-1 flex-wrap">
                      <span className={`element-badge element-${monster.element} text-[8px] px-1 py-0`}>{monster.element}</span>
                      <span className="text-[8px] px-1 py-0 rounded-full bg-muted">{monster.class}</span>
                    </div>
                  </div>
                </div>
                
                {/* Bars */}
                <div className="bg-muted/30 rounded-lg p-2 space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span>HP</span>
                    <span className="font-mono">{currentHp}/{maxHp}</span>
                  </div>
                  <Progress value={hpPercent} className="h-1.5" />
                  <div className="flex justify-between text-[10px]">
                    <span>STA</span>
                    <span className="font-mono">{currentStamina}/{maxStamina}</span>
                  </div>
                  <Progress value={staminaPercent} className="h-1.5 [&>div]:bg-stat-special" />
                  <div className="flex justify-between text-[10px]">
                    <span>XP</span>
                    <span className="font-mono">{experience}/{experienceToNext}</span>
                  </div>
                  <Progress value={xpPercent} className="h-1.5 [&>div]:bg-secondary" />
                </div>
                
                {/* Attack Stats */}
                <div className="bg-muted/30 rounded-lg p-2">
                  <p className="text-[9px] text-muted-foreground uppercase mb-1">Attack</p>
                  <div className="grid grid-cols-2 gap-x-2 text-[10px]">
                    <span className="flex items-center gap-1"><Swords className="w-3 h-3 text-orange-500" /> Melee</span>
                    <span className="font-mono font-bold text-right">{expandedStats?.melee ?? monster.stats.attack}</span>
                    <span className="flex items-center gap-1"><Target className="w-3 h-3 text-yellow-500" /> Ranged</span>
                    <span className="font-mono font-bold text-right">{expandedStats?.ranged ?? monster.stats.special}</span>
                  </div>
                </div>
                
                {/* Defense & Speed Stats */}
                <div className="bg-muted/30 rounded-lg p-2">
                  <p className="text-[9px] text-muted-foreground uppercase mb-1">Defense / Speed</p>
                  <div className="grid grid-cols-2 gap-x-2 text-[10px]">
                    <span className="flex items-center gap-1"><Shield className="w-3 h-3 text-stat-defense" /> Def</span>
                    <span className="font-mono font-bold text-right">{expandedStats?.defense ?? monster.stats.defense}</span>
                    <span className="flex items-center gap-1"><Footprints className="w-3 h-3 text-emerald-500" /> Dodge</span>
                    <span className="font-mono font-bold text-right">{expandedStats?.dodge ?? Math.floor(monster.stats.speed * 0.5)}</span>
                    <span className="flex items-center gap-1"><Wind className="w-3 h-3 text-stat-speed" /> Spd</span>
                    <span className="font-mono font-bold text-right">{expandedStats?.speed ?? monster.stats.speed}</span>
                  </div>
                </div>
              </div>}
            
            {/* Moves Panel - Compact Grid */}
            {activePanel === 'moves' && <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {moves.map(move => <CompactMoveCard key={move.id} move={move} monster={monster} expandedStats={expandedStats} />)}
              </div>}
            
            {/* Inventory Panel */}
            {activePanel === 'inventory' && (
              inventory.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <Backpack className="w-8 h-8 mx-auto mb-1 opacity-30" />
                  <p className="text-xs">Inventory empty</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {inventory.map(item => {
                    const itemData = ITEMS[item.id];
                    const description = itemData?.description || getItemDescription(item);
                    const icon = itemData?.icon || getItemIcon(item);
                    const isSelected = selectedItem?.id === item.id;
                    
                    return (
                      <Card 
                        key={item.id} 
                        className={`p-2 cursor-pointer transition-all ${isSelected ? 'ring-2 ring-primary bg-primary/10' : 'hover:bg-muted/50'}`}
                        onClick={() => setSelectedItem(isSelected ? null : item)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <span className="font-semibold text-xs truncate">{item.name}</span>
                              {item.quantity > 1 && (
                                <span className="text-[10px] text-muted-foreground">x{item.quantity}</span>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground line-clamp-1">{description}</p>
                          </div>
                          {onDropItem && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-6 h-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDropItem(item.id);
                              }}
                              title="Drop item"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                        
                        {/* Expanded details when selected */}
                        {isSelected && (
                          <div className="mt-2 pt-2 border-t border-border/50">
                            <p className="text-[10px] text-muted-foreground">{description}</p>
                            {item.effect && (
                              <p className="text-[10px] text-accent mt-1">
                                ✨ Effect: {item.effect.replace(/_/g, ' ')}
                                {item.value > 0 && ` (+${item.value})`}
                              </p>
                            )}
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )
            )}
          </div>
        </div>}
    </>;
});
GameSidebar.displayName = 'GameSidebar';

interface CompactMoveCardProps {
  move: Move;
  monster: Monster;
  expandedStats?: ExpandedStats;
}

function CompactMoveCard({ move, monster, expandedStats }: CompactMoveCardProps) {
  const typeColors: Record<Move['type'], string> = {
    melee: 'bg-orange-500/20 text-orange-600',
    ranged: 'bg-blue-500/20 text-blue-600',
    status: 'bg-purple-500/20 text-purple-600',
    heal: 'bg-green-500/20 text-green-600'
  };
  
  const attackStat = move.type === 'melee' 
    ? (expandedStats?.melee ?? monster.stats.attack) 
    : move.type === 'ranged' 
      ? (expandedStats?.ranged ?? monster.stats.special) 
      : 0;

  return (
    <Card className="p-2">
      <div className="flex items-center justify-between mb-1">
        <h4 className="font-semibold text-[11px] truncate">{move.name}</h4>
        <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${typeColors[move.type]}`}>
          {move.type}
        </span>
      </div>
      
      <p className="text-[9px] text-muted-foreground line-clamp-1 mb-1">{move.description}</p>
      
      <div className="flex flex-wrap gap-1.5 text-[9px]">
        {move.power > 0 && <span>⚔️{move.power}{attackStat > 0 && <span className="text-muted-foreground">+{Math.floor(attackStat / 2)}</span>}</span>}
        <span>🎯{move.accuracy}%</span>
        <span>⚡{move.staminaCost}</span>
      </div>
      
      {move.effect && <div className="mt-0.5 text-[8px] text-accent truncate">
        ✨ {move.effect.replace(/_/g, ' ')}
      </div>}
    </Card>
  );
}