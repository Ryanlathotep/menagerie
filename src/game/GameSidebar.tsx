// Game Sidebar - Always visible menu with panels (works in both dungeon and battle)

import { useState, forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { User, Backpack, Map, DoorOpen, Swords, Shield, Wind, Target, Footprints, Trash2, Settings, Shirt, Gem, Users } from 'lucide-react';
import { Monster, InventoryItem, MaterialInventory } from './types';
import { CombatEffects } from './statusEffects';
import { MonsterSprite } from './sprites';
import { getMonsterMoves, Move } from './moves';
import { ExpandedStats } from './CharacterSheet';
import { ITEMS } from './Inventory';
import { UnifiedMovePanel } from './UnifiedMovePanel';
import { SettingsPanel } from './Settings';
import { MonsterEquipment, EquipmentItem, RARITY_COLORS, CRAFTING_MATERIALS } from './equipment';
import { PartyPanel } from './PartyPanel';
import { EvolvedMove } from './moveMastery';


// Helper functions to get item info when not in ITEMS database
function getItemDescription(item: InventoryItem): string {
  if (item.effect === 'heal_hp') return `Restores ${item.value} HP`;
  if (item.effect === 'heal_full') return 'Fully restores HP';
  if (item.effect === 'heal_stamina') return `Restores ${item.value} Stamina`;
  if (item.effect === 'cure_poison') return 'Cures poison';
  if (item.effect === 'cure_burn') return 'Cures burn';
  if (item.effect === 'cure_freeze') return 'Cures freeze';
  if (item.effect === 'cure_all') return 'Cures all status effects';
  if (item.effect === 'boost_attack') return 'Boosts attack for next battle';
  if (item.effect === 'boost_defense') return 'Boosts defense for next battle';
  if (item.effect === 'boost_speed') return 'Boosts speed for next battle';
  if (item.effect === 'revive') return `Revives fainted ally with ${item.value}% HP`;
  if (item.effect === 'revive_full') return 'Revives fainted ally with full HP';
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
  equipmentInventory?: EquipmentItem[];
  equipment?: MonsterEquipment;
  runMaterials?: MaterialInventory;
  moveOrder?: string[];
  hiddenMoves?: string[];
  onFlee?: () => void;
  onDropItem?: (itemId: string) => void;
  onReorderMoves?: (newOrder: string[]) => void;
  onToggleHideMove?: (moveId: string) => void;
  onOpenEquipment?: () => void;
  inBattle?: boolean;
  experience?: number;
  experienceToNext?: number;
  expandedStats?: ExpandedStats;
  onPanelChange?: (isOpen: boolean) => void;
  onUseItem?: (item: InventoryItem) => void;
  onUseMove?: (move: Move | EvolvedMove) => void; // NEW: for using moves
  enemyMonster?: Monster | null;
  enemyExpandedStats?: ExpandedStats;
  // Party props
  party?: Monster[];
  activePartyIndex?: number;
  onPartySwitch?: (index: number) => void;
  partyEffects?: CombatEffects[];
}
export const GameSidebar = forwardRef<HTMLDivElement, GameSidebarProps>(({
  monster,
  gold,
  floor,
  inventory = [],
  equipmentInventory = [],
  equipment,
  runMaterials = {},
  moveOrder = [],
  hiddenMoves = [],
  onFlee,
  onDropItem,
  onReorderMoves,
  onToggleHideMove,
  onOpenEquipment,
  inBattle = false,
  experience = 0,
  experienceToNext = 100,
  expandedStats,
  onPanelChange,
  onUseItem,
  onUseMove,
  enemyMonster,
  enemyExpandedStats,
  party = [],
  activePartyIndex = 0,
  onPartySwitch,
  partyEffects = [],
}, ref) => {
  const isMobileView = typeof window !== 'undefined' && window.innerWidth < 640;
  const [activePanel, setActivePanel] = useState<'character' | 'inventory' | 'moves' | 'party' | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  
  const handlePanelChange = (panel: typeof activePanel) => {
    const newPanel = activePanel === panel ? null : panel;
    setActivePanel(newPanel);
    onPanelChange?.(newPanel !== null);
  };
  
  if (!monster) return null;
  const moves = getMonsterMoves(monster.species, monster.element, monster.class, monster.level);

  // Use expanded stats if provided, otherwise fall back to basic stats
  const currentHp = expandedStats?.currentHp ?? monster.stats.currentHp;
  const maxHp = expandedStats?.maxHp ?? monster.stats.maxHp;
  const currentStamina = expandedStats?.currentStamina ?? monster.stats.special;
  const maxStamina = expandedStats?.stamina ?? monster.stats.special;
  const hpPercent = currentHp / maxHp * 100;
  const staminaPercent = currentStamina / maxStamina * 100;
  const xpPercent = experience / experienceToNext * 100;

  // Enemy stats for battle
  const enemyCurrentHp = enemyExpandedStats?.currentHp ?? enemyMonster?.stats.currentHp ?? 0;
  const enemyMaxHp = enemyExpandedStats?.maxHp ?? enemyMonster?.stats.maxHp ?? 1;
  const enemyCurrentStamina = enemyExpandedStats?.currentStamina ?? enemyMonster?.stats.special ?? 0;
  const enemyMaxStamina = enemyExpandedStats?.stamina ?? enemyMonster?.stats.special ?? 1;
  const enemyHpPercent = enemyCurrentHp / enemyMaxHp * 100;
  const enemyStaminaPercent = enemyCurrentStamina / enemyMaxStamina * 100;
  return <>
      {/* Always visible bottom bar */}
      <div ref={ref} className="fixed bottom-0 left-0 right-0 bg-card border-t-2 border-primary/20 flex items-center px-2 sm:px-3 gap-2 sm:gap-4 z-50 shadow-lg h-16 sm:h-24">
        {/* Player section */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {/* Monster portrait */}
          <div className="relative flex-shrink-0">
            <MonsterSprite species={monster.species} element={monster.element} classType={monster.class} size={isMobileView ? 40 : 64} animated={false} equipment={equipment} />
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded-full">
              {monster.level}
            </div>
          </div>
          
          {/* Player bars - always visible */}
          <div className="flex flex-col gap-0.5 sm:gap-1 w-[120px] sm:w-[180px]">
            <div className="flex items-center gap-1 sm:gap-2">
              <span className="text-[10px] sm:text-xs text-stat-hp w-5 sm:w-6 font-medium">HP</span>
              <div className="flex-1 h-3 sm:h-4 bg-muted rounded-full overflow-hidden" title={`HP: ${currentHp}/${maxHp}`}>
                <div className="h-full bg-stat-hp transition-all" style={{ width: `${hpPercent}%` }} />
              </div>
              <span className="text-[10px] sm:text-xs font-mono w-12 sm:w-16 text-right">{currentHp}/{maxHp}</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <span className="text-[10px] sm:text-xs text-stat-special w-5 sm:w-6 font-medium">ST</span>
              <div className="flex-1 h-3 sm:h-4 bg-muted rounded-full overflow-hidden" title={`Stamina: ${currentStamina}/${maxStamina}`}>
                <div className="h-full bg-stat-special transition-all" style={{ width: `${staminaPercent}%` }} />
              </div>
              <span className="text-[10px] sm:text-xs font-mono w-12 sm:w-16 text-right">{currentStamina}/{maxStamina}</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <span className="text-[10px] sm:text-xs text-secondary w-5 sm:w-6 font-medium">XP</span>
              <div className="flex-1 h-2.5 sm:h-3 bg-muted rounded-full overflow-hidden" title={`XP: ${experience}/${experienceToNext}`}>
                <div className="h-full bg-secondary transition-all" style={{ width: `${xpPercent}%` }} />
              </div>
              <span className="text-[10px] sm:text-xs font-mono w-12 sm:w-16 text-right">{experience}/{experienceToNext}</span>
            </div>
          </div>
        </div>

        {/* Enemy section - only in battle */}
        {inBattle && enemyMonster && (
          <div className="hidden sm:flex items-center gap-2 flex-shrink-0 border-l border-border/50 pl-3">
            <div className="relative flex-shrink-0">
              <MonsterSprite species={enemyMonster.species} element={enemyMonster.element} classType={enemyMonster.class} size={36} animated={false} />
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 rounded-full">
                {enemyMonster.level}
              </div>
            </div>
            <div className="flex flex-col gap-1 min-w-[80px]">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-stat-hp w-5 font-medium">HP</span>
                <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-stat-hp transition-all" style={{ width: `${enemyHpPercent}%` }} />
                </div>
                <span className="text-[10px] font-mono w-12 text-right">{enemyCurrentHp}/{enemyMaxHp}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-stat-special w-5 font-medium">ST</span>
                <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-stat-special transition-all" style={{ width: `${enemyStaminaPercent}%` }} />
                </div>
                <span className="text-[10px] font-mono w-12 text-right">{enemyCurrentStamina}/{enemyMaxStamina}</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Menu buttons - larger touch targets on mobile */}
        <div className="flex gap-0.5 sm:gap-1 ml-auto">
          <Button variant={activePanel === 'character' ? 'default' : 'ghost'} size="icon" className="w-9 h-9 sm:w-8 sm:h-8" onClick={() => handlePanelChange('character')} title="Character Sheet">
            <User className="w-5 h-5 sm:w-4 sm:h-4" />
          </Button>
          
          <Button variant={activePanel === 'moves' ? 'default' : 'ghost'} size="icon" className="w-9 h-9 sm:w-8 sm:h-8" onClick={() => handlePanelChange('moves')} title="Moves">
            <Swords className="w-5 h-5 sm:w-4 sm:h-4" />
          </Button>
          
          <Button variant={activePanel === 'inventory' ? 'default' : 'ghost'} size="icon" className="w-9 h-9 sm:w-8 sm:h-8" onClick={() => handlePanelChange('inventory')} title="Inventory">
            <Backpack className="w-5 h-5 sm:w-4 sm:h-4" />
          </Button>
          
          {/* Equipment button - shows equipped item count */}
          {onOpenEquipment && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="w-9 h-9 sm:w-8 sm:h-8 relative" 
              onClick={onOpenEquipment}
              title="Equipment"
            >
              <Shirt className="w-5 h-5 sm:w-4 sm:h-4" />
              {equipmentInventory.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-secondary text-secondary-foreground text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {equipmentInventory.length}
                </span>
              )}
            </Button>
          )}
          
          {/* Party button - only show if party has more than 1 member */}
          {party.length > 1 && onPartySwitch && (
            <Button 
              variant={activePanel === 'party' ? 'default' : 'ghost'} 
              size="icon" 
              className="w-9 h-9 sm:w-8 sm:h-8 relative" 
              onClick={() => handlePanelChange('party')} 
              title="Party"
            >
              <Users className="w-5 h-5 sm:w-4 sm:h-4" />
              <span className="absolute -top-1 -right-1 bg-secondary text-secondary-foreground text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {party.length}
              </span>
            </Button>
          )}
          
          {/* Settings button */}
          <Button variant="ghost" size="icon" className="w-9 h-9 sm:w-8 sm:h-8" onClick={() => setShowSettings(true)} title="Settings">
            <Settings className="w-5 h-5 sm:w-4 sm:h-4" />
          </Button>
        </div>
        
        {/* Floor and gold */}
        <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs flex-shrink-0">
          <div className="flex items-center gap-0.5 sm:gap-1 text-muted-foreground">
            <Map className="w-3 h-3" />
            <span>F{floor}</span>
          </div>
          <div className="text-primary font-bold">💰{gold}</div>
        </div>
        
        {/* Flee button */}
        {onFlee && (
          <Button variant="destructive" size="icon" className="w-9 h-9 sm:w-8 sm:h-8 flex-shrink-0" onClick={onFlee} title={inBattle ? "Flee from battle" : "Flee from dungeon"}>
            <DoorOpen className="w-5 h-5 sm:w-4 sm:h-4" />
          </Button>
        )}
      </div>
      
      {/* Compact slide-up panels */}
      {activePanel && <div className="fixed bottom-24 left-0 right-0 bg-card border-t-2 border-primary/20 shadow-xl z-40 animate-fade-in">
          <div className="p-3">
            {/* Panel header */}
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-primary">
                {activePanel === 'character' && '📋 Character'}
                {activePanel === 'moves' && '⚔️ Moves'}
                {activePanel === 'inventory' && '🎒 Inventory'}
                {activePanel === 'party' && '👥 Party'}
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
            
            {/* Moves Panel with drag-and-drop and usage */}
            {activePanel === 'moves' && (
              <UnifiedMovePanel
                moves={moves}
                monster={monster}
                expandedStats={expandedStats}
                moveOrder={moveOrder}
                hiddenMoves={hiddenMoves}
                onReorder={onReorderMoves || (() => {})}
                onToggleHide={onToggleHideMove || (() => {})}
                inBattle={inBattle}
                currentStamina={expandedStats?.currentStamina ?? monster.stats.currentStamina ?? monster.stats.stamina ?? 50}
                enemyMonster={enemyMonster}
                onUseMove={onUseMove}
              />
            )}
            
            {/* Inventory Panel */}
            {activePanel === 'inventory' && (
              <div className="space-y-3">
                {/* Consumables */}
                {inventory.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {(() => {
                      const consumables = inventory.filter(item => item.type === 'potion' || item.effect);
                      return inventory.map(item => {
                        const itemData = ITEMS[item.id];
                        const description = itemData?.description || getItemDescription(item);
                        const icon = itemData?.icon || getItemIcon(item);
                        const hotbarIndex = consumables.indexOf(item);
                        const hotbarKey = hotbarIndex >= 0 && hotbarIndex < 9 ? hotbarIndex + 1 : null;
                        
                        return (
                          <Tooltip key={item.id}>
                            <TooltipTrigger asChild>
                              <Card 
                                className={`p-2 transition-all ${onUseItem ? 'cursor-pointer hover:bg-primary/10 hover:border-primary' : 'cursor-default hover:bg-muted/50'}`}
                                onClick={() => onUseItem?.(item)}
                              >
                                <div className="flex items-center gap-2">
                                  {hotbarKey && (
                                    <span className="w-4 h-4 rounded bg-muted border border-border text-[9px] font-bold flex items-center justify-center text-muted-foreground flex-shrink-0" title={`Shift+${hotbarKey}`}>
                                      {hotbarKey}
                                    </span>
                                  )}
                                  <span className="text-lg">{icon}</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1">
                                      <span className="font-semibold text-xs truncate">{item.name}</span>
                                      {item.quantity > 1 && (
                                        <span className="text-[10px] text-muted-foreground">x{item.quantity}</span>
                                      )}
                                    </div>
                                    {onUseItem && <p className="text-[9px] text-primary">{hotbarKey ? `Shift+${hotbarKey} or click` : 'Click to use'}</p>}
                                  </div>
                                  {onDropItem && !inBattle && (
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
                              </Card>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[200px] z-[100]">
                              <p className="font-semibold text-sm">{item.name}</p>
                              <p className="text-xs text-muted-foreground">{description}</p>
                              {item.effect && (
                                <p className="text-xs text-accent mt-1">
                                  ✨ {item.effect.replace(/_/g, ' ')}
                                  {item.value > 0 && ` (+${item.value})`}
                                </p>
                              )}
                              {hotbarKey && (
                                <p className="text-xs text-secondary mt-1">⌨ Shift+{hotbarKey}</p>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        );
                      });
                    })()}
                  </div>
                ) : (
                  <div className="text-center py-2 text-muted-foreground">
                    <Backpack className="w-6 h-6 mx-auto mb-1 opacity-30" />
                    <p className="text-xs">No items</p>
                  </div>
                )}
                
                {/* Materials found this run */}
                {Object.keys(runMaterials).length > 0 && (
                  <div className="border-t border-border/50 pt-2">
                    <div className="flex items-center gap-1 mb-2">
                      <Gem className="w-3 h-3 text-secondary" />
                      <p className="text-xs font-semibold text-muted-foreground">Materials Found (kept on flee)</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(runMaterials).map(([materialId, quantity]) => {
                        const material = CRAFTING_MATERIALS.find(m => m.id === materialId);
                        const rarityColor = material ? RARITY_COLORS[material.rarity] : null;
                        
                        return (
                          <Tooltip key={materialId}>
                            <TooltipTrigger asChild>
                              <span 
                                className={`
                                  px-2 py-1 rounded text-xs flex items-center gap-1
                                  ${rarityColor?.bg || 'bg-muted'} ${rarityColor?.border || 'border-muted'} border
                                `}
                              >
                                <span>{material?.icon || '📦'}</span>
                                <span className={rarityColor?.text}>{quantity}</span>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="z-[100]">
                              <p className={`font-semibold text-sm ${rarityColor?.text}`}>
                                {material?.name || materialId}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {material?.type || 'Material'} • {quantity}x
                              </p>
                              <p className="text-xs text-green-400 mt-1">
                                ✓ Kept when you flee!
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Log panel removed - log is always visible in main view */}
            
            {/* Party Panel */}
            {activePanel === 'party' && onPartySwitch && (
              <PartyPanel
                party={party}
                activeIndex={activePartyIndex}
                activeXp={experience}
                onSwitch={(index) => {
                  onPartySwitch(index);
                  handlePanelChange(null);
                }}
                partyEffects={partyEffects}
              />
            )}
          </div>
        </div>}
      
      {/* Settings Panel */}
      <SettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </>;
});
GameSidebar.displayName = 'GameSidebar';