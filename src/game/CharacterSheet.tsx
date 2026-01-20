// Character Sheet Component with expanded stats and equipment

import { Monster, SPECIES_DATA, ElementType, ClassType } from './types';
import { MonsterSprite, generateMonsterName } from './sprites';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

// Expanded stat interface
export interface ExpandedStats {
  maxHp: number;
  currentHp: number;
  melee: number;      // Physical attack power
  ranged: number;     // Ranged attack power
  defense: number;    // Damage reduction
  dexterity: number;  // Accuracy and evasion
  speed: number;      // Turn order and action points
  stamina: number;    // Ability cost pool
  currentStamina: number;
}

// Equipment slots
export type EquipmentSlot = 'armor' | 'mainHand' | 'offHand' | 'boots';

export interface EquipmentItem {
  id: string;
  name: string;
  slot: EquipmentSlot;
  handedness: 1 | 2; // For weapons: 1 = one-handed, 2 = two-handed
  stats: Partial<ExpandedStats>;
  element?: ElementType;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
}

export interface Equipment {
  armor: EquipmentItem | null;
  mainHand: EquipmentItem | null;
  offHand: EquipmentItem | null;
  boots: EquipmentItem | null;
}

// Extended monster with full stats
export interface FullMonster extends Omit<Monster, 'stats'> {
  stats: ExpandedStats;
  equipment: Equipment;
  experience: number;
  experienceToNext: number;
}

// Stat colors for display
const STAT_COLORS: Record<keyof Omit<ExpandedStats, 'currentHp' | 'currentStamina'>, string> = {
  maxHp: 'bg-stat-hp',
  melee: 'bg-orange-500',
  ranged: 'bg-yellow-500',
  defense: 'bg-stat-defense',
  dexterity: 'bg-emerald-500',
  speed: 'bg-stat-speed',
  stamina: 'bg-stat-special',
};

const STAT_LABELS: Record<keyof Omit<ExpandedStats, 'currentHp' | 'currentStamina'>, { name: string; abbr: string }> = {
  maxHp: { name: 'Health', abbr: 'HP' },
  melee: { name: 'Melee Attack', abbr: 'MEL' },
  ranged: { name: 'Ranged Attack', abbr: 'RNG' },
  defense: { name: 'Defense', abbr: 'DEF' },
  dexterity: { name: 'Dexterity', abbr: 'DEX' },
  speed: { name: 'Speed', abbr: 'SPD' },
  stamina: { name: 'Stamina', abbr: 'STA' },
};

interface StatBarProps {
  stat: keyof Omit<ExpandedStats, 'currentHp' | 'currentStamina'>;
  value: number;
  maxValue?: number;
  showBar?: boolean;
}

function StatBar({ stat, value, maxValue = 100, showBar = true }: StatBarProps) {
  const label = STAT_LABELS[stat];
  const color = STAT_COLORS[stat];
  const percentage = Math.min((value / maxValue) * 100, 100);
  
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-8">{label.abbr}</span>
      {showBar ? (
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className={`h-full ${color} transition-all`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      ) : null}
      <span className="text-xs font-mono w-8 text-right">{value}</span>
    </div>
  );
}

// Rarity colors
const RARITY_COLORS: Record<EquipmentItem['rarity'], string> = {
  common: 'text-muted-foreground',
  uncommon: 'text-green-400',
  rare: 'text-blue-400',
  epic: 'text-purple-400',
  legendary: 'text-amber-400',
};

interface EquipmentSlotDisplayProps {
  slot: EquipmentSlot;
  item: EquipmentItem | null;
  label: string;
}

function EquipmentSlotDisplay({ slot, item, label }: EquipmentSlotDisplayProps) {
  const slotIcons: Record<EquipmentSlot, string> = {
    armor: '🛡️',
    mainHand: '⚔️',
    offHand: '🗡️',
    boots: '👢',
  };
  
  return (
    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded border border-border">
      <span className="text-lg">{slotIcons[slot]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase">{label}</p>
        {item ? (
          <p className={`text-xs truncate ${RARITY_COLORS[item.rarity]}`}>
            {item.name}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground/50 italic">Empty</p>
        )}
      </div>
    </div>
  );
}

interface CharacterSheetProps {
  monster: FullMonster;
  compact?: boolean;
}

export function CharacterSheet({ monster, compact = false }: CharacterSheetProps) {
  const speciesData = SPECIES_DATA[monster.species];
  const displayName = generateMonsterName(monster.species, monster.element, monster.class);
  
  if (compact) {
    return (
      <Card className="p-3 space-y-2">
        <div className="flex items-center gap-3">
          <MonsterSprite 
            species={monster.species}
            element={monster.element}
            classType={monster.class}
            size={48}
            animated={false}
          />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{displayName}</h3>
            <p className="text-xs text-muted-foreground">
              Lv.{monster.level} {speciesData.name}
            </p>
          </div>
          <span className={`element-badge element-${monster.element} text-[10px]`}>
            {monster.element}
          </span>
        </div>
        
        {/* Health and Stamina bars */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-6">HP</span>
            <Progress 
              value={(monster.stats.currentHp / monster.stats.maxHp) * 100} 
              className="h-2 flex-1"
            />
            <span className="text-[10px] font-mono">
              {monster.stats.currentHp}/{monster.stats.maxHp}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-6">STA</span>
            <Progress 
              value={(monster.stats.currentStamina / monster.stats.stamina) * 100} 
              className="h-2 flex-1 [&>div]:bg-stat-special"
            />
            <span className="text-[10px] font-mono">
              {monster.stats.currentStamina}/{monster.stats.stamina}
            </span>
          </div>
        </div>
      </Card>
    );
  }
  
  return (
    <Card className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start gap-4">
        <MonsterSprite 
          species={monster.species}
          element={monster.element}
          classType={monster.class}
          size={80}
        />
        <div className="flex-1">
          <h2 className="text-lg font-bold">{displayName}</h2>
          <p className="text-sm text-muted-foreground mb-1">
            Level {monster.level} {speciesData.name}
          </p>
          <div className="flex gap-2">
            <span className={`element-badge element-${monster.element} text-xs`}>
              {monster.element}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-muted text-xs">
              {monster.class}
            </span>
          </div>
          
          {/* XP bar */}
          <div className="mt-2">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
              <span>Experience</span>
              <span>{monster.experience}/{monster.experienceToNext}</span>
            </div>
            <Progress 
              value={(monster.experience / monster.experienceToNext) * 100}
              className="h-1.5"
            />
          </div>
        </div>
      </div>
      
      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <StatBar stat="maxHp" value={monster.stats.maxHp} />
        <StatBar stat="stamina" value={monster.stats.stamina} />
        <StatBar stat="melee" value={monster.stats.melee} />
        <StatBar stat="ranged" value={monster.stats.ranged} />
        <StatBar stat="defense" value={monster.stats.defense} />
        <StatBar stat="dexterity" value={monster.stats.dexterity} />
        <StatBar stat="speed" value={monster.stats.speed} />
      </div>
      
      {/* Passive ability */}
      <div className="bg-muted/50 rounded p-2">
        <p className="text-xs font-semibold text-primary">{speciesData.passiveAbility}</p>
        <p className="text-[10px] text-muted-foreground">{speciesData.passiveDescription}</p>
      </div>
      
      {/* Equipment slots */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase">Equipment</h4>
        <div className="grid grid-cols-2 gap-2">
          <EquipmentSlotDisplay slot="armor" item={monster.equipment.armor} label="Armor" />
          <EquipmentSlotDisplay slot="boots" item={monster.equipment.boots} label="Boots" />
          <EquipmentSlotDisplay slot="mainHand" item={monster.equipment.mainHand} label="Main Hand" />
          <EquipmentSlotDisplay slot="offHand" item={monster.equipment.offHand} label="Off Hand" />
        </div>
      </div>
    </Card>
  );
}

// Factory function to create a full monster from basic monster
export function createFullMonster(
  species: Monster['species'],
  classType: ClassType,
  element: ElementType,
  level: number = 1
): FullMonster {
  const speciesData = SPECIES_DATA[species];
  
  // Class stat modifiers
  const classModifiers: Record<ClassType, Partial<ExpandedStats>> = {
    kinetic: { melee: 8, ranged: 2, defense: 5, dexterity: 3, speed: 4, stamina: 5 },
    energy: { melee: 2, ranged: 8, defense: 2, dexterity: 5, speed: 6, stamina: 8 },
    biological: { melee: 4, ranged: 4, defense: 6, dexterity: 4, speed: 3, stamina: 10 },
    chemical: { melee: 3, ranged: 6, defense: 3, dexterity: 6, speed: 5, stamina: 8 },
    political: { melee: 2, ranged: 3, defense: 7, dexterity: 5, speed: 4, stamina: 10 },
  };
  
  const classMod = classModifiers[classType];
  const levelMult = 1 + (level - 1) * 0.12;
  
  const baseHp = speciesData.baseStats.hp;
  const baseAttack = speciesData.baseStats.attack;
  const baseDefense = speciesData.baseStats.defense;
  const baseSpeed = speciesData.baseStats.speed;
  const baseSpecial = speciesData.baseStats.special;
  
  const maxHp = Math.floor((baseHp + 20) * levelMult);
  const stamina = Math.floor((baseSpecial + (classMod.stamina || 5)) * levelMult);
  
  const stats: ExpandedStats = {
    maxHp,
    currentHp: maxHp,
    melee: Math.floor((baseAttack + (classMod.melee || 5)) * levelMult),
    ranged: Math.floor((baseSpecial * 0.5 + (classMod.ranged || 5)) * levelMult),
    defense: Math.floor((baseDefense + (classMod.defense || 5)) * levelMult),
    dexterity: Math.floor((baseSpeed * 0.6 + (classMod.dexterity || 5)) * levelMult),
    speed: Math.floor((baseSpeed + (classMod.speed || 5)) * levelMult),
    stamina,
    currentStamina: stamina,
  };
  
  return {
    id: Math.random().toString(36).substring(2, 9),
    species,
    class: classType,
    element,
    level,
    name: generateMonsterName(species, element, classType),
    stats,
    equipment: {
      armor: null,
      mainHand: null,
      offHand: null,
      boots: null,
    },
    experience: 0,
    experienceToNext: 100 * level,
  };
}