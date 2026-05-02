// Game Sidebar - Always visible menu with panels (works in both dungeon and battle)

import { useState, forwardRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

type PanelName = 'character' | 'inventory' | 'moves' | 'party';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { User, Backpack, Map, DoorOpen, Home, Swords, Shield, Wind, Target, Footprints, Trash2, Settings, Shirt, Gem, Users, LogOut, Hammer } from 'lucide-react';
import { Monster, InventoryItem, MaterialInventory, SPECIES_DATA, ELEMENT_ADVANTAGES, CLASS_ADVANTAGES_CORRECTED } from './types';
import { CombatEffects } from './statusEffects';
import { MonsterSprite } from './sprites';
import { getMonsterMoves, Move } from './moves';
import { ExpandedStats } from './CharacterSheet';
import { ITEMS } from './Inventory';
import { UnifiedMovePanel } from './UnifiedMovePanel';
import { SettingsPanel } from './Settings';
import { MonsterEquipment, EquipmentItem, RARITY_COLORS, CRAFTING_MATERIALS, calculateEquipmentBonuses, calculateSetBonusStats } from './equipment';
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
  locationName?: string; // Dungeon name (e.g. "Tower of the Infinite") or overworld region
  inventory?: InventoryItem[];
  equipmentInventory?: EquipmentItem[];
  equipment?: MonsterEquipment;
  runMaterials?: MaterialInventory;
  moveOrder?: string[];
  hiddenMoves?: string[];
  onFlee?: () => void;
  fleeTitle?: string;
  fleeVariant?: 'door' | 'home';
  onMainMenu?: () => void;
  mainMenuTitle?: string;
  onDropItem?: (itemId: string) => void;
  onReorderMoves?: (newOrder: string[]) => void;
  onToggleHideMove?: (moveId: string) => void;
  onOpenEquipment?: () => void;
  inBattle?: boolean;
  experience?: number;
  experienceToNext?: number;
  expandedStats?: ExpandedStats;
  onPanelChange?: (isOpen: boolean) => void;
  panelHostId?: string;
  onUseItem?: (item: InventoryItem) => void;
  onUseMove?: (move: Move | EvolvedMove) => void; // NEW: for using moves
  enemyMonster?: Monster | null;
  enemyExpandedStats?: ExpandedStats;
  // Party props
  party?: Monster[];
  activePartyIndex?: number;
  onPartySwitch?: (index: number) => void;
  partyEffects?: CombatEffects[];
  // Portable Workstation: shows a hammer button that opens the crafting modal
  // when the player owns the singleton workstation tool.
  onOpenWorkshop?: () => void;
}
export const GameSidebar = forwardRef<HTMLDivElement, GameSidebarProps>(({
  monster,
  gold,
  floor,
  locationName,
  inventory = [],
  equipmentInventory = [],
  equipment,
  runMaterials = {},
  moveOrder = [],
  hiddenMoves = [],
  onFlee,
  fleeTitle,
  fleeVariant = 'door',
  onMainMenu,
  mainMenuTitle,
  onDropItem,
  onReorderMoves,
  onToggleHideMove,
  onOpenEquipment,
  inBattle = false,
  experience = 0,
  experienceToNext = 100,
  expandedStats,
  onPanelChange,
  panelHostId,
  onUseItem,
  onUseMove,
  enemyMonster,
  enemyExpandedStats,
  party = [],
  activePartyIndex = 0,
  onPartySwitch,
  partyEffects = [],
  onOpenWorkshop,
}, ref) => {
  const isMobileView = typeof window !== 'undefined' && window.innerWidth < 640;
  const [activePanel, setActivePanel] = useState<PanelName | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [panelHost, setPanelHost] = useState<HTMLElement | null>(null);

  // Resolve the portal host after the parent has rendered the slot for the
  // active panel. Without this the first open lands in the fallback fixed
  // overlay because the host element doesn't exist yet on the same tick.
  useLayoutEffect(() => {
    if (!panelHostId || !activePanel || typeof document === 'undefined') {
      setPanelHost(null);
      return;
    }
    const find = () => setPanelHost(document.getElementById(panelHostId));
    find();
    // Retry on the next frame in case the host mounts in a sibling effect.
    const raf = requestAnimationFrame(find);
    return () => cancelAnimationFrame(raf);
  }, [panelHostId, activePanel]);
  
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
          <div className="flex flex-col gap-0.5 sm:gap-1 w-[80px] sm:w-[180px]">
            <div className="flex items-center gap-1 sm:gap-2">
              <span className="text-[10px] sm:text-xs text-stat-hp w-5 sm:w-6 font-medium">HP</span>
              <div className="flex-1 h-3 sm:h-4 bg-muted rounded-full overflow-hidden" title={`HP: ${currentHp}/${maxHp}`}>
                <div className="h-full bg-stat-hp transition-all" style={{ width: `${hpPercent}%` }} />
              </div>
              <span className="hidden sm:inline text-xs font-mono w-16 text-right">{currentHp}/{maxHp}</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <span className="text-[10px] sm:text-xs text-stat-special w-5 sm:w-6 font-medium">ST</span>
              <div className="flex-1 h-3 sm:h-4 bg-muted rounded-full overflow-hidden" title={`Stamina: ${currentStamina}/${maxStamina}`}>
                <div className="h-full bg-stat-special transition-all" style={{ width: `${staminaPercent}%` }} />
              </div>
              <span className="hidden sm:inline text-xs font-mono w-16 text-right">{currentStamina}/{maxStamina}</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <span className="text-[10px] sm:text-xs text-secondary w-5 sm:w-6 font-medium">XP</span>
              <div className="flex-1 h-2.5 sm:h-3 bg-muted rounded-full overflow-hidden" title={`XP: ${experience}/${experienceToNext}`}>
                <div className="h-full bg-secondary transition-all" style={{ width: `${xpPercent}%` }} />
              </div>
              <span className="hidden sm:inline text-xs font-mono w-16 text-right">{experience}/{experienceToNext}</span>
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
          
          <Button variant={activePanel === 'moves' ? 'default' : 'ghost'} size="icon" className="w-9 h-9 sm:w-8 sm:h-8" onClick={() => handlePanelChange('moves')} title="Moves / Attacks">
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
              className="w-9 h-9 sm:w-8 sm:h-8 relative hidden sm:flex" 
              onClick={() => handlePanelChange('party')} 
              title="Party"
            >
              <Users className="w-5 h-5 sm:w-4 sm:h-4" />
              <span className="absolute -top-1 -right-1 bg-secondary text-secondary-foreground text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {party.length}
              </span>
            </Button>
          )}
          
          {/* Portable Workstation — opens crafting modal anywhere when owned */}
          {onOpenWorkshop && (
            <Button
              variant="ghost"
              size="icon"
              className="w-9 h-9 sm:w-8 sm:h-8"
              onClick={onOpenWorkshop}
              title="Open Portable Workstation (crafting)"
            >
              <Hammer className="w-5 h-5 sm:w-4 sm:h-4" />
            </Button>
          )}

          {/* Settings button */}
          <Button variant="ghost" size="icon" className="w-9 h-9 sm:w-8 sm:h-8 hidden sm:flex" onClick={() => setShowSettings(true)} title="Settings">
            <Settings className="w-5 h-5 sm:w-4 sm:h-4" />
          </Button>
        </div>
        
        {/* Location, floor and gold */}
        <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs flex-shrink-0 min-w-0">
          <div className="flex items-center gap-0.5 sm:gap-1 text-muted-foreground min-w-0" title={locationName}>
            <Map className="w-3 h-3 flex-shrink-0" />
            {locationName ? (
              <span className="truncate max-w-[80px] sm:max-w-[200px]">
                <span className="text-foreground font-semibold hidden sm:inline">{locationName}</span>
                <span className="sm:ml-1">F{floor}</span>
              </span>
            ) : (
              <span>F{floor}</span>
            )}
          </div>
          <div className="text-primary font-bold flex-shrink-0">💰{gold}</div>
        </div>
        
        {/* Flee button */}
        {onFlee && (
          <Button
            variant={fleeVariant === 'home' ? 'secondary' : 'destructive'}
            size="icon"
            className="w-9 h-9 sm:w-8 sm:h-8 flex-shrink-0"
            onClick={onFlee}
            title={fleeTitle ?? (inBattle ? 'Flee from battle' : 'Flee from dungeon')}
          >
            {fleeVariant === 'home'
              ? <Home className="w-5 h-5 sm:w-4 sm:h-4" />
              : <DoorOpen className="w-5 h-5 sm:w-4 sm:h-4" />}
          </Button>
        )}

        {/* Return to Main Menu button */}
        {onMainMenu && (
          <Button
            variant="destructive"
            size="icon"
            className="w-9 h-9 sm:w-8 sm:h-8 flex-shrink-0"
            onClick={onMainMenu}
            title={mainMenuTitle ?? 'Return to main menu (ends run)'}
          >
            <LogOut className="w-5 h-5 sm:w-4 sm:h-4" />
          </Button>
        )}
      </div>
      
      {(activePanel && panelHost)
        ? createPortal(
          <div
            key={activePanel}
            className="h-full w-full overflow-y-auto overscroll-contain bg-card animate-fade-in"
            style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
          >
            <div className="p-3">
            {/* Panel header */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <h2 className="text-sm font-bold text-primary flex-shrink-0">
                {activePanel === 'character' && '📋 Character'}
                {activePanel === 'moves' && '⚔️ Moves'}
                {activePanel === 'inventory' && '🎒 Inventory'}
                {activePanel === 'party' && '👥 Party'}
              </h2>
              {/* Slot for panel-specific inline controls (e.g. Moves sort/filter) */}
              <div id="panel-header-controls" className="flex-1 min-w-0 flex items-center justify-end overflow-hidden" />
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0" onClick={() => handlePanelChange(null)}>✕</Button>
            </div>
            
            {/* Character Panel - Enhanced with passives & base vs equipped stats */}
            {activePanel === 'character' && (() => {
              const speciesData = SPECIES_DATA[monster.species];
              const equipBonuses = equipment ? calculateEquipmentBonuses(equipment) : null;
              const setBonuses = equipment ? calculateSetBonusStats(equipment) : null;
              
              // Base stats (without equipment)
              const baseAtk = monster.stats.attack;
              const baseDef = monster.stats.defense;
              const baseSpd = monster.stats.speed;
              const baseDodge = monster.stats.dodge ?? Math.floor(monster.stats.speed * 0.5);
              const baseSpecial = monster.stats.special;
              const _baseMaxHp = monster.stats.maxHp;
              const _baseStamina = monster.stats.stamina ?? 50;
              
              // Equipment contributions
              const eqAtk = (equipBonuses?.attack ?? 0) + (setBonuses?.attack ?? 0);
              const eqDef = (equipBonuses?.defense ?? 0) + (setBonuses?.defense ?? 0);
              const eqSpd = (equipBonuses?.speed ?? 0) + (setBonuses?.speed ?? 0);
              const eqDodge = (equipBonuses?.dodge ?? 0) + (setBonuses?.dodge ?? 0);
              const eqSpecial = (equipBonuses?.special ?? 0) + (setBonuses?.special ?? 0);
              const eqHp = (equipBonuses?.maxHp ?? 0) + (setBonuses?.maxHp ?? 0);
              const eqSta = (equipBonuses?.stamina ?? 0) + (setBonuses?.stamina ?? 0);
              
              // Element/class advantages
              const elementStrong = ELEMENT_ADVANTAGES[monster.element] || [];
              const elementWeak = (Object.entries(ELEMENT_ADVANTAGES) as [string, string[]][])
                .filter(([, targets]) => targets.includes(monster.element))
                .map(([el]) => el);
              const classStrong = CLASS_ADVANTAGES_CORRECTED[monster.class] || [];
              const classWeak = (Object.entries(CLASS_ADVANTAGES_CORRECTED) as [string, string[]][])
                .filter(([, targets]) => targets.includes(monster.class))
                .map(([cl]) => cl);
              
              const StatRow = ({ label, icon, base, bonus, color }: { label: string; icon: React.ReactNode; base: number; bonus: number; color: string }) => (
                <div className="flex items-center gap-1 text-[10px]">
                  <span className={`w-3 h-3 ${color}`}>{icon}</span>
                  <span className="w-8 text-muted-foreground">{label}</span>
                  <span className="font-mono font-bold w-6 text-right">{base + bonus}</span>
                  {bonus !== 0 && (
                    <span className={`font-mono text-[9px] ${bonus > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      ({bonus > 0 ? '+' : ''}{bonus})
                    </span>
                  )}
                </div>
              );
              
              return <div className="space-y-2">
                {/* Row 1: Identity + Passive */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {/* Identity */}
                  <div className="bg-muted/30 rounded-lg p-2 flex items-center gap-2">
                    <MonsterSprite species={monster.species} element={monster.element} classType={monster.class} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-xs truncate">{monster.name}</p>
                      <p className="text-[10px] text-muted-foreground">Lv.{monster.level} {speciesData.name}</p>
                      <div className="flex gap-1 flex-wrap mt-0.5">
                        <span className={`element-badge element-${monster.element} text-[8px] px-1 py-0`}>{monster.element}</span>
                        <span className="text-[8px] px-1 py-0 rounded-full bg-muted">{monster.class}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Passive Ability - Prominent */}
                  <div className="bg-primary/10 border border-primary/30 rounded-lg p-2">
                    <div className="flex items-center gap-1 mb-0.5">
                      <span className="text-sm">✨</span>
                      <p className="text-xs font-bold text-primary">{speciesData.passiveAbility}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-snug">{speciesData.passiveDescription}</p>
                  </div>
                </div>
                
                {/* Row 2: Resource Bars */}
                <div className="bg-muted/30 rounded-lg p-2 space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span>HP</span>
                    <span className="font-mono">{currentHp}/{maxHp}{eqHp > 0 ? ` (+${eqHp})` : ''}</span>
                  </div>
                  <Progress value={hpPercent} className="h-1.5" />
                  <div className="flex justify-between text-[10px]">
                    <span>STA</span>
                    <span className="font-mono">{currentStamina}/{maxStamina}{eqSta > 0 ? ` (+${eqSta})` : ''}</span>
                  </div>
                  <Progress value={staminaPercent} className="h-1.5 [&>div]:bg-stat-special" />
                  <div className="flex justify-between text-[10px]">
                    <span>XP</span>
                    <span className="font-mono">{experience}/{experienceToNext}</span>
                  </div>
                  <Progress value={xpPercent} className="h-1.5 [&>div]:bg-secondary" />
                </div>
                
                {/* Row 3: Stats with base vs equipped */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-muted/30 rounded-lg p-2">
                    <p className="text-[9px] text-muted-foreground uppercase mb-1">Offense</p>
                    <div className="space-y-0.5">
                      <StatRow label="ATK" icon={<Swords className="w-3 h-3" />} base={baseAtk} bonus={eqAtk} color="text-orange-500" />
                      <StatRow label="SPC" icon={<Target className="w-3 h-3" />} base={baseSpecial} bonus={eqSpecial} color="text-yellow-500" />
                    </div>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-2">
                    <p className="text-[9px] text-muted-foreground uppercase mb-1">Defense / Mobility</p>
                    <div className="space-y-0.5">
                      <StatRow label="DEF" icon={<Shield className="w-3 h-3" />} base={baseDef} bonus={eqDef} color="text-stat-defense" />
                      <StatRow label="DDG" icon={<Footprints className="w-3 h-3" />} base={baseDodge} bonus={eqDodge} color="text-emerald-500" />
                      <StatRow label="SPD" icon={<Wind className="w-3 h-3" />} base={baseSpd} bonus={eqSpd} color="text-stat-speed" />
                    </div>
                  </div>
                </div>
                
                {/* Row 4: Matchup Info */}
                <div className="bg-muted/30 rounded-lg p-2">
                  <p className="text-[9px] text-muted-foreground uppercase mb-1">Matchups</p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
                    {elementStrong.length > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-green-400">▲</span>
                        <span className="text-muted-foreground">Elem:</span>
                        <span className="capitalize text-green-400">{elementStrong.join(', ')}</span>
                      </div>
                    )}
                    {elementWeak.length > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-red-400">▼</span>
                        <span className="text-muted-foreground">Elem:</span>
                        <span className="capitalize text-red-400">{elementWeak.join(', ')}</span>
                      </div>
                    )}
                    {classStrong.length > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-green-400">▲</span>
                        <span className="text-muted-foreground">Class:</span>
                        <span className="capitalize text-green-400">{classStrong.join(', ')}</span>
                      </div>
                    )}
                    {classWeak.length > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-red-400">▼</span>
                        <span className="text-muted-foreground">Class:</span>
                        <span className="capitalize text-red-400">{classWeak.join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>;
            })()}
            
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
                controlsSlotId="panel-header-controls"
              />
            )}
            
            {/* Inventory Panel */}
            {activePanel === 'inventory' && (
              <div className="space-y-3">
                {/* Consumables */}
                {inventory.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
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
          </div>,
          panelHost,
        )
        : activePanel && (
          <div 
            className="fixed left-0 right-0 bg-card border-2 border-primary/20 shadow-xl z-40 animate-fade-in overflow-y-auto"
            style={{
              bottom: `calc(var(--menagerie-sidebar-h, ${isMobileView ? '64px' : '96px'}) + 0.25rem)`,
              height: `calc(var(--menagerie-bar-h, ${isMobileView ? '160px' : '180px'}) - 0.5rem)`,
            }}
          >
            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-bold text-primary">
                  {activePanel === 'character' && '📋 Character'}
                  {activePanel === 'moves' && '⚔️ Moves'}
                  {activePanel === 'inventory' && '🎒 Inventory'}
                  {activePanel === 'party' && '👥 Party'}
                </h2>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handlePanelChange(null)}>✕</Button>
              </div>
            </div>
          </div>
        )}
      
      {/* Settings Panel */}
      <SettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </>;
});
GameSidebar.displayName = 'GameSidebar';