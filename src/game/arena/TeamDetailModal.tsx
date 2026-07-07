/**
 * TeamDetailModal — full roster inspector for an arena team.
 *
 * Opens from clicking any team name in the Bets tab (or Tournaments tab).
 * Hydrates the team the exact same way combat does — via hydrateNpcTeam for
 * NPC rosters, or via unlockedMonsters lookup for player-saved teams — and
 * shows each member's sprite, level, full stat block, equipped gear, and the
 * learned moves that member will actually pick from during a match.
 */
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X } from 'lucide-react';
import type { ArenaTeam } from './types';
import type { Monster, EquipmentSlot } from '@/game/types';
import { SPECIES_DATA } from '@/game/types';
import { MonsterSprite } from '@/game/sprites';
import { EquipmentIcon } from '@/game/EquipmentIcon';
import { getMonsterMoves } from '@/game/moves';
import { hydrateNpcTeam, isNpcTeam } from './npcTeams';
import { useGame } from '@/game/state';
import { createMonster } from '@/game/utils';

interface TeamDetailModalProps {
  team: ArenaTeam;
  targetLevel?: number;
  onClose: () => void;
}

const EQUIP_SLOT_ORDER: EquipmentSlot[] = [
  'helmet', 'armor', 'gloves', 'boots', 'mainHand', 'offHand', 'accessory', 'back',
];

export function TeamDetailModal({ team, targetLevel, onClose }: TeamDetailModalProps) {
  const { state } = useGame();
  const unlocked = state.saveData?.unlockedMonsters ?? [];
  const level = targetLevel ?? team.level ?? 10;

  const members: Monster[] = isNpcTeam(team.id.replace(/_dup\d+$/, ''))
    ? hydrateNpcTeam({ ...team, id: team.id.replace(/_dup\d+$/, '') }, level)
    : team.memberCombos.slice(0, 6).map((combo) => {
        const u = unlocked.find((x) => x.comboId === combo);
        if (u) {
          return createMonster(
            u.species, u.classType, u.element, Math.max(5, u.level),
            u.equipment, u.experience, u.moveMastery,
          );
        }
        const [species, element, classType] = combo.split('_') as any;
        return createMonster(species, classType, element, level);
      });

  return (
    <div
      className="fixed inset-0 bg-background/70 backdrop-blur-sm z-[60] flex items-center justify-center p-2"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-3xl h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3 border-b flex items-center justify-between bg-gradient-to-r from-amber-500/10 to-red-500/10">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <span className="text-xl">{team.banner ?? '⭐'}</span>
              {team.name}
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {members.length} monsters · avg L{team.level}
              {team.strategyId ? ` · AI: ${team.strategyId}` : ''}
            </p>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-3">
            {members.map((m) => (
              <MemberRow key={m.id} monster={m} />
            ))}
            {members.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                This team has no valid members.
              </p>
            )}
          </div>
        </ScrollArea>
      </Card>
    </div>
  );
}

function MemberRow({ monster }: { monster: Monster }) {
  const moves = getMonsterMoves(monster.species, monster.element, monster.class, monster.level);
  const speciesName = SPECIES_DATA[monster.species]?.name ?? monster.species;
  const equipEntries: [EquipmentSlot, any][] = monster.equipment
    ? (EQUIP_SLOT_ORDER
        .map((s) => [s, (monster.equipment as any)?.[s]] as [EquipmentSlot, any])
        .filter(([, v]) => !!v))
    : [];

  return (
    <Card className="p-3">
      <div className="flex gap-3">
        <div className="shrink-0">
          <MonsterSprite
            species={monster.species}
            element={monster.element}
            classType={monster.class}
            size={72}
            animated={false}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-semibold text-sm capitalize">{monster.name}</span>
            <span className="text-[11px] text-muted-foreground">
              L{monster.level} · {monster.element} {monster.class} {speciesName}
            </span>
          </div>

          {/* Stat block */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-1 text-[11px] mt-1">
            <Stat label="HP"  value={`${monster.stats.currentHp}/${monster.stats.maxHp}`} />
            <Stat label="ATK" value={monster.stats.attack} />
            <Stat label="DEF" value={monster.stats.defense} />
            <Stat label="SPD" value={monster.stats.speed} />
            <Stat label="SPE" value={monster.stats.special} />
            <Stat label="STA" value={`${monster.stats.currentStamina}/${monster.stats.stamina}`} />
          </div>

          {/* Equipment row */}
          {equipEntries.length > 0 ? (
            <div className="mt-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Equipment</p>
              <div className="flex flex-wrap gap-1.5">
                {equipEntries.map(([slot, item]) => (
                  <div
                    key={slot}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-border/60 bg-muted/30 text-[11px]"
                    title={`${slot}: ${item.name}`}
                  >
                    <EquipmentIcon item={item} size={16} />
                    <span className="truncate max-w-[110px]">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground italic mt-1">No equipment</p>
          )}
        </div>
      </div>

      {/* Moves list */}
      <div className="mt-2">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
          Learned moves ({moves.length})
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
          {moves.map((mv) => (
            <div
              key={mv.id}
              className="text-[11px] px-2 py-1 rounded border border-border/60 bg-background/50 flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{mv.name}</div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {mv.element ?? '—'}{mv.classBonus ? ` · ${mv.classBonus}` : ''}
                  {mv.type ? ` · ${mv.type}` : ''}
                </div>
              </div>
              <div className="shrink-0 text-right text-[10px]">
                {typeof mv.power === 'number' && mv.power > 0 && <div>⚔ {mv.power}</div>}
                {typeof mv.staminaCost === 'number' && <div className="text-amber-500">⚡ {mv.staminaCost}</div>}
              </div>
            </div>
          ))}
          {moves.length === 0 && (
            <p className="text-[11px] text-muted-foreground italic">No moves learned.</p>
          )}
        </div>
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-border/60 bg-muted/20 px-1 py-0.5 text-center">
      <div className="text-[9px] text-muted-foreground">{label}</div>
      <div className="font-mono">{value}</div>
    </div>
  );
}
