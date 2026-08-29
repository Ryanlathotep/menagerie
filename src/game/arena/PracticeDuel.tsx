/**
 * Practice Duel — free-play 6x6 combat between any two saved teams (or vs a
 * random NPC team). Uses the exact same engine as tournaments; results are
 * NOT persisted as tournament replays and do NOT award tokens.
 */
import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import type { ArenaState, ArenaTeam, ArenaReplay, UnlockedMonster } from './types';
import { getNpcTeams, hydrateNpcTeam } from './npcTeams';
import { runArenaCombat } from '@/game/arenaCombat';
import { createMonster } from '@/game/utils';
import { getAllRooms } from './arenaRooms';
import { resolveStrategy } from './strategyPresets';
import { ArenaReplayPlayer } from './ArenaReplayPlayer';
import { STRATEGY_PRESETS } from './strategyPresets';

type TeamSize = 'solo' | 'duo' | 'trio' | 'full';
const SIZE: Record<TeamSize, number> = { solo: 1, duo: 2, trio: 3, full: 6 };

interface Props {
  arena: ArenaState;
  unlocked: UnlockedMonster[];
}

export function PracticeDuel({ arena, unlocked }: Props) {
  const [size, setSize] = useState<TeamSize>('duo');
  const [teamAId, setTeamAId] = useState<string>('');
  const [opponent, setOpponent] = useState<string>('random_npc');
  const [strategyA, setStrategyA] = useState<string>('balanced');
  const [strategyB, setStrategyB] = useState<string>('balanced');
  const [replay, setReplay] = useState<ArenaReplay | null>(null);

  const teamOptions = arena.playerTeams;
  const npcOptions = getNpcTeams();

  const canRun = !!teamAId;

  const run = () => {
    const teamA = teamOptions.find(t => t.id === teamAId);
    if (!teamA) { toast({ title: 'Pick your team first' }); return; }

    const cap = SIZE[size];
    const membersA = hydratePlayer(teamA, unlocked).slice(0, cap);
    if (membersA.length === 0) { toast({ title: 'Your team has no valid monsters' }); return; }

    let bTeam: ArenaTeam;
    if (opponent === 'random_npc') {
      bTeam = npcOptions[Math.floor(Math.random() * npcOptions.length)];
    } else if (opponent.startsWith('npc:')) {
      bTeam = npcOptions.find(n => n.id === opponent.slice(4))!;
    } else {
      bTeam = teamOptions.find(t => t.id === opponent) ?? npcOptions[0];
    }
    const targetLevel = Math.max(teamA.level, bTeam.level, 5);
    const membersB = (npcOptions.some(n => n.id === bTeam.id)
      ? hydrateNpcTeam(bTeam, targetLevel)
      : hydratePlayer(bTeam, unlocked)).slice(0, cap);

    const seed = Math.floor(Math.random() * 0xffffffff);
    const matchId = `practice_${seed}`;
    const layout = pickLayout(matchId, seed);
    const blockedCells = layout.features
      .filter(f => f.kind === 'wall')
      .map(f => ({ x: f.x, y: f.y }));
    const result = runArenaCombat(
      { id: teamA.id, name: teamA.name, members: membersA, strategy: resolveStrategy(strategyA as any) },
      { id: bTeam.id, name: bTeam.name, members: membersB, strategy: resolveStrategy(strategyB as any) },
      { seed, gridWidth: layout.width, gridHeight: layout.height, blockedCells },
    );

    const rooms = getAllRooms();
    const room = rooms[Math.abs(seed) % rooms.length];
    const serialize = (m: any) => ({ id: m.id, name: m.name, species: m.species, classType: m.class, element: m.element, level: m.level, maxHp: m.stats.maxHp, speed: m.stats.speed });
    const r: ArenaReplay = {
      id: `practice_${Date.now()}`,
      matchId: `practice_${Date.now()}`,
      cadence: 'daily',
      createdAt: Date.now(),
      seed: result.seed,
      teamA: { id: teamA.id, name: teamA.name, monsters: membersA.map(serialize) },
      teamB: { id: bTeam.id, name: bTeam.name, monsters: membersB.map(serialize) },
      log: result.log,
      winner: result.winner,
      turns: result.turns,
      roomId: room.id,
      gridWidth: 24,
      gridHeight: 24,
    };
    setReplay(r);
  };

  if (replay) return <ArenaReplayPlayer replay={replay} onClose={() => setReplay(null)} />;

  return (
    <div className="space-y-3">
      <Card className="p-3 space-y-3">
        <div className="text-sm font-semibold">🥊 Practice Duel</div>
        <p className="text-xs text-muted-foreground">
          Run any saved team through the 24x24 arena engine against an NPC or another saved team. No tokens awarded, no persistence — pure balance testing.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs space-y-1">
            <div>Team size</div>
            <Select value={size} onValueChange={v => setSize(v as TeamSize)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="solo">Solo (1v1)</SelectItem>
                <SelectItem value="duo">Duo (2v2)</SelectItem>
                <SelectItem value="trio">Trio (3v3)</SelectItem>
                <SelectItem value="full">Full (6v6)</SelectItem>
              </SelectContent>
            </Select>
          </label>

          <label className="text-xs space-y-1">
            <div>Your team</div>
            <Select value={teamAId} onValueChange={setTeamAId}>
              <SelectTrigger><SelectValue placeholder="Pick a saved team" /></SelectTrigger>
              <SelectContent>
                {teamOptions.length === 0 && <SelectItem value="__none" disabled>No saved teams</SelectItem>}
                {teamOptions.map(t => <SelectItem key={t.id} value={t.id}>{t.banner} {t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </label>

          <label className="text-xs space-y-1">
            <div>Opponent</div>
            <Select value={opponent} onValueChange={setOpponent}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="random_npc">🎲 Random NPC</SelectItem>
                {npcOptions.map(n => <SelectItem key={n.id} value={`npc:${n.id}`}>{n.banner} {n.name}</SelectItem>)}
                {teamOptions.filter(t => t.id !== teamAId).map(t => <SelectItem key={t.id} value={t.id}>{t.banner} {t.name} (yours)</SelectItem>)}
              </SelectContent>
            </Select>
          </label>

          <div className="grid grid-cols-2 gap-2 col-span-2">
            <label className="text-xs space-y-1">
              <div>Your strategy</div>
              <Select value={strategyA} onValueChange={setStrategyA}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STRATEGY_PRESETS.map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
            <label className="text-xs space-y-1">
              <div>Opponent strategy</div>
              <Select value={strategyB} onValueChange={setStrategyB}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STRATEGY_PRESETS.map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
          </div>
        </div>

        <Button onClick={run} disabled={!canRun}>Fight!</Button>
      </Card>
    </div>
  );
}

function hydratePlayer(team: ArenaTeam, unlocked: UnlockedMonster[]) {
  const out: any[] = [];
  for (const combo of team.memberCombos) {
    const um = unlocked.find(u => u.comboId === combo);
    if (!um) continue;
    out.push(createMonster(um.species, um.classType, um.element, um.level, undefined, um.experience ?? 0));
  }
  return out;
}
