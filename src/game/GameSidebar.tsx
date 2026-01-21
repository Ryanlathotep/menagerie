// Game Sidebar - Always visible menu with panels

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { User, Backpack, Map, DoorOpen, Swords, Heart, Zap, Shield, Wind, Target, Footprints } from 'lucide-react';
import { Monster, SPECIES_DATA } from './types';
import { MonsterSprite } from './sprites';
import { getMonsterMoves, getAspectBadges, Move } from './moves';
import { ExpandedStats } from './CharacterSheet';

interface GameSidebarProps {
  monster: Monster | null;
  gold: number;
  floor: number;
  onFlee?: () => void;
  inBattle?: boolean;
  experience?: number;
  experienceToNext?: number;
  expandedStats?: ExpandedStats;
}

export function GameSidebar({ 
  monster, 
  gold, 
  floor, 
  onFlee, 
  inBattle = false,
  experience = 0,
  experienceToNext = 100,
  expandedStats,
}: GameSidebarProps) {
  const [activePanel, setActivePanel] = useState<'character' | 'inventory' | 'moves' | null>(null);
  
  if (!monster) return null;
  
  const moves = getMonsterMoves(monster.species, monster.element, monster.class);
  const speciesData = SPECIES_DATA[monster.species];
  
  // Use expanded stats if provided, otherwise fall back to basic stats
  const currentHp = expandedStats?.currentHp ?? monster.stats.currentHp;
  const maxHp = expandedStats?.maxHp ?? monster.stats.maxHp;
  const currentStamina = expandedStats?.currentStamina ?? monster.stats.special;
  const maxStamina = expandedStats?.stamina ?? monster.stats.special;
  
  const hpPercent = (currentHp / maxHp) * 100;
  const staminaPercent = (currentStamina / maxStamina) * 100;
  const xpPercent = (experience / experienceToNext) * 100;
  
  return (
    <>
      {/* Always visible mini sidebar */}
      <div className="fixed left-0 top-0 h-full w-16 bg-card border-r-2 border-primary/20 flex flex-col items-center py-4 gap-3 z-50 shadow-lg">
        {/* Monster portrait */}
        <div className="relative">
          <MonsterSprite 
            species={monster.species}
            element={monster.element}
            classType={monster.class}
            size={48}
            animated={false}
          />
          {/* HP indicator ring */}
          <div 
            className="absolute inset-0 rounded-full border-2 border-transparent"
            style={{
              background: `conic-gradient(hsl(var(--stat-hp)) ${hpPercent}%, transparent ${hpPercent}%)`,
              mask: 'radial-gradient(transparent 55%, black 56%)',
              WebkitMask: 'radial-gradient(transparent 55%, black 56%)',
            }}
          />
        </div>
        
        {/* Level badge */}
        <div className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
          Lv.{monster.level}
        </div>
        
        {/* Stamina bar mini */}
        <div className="w-10 h-1.5 bg-muted rounded-full overflow-hidden" title={`Stamina: ${currentStamina}/${maxStamina}`}>
          <div 
            className="h-full bg-stat-special transition-all"
            style={{ width: `${staminaPercent}%` }}
          />
        </div>
        
        {/* Menu buttons */}
        <div className="flex flex-col gap-2 mt-2">
          <Button 
            variant={activePanel === 'character' ? 'default' : 'ghost'} 
            size="icon"
            className="w-10 h-10"
            onClick={() => setActivePanel(activePanel === 'character' ? null : 'character')}
            title="Character Sheet"
          >
            <User className="w-5 h-5" />
          </Button>
          
          <Button 
            variant={activePanel === 'moves' ? 'default' : 'ghost'} 
            size="icon"
            className="w-10 h-10"
            onClick={() => setActivePanel(activePanel === 'moves' ? null : 'moves')}
            title="Moves"
          >
            <Swords className="w-5 h-5" />
          </Button>
          
          <Button 
            variant={activePanel === 'inventory' ? 'default' : 'ghost'} 
            size="icon"
            className="w-10 h-10"
            onClick={() => setActivePanel(activePanel === 'inventory' ? null : 'inventory')}
            title="Inventory"
          >
            <Backpack className="w-5 h-5" />
          </Button>
        </div>
        
        {/* Floor and gold */}
        <div className="mt-auto flex flex-col items-center gap-1 text-xs">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Map className="w-3 h-3" />
            <span>F{floor}</span>
          </div>
          <div className="text-primary font-bold">💰{gold}</div>
        </div>
        
        {/* Flee button */}
        {onFlee && !inBattle && (
          <Button 
            variant="destructive" 
            size="icon"
            className="w-10 h-10"
            onClick={onFlee}
            title="Flee from dungeon"
          >
            <DoorOpen className="w-5 h-5" />
          </Button>
        )}
      </div>
      
      {/* Slide-out panels */}
      {activePanel && (
        <div className="fixed left-16 top-0 h-full w-80 bg-card border-r-2 border-primary/20 shadow-xl z-40 animate-slide-in-right">
          <div className="p-4 h-full flex flex-col">
            {/* Panel header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-primary">
                {activePanel === 'character' && '📋 Character'}
                {activePanel === 'moves' && '⚔️ Moves'}
                {activePanel === 'inventory' && '🎒 Inventory'}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setActivePanel(null)}>✕</Button>
            </div>
            
            <ScrollArea className="flex-1">
              {/* Character Panel */}
              {activePanel === 'character' && (
                <div className="space-y-4">
                  {/* Monster info */}
                  <Card className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <MonsterSprite 
                        species={monster.species}
                        element={monster.element}
                        classType={monster.class}
                        size={64}
                      />
                      <div>
                        <h3 className="font-bold">{monster.name}</h3>
                        <p className="text-sm text-muted-foreground">{speciesData.name}</p>
                        <div className="flex gap-1 mt-1">
                          <span className={`element-badge element-${monster.element} text-[10px] px-2 py-0.5`}>
                            {monster.element}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted">
                            {monster.class}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* HP & Stamina Bars */}
                    <div className="space-y-2 mb-3">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">HP</span>
                          <span className="font-mono">{currentHp}/{maxHp}</span>
                        </div>
                        <Progress value={hpPercent} className="h-2" />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Stamina</span>
                          <span className="font-mono">{currentStamina}/{maxStamina}</span>
                        </div>
                        <Progress value={staminaPercent} className="h-2 [&>div]:bg-stat-special" />
                      </div>
                    </div>
                    
                    {/* XP Bar */}
                    <div className="mb-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Experience</span>
                        <span className="font-mono">{experience}/{experienceToNext}</span>
                      </div>
                      <Progress value={xpPercent} className="h-2 [&>div]:bg-gradient-to-r [&>div]:from-secondary [&>div]:to-accent" />
                    </div>
                    
                    {/* Passive */}
                    <div className="bg-muted/50 rounded p-2 text-xs">
                      <p className="font-semibold text-primary">{speciesData.passiveAbility}</p>
                      <p className="text-muted-foreground">{speciesData.passiveDescription}</p>
                    </div>
                  </Card>
                  
                  {/* Stats - Corrected Layout */}
                  <Card className="p-4 space-y-3">
                    <h4 className="font-semibold text-sm mb-2">Combat Stats</h4>
                    
                    {/* Attack Stats */}
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground uppercase">Attack Power</p>
                      <StatRow 
                        icon={<Swords className="w-4 h-4 text-orange-500" />} 
                        label="Melee" 
                        value={expandedStats?.melee ?? monster.stats.attack} 
                        description="Power for melee-type attacks"
                      />
                      <StatRow 
                        icon={<Target className="w-4 h-4 text-yellow-500" />} 
                        label="Ranged" 
                        value={expandedStats?.ranged ?? monster.stats.special} 
                        description="Power for ranged-type attacks"
                      />
                    </div>
                    
                    {/* Defense Stats */}
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground uppercase">Defense</p>
                      <StatRow 
                        icon={<Shield className="w-4 h-4 text-stat-defense" />} 
                        label="Defense" 
                        value={expandedStats?.defense ?? monster.stats.defense}
                        description="Reduces incoming damage"
                      />
                      <StatRow 
                        icon={<Footprints className="w-4 h-4 text-emerald-500" />} 
                        label="Dodge" 
                        value={expandedStats?.dodge ?? Math.floor(monster.stats.speed * 0.5)}
                        description="Chance to evade attacks"
                      />
                    </div>
                    
                    {/* Speed */}
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground uppercase">Turn Order</p>
                      <StatRow 
                        icon={<Wind className="w-4 h-4 text-stat-speed" />} 
                        label="Speed" 
                        value={expandedStats?.speed ?? monster.stats.speed}
                        description="Determines who attacks first"
                      />
                    </div>
                  </Card>
                </div>
              )}
              
              {/* Moves Panel */}
              {activePanel === 'moves' && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground mb-3">
                    Attacks use 1-3 of your aspects (Species, Element, Class)
                  </p>
                  {moves.map((move) => (
                    <MoveCard key={move.id} move={move} monster={monster} expandedStats={expandedStats} />
                  ))}
                </div>
              )}
              
              {/* Inventory Panel */}
              {activePanel === 'inventory' && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Inventory coming soon! Use items during battle.
                  </p>
                  <Card className="p-4 text-center text-muted-foreground">
                    <Backpack className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Your bag is empty</p>
                  </Card>
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      )}
    </>
  );
}

function StatRow({ 
  icon, 
  label, 
  value, 
  description 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string | number;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between" title={description}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <span className="font-mono text-sm font-bold">{value}</span>
    </div>
  );
}

interface MoveCardProps {
  move: Move;
  monster: Monster;
  expandedStats?: ExpandedStats;
}

function MoveCard({ move, monster, expandedStats }: MoveCardProps) {
  const typeColors: Record<Move['type'], string> = {
    melee: 'bg-orange-500/20 text-orange-600',
    ranged: 'bg-blue-500/20 text-blue-600',
    status: 'bg-purple-500/20 text-purple-600',
    heal: 'bg-green-500/20 text-green-600',
  };
  
  const aspectBadges = getAspectBadges(move);
  
  // Calculate effective power based on attack type and stats
  const attackStat = move.type === 'melee' 
    ? (expandedStats?.melee ?? monster.stats.attack)
    : move.type === 'ranged'
    ? (expandedStats?.ranged ?? monster.stats.special)
    : 0;
  
  // Speed modifier display
  const speedDisplay = move.speedMod === 0 ? null : 
    move.speedMod > 0 ? `+${move.speedMod} priority` : `${move.speedMod} priority`;
  
  return (
    <Card className="p-3">
      <div className="flex items-start justify-between mb-1">
        <h4 className="font-semibold text-sm">{move.name}</h4>
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${typeColors[move.type]}`}>
          {move.type}
        </span>
      </div>
      
      {/* Aspect badges */}
      <div className="flex gap-1 mb-2">
        {aspectBadges.map((badge, i) => (
          <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded ${badge.colorClass}`}>
            {badge.label}
          </span>
        ))}
        {move.element && (
          <span className={`element-badge element-${move.element} text-[9px] px-1.5 py-0.5`}>
            {move.element}
          </span>
        )}
        {move.classBonus && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-600">
            {move.classBonus}
          </span>
        )}
      </div>
      
      <p className="text-xs text-muted-foreground mb-2">{move.description}</p>
      
      <div className="flex flex-wrap gap-2 text-[10px]">
        {move.power > 0 && (
          <span title={`Base power + ${move.type === 'melee' ? 'Melee' : 'Ranged'} stat`}>
            ⚔️ {move.power} {attackStat > 0 && <span className="text-muted-foreground">(+{Math.floor(attackStat / 2)})</span>}
          </span>
        )}
        <span title="Base accuracy">🎯 {move.accuracy}%</span>
        <span title="Stamina cost">⚡ {move.staminaCost}</span>
        {speedDisplay && <span title="Turn order modifier" className="text-stat-speed">🏃 {speedDisplay}</span>}
      </div>
      
      {move.effect && (
        <div className="mt-1 text-[10px] text-accent">
          ✨ {move.effect.replace(/_/g, ' ')}
        </div>
      )}
    </Card>
  );
}
