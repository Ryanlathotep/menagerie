/**
 * Renders the 6x6 arena board inside a stylized oval room. Combatants are
 * shown at their current positions with HP bars; the surrounding crowd
 * cheers on crits.
 */
import { useMemo } from 'react';
import type { ArenaReplay, ReplayEvent } from './types';
import { getRoom } from './arenaRooms';
import { CrowdRing } from './CrowdRing';

interface ArenaBoardProps {
  replay: ArenaReplay;
  currentEventIndex: number;
  width?: number;
  height?: number;
}

const CELL = 46;
const PAD = 20;

export function ArenaBoard({ replay, currentEventIndex, width = 6, height = 6 }: ArenaBoardProps) {
  const room = getRoom(replay.roomId);
  const boardW = CELL * width + PAD * 2;
  const boardH = CELL * height + PAD * 2;

  const state = useMemo(() => rebuildState(replay, currentEventIndex, width, height), [replay, currentEventIndex, width, height]);
  const currentEvent = replay.log[currentEventIndex];
  const cheer = !!currentEvent?.crit;

  return (
    <div className="relative w-full max-w-2xl mx-auto aspect-[7/5] rounded-lg overflow-hidden"
         style={{ background: 'linear-gradient(180deg, hsl(28 45% 88%), hsl(28 35% 78%))' }}>
      {/* Oval floor + rim */}
      <div className="absolute inset-4 rounded-[50%]"
           style={{
             background: `radial-gradient(ellipse at 50% 30%, ${room.floorColor}, ${shade(room.floorColor, -8)})`,
             border: `6px solid ${room.rimColor}`,
             boxShadow: 'inset 0 0 22px rgba(0,0,0,0.15)',
           }} />

      {/* Crowd — sits between the rim and the wall */}
      <CrowdRing count={room.crowdDensity} cheer={cheer} species={room.crowdSpecies} />

      {/* 6x6 combat grid, centered */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
           style={{ width: boardW, height: boardH }}>
        <svg viewBox={`0 0 ${boardW} ${boardH}`} width={boardW} height={boardH}>
          {/* Grid */}
          {Array.from({ length: width }).map((_, x) =>
            Array.from({ length: height }).map((__, y) => (
              <rect key={`${x}-${y}`}
                x={PAD + x * CELL} y={PAD + y * CELL}
                width={CELL} height={CELL}
                fill="none" stroke="hsl(30 20% 30% / 0.12)" strokeWidth={0.6} />
            ))
          )}
          {/* Combatants */}
          {state.combatants.map(c => (
            <g key={c.id}
               transform={`translate(${PAD + c.x * CELL + CELL / 2}, ${PAD + c.y * CELL + CELL / 2})`}>
              <circle r={CELL * 0.36}
                fill={c.team === 'A' ? 'hsl(210 70% 55%)' : 'hsl(0 70% 55%)'}
                opacity={c.hp > 0 ? 0.85 : 0.15}
                stroke="hsl(30 20% 20%)" strokeWidth={0.8} />
              <text y={4} textAnchor="middle" fontSize={14} fontWeight={700}
                fill="white">{c.emoji}</text>
              {/* HP bar */}
              <rect x={-CELL * 0.32} y={-CELL * 0.5} width={CELL * 0.64} height={4}
                fill="hsl(0 0% 20% / 0.4)" />
              <rect x={-CELL * 0.32} y={-CELL * 0.5}
                width={CELL * 0.64 * Math.max(0, c.hp / c.maxHp)} height={4}
                fill={c.hp / c.maxHp > 0.5 ? 'hsl(120 60% 50%)' : c.hp / c.maxHp > 0.2 ? 'hsl(45 90% 55%)' : 'hsl(0 70% 55%)'} />
            </g>
          ))}
          {/* Crit flash */}
          {cheer && currentEvent?.targetId && (() => {
            const t = state.combatants.find(c => c.id === currentEvent.targetId);
            if (!t) return null;
            return (
              <circle
                cx={PAD + t.x * CELL + CELL / 2}
                cy={PAD + t.y * CELL + CELL / 2}
                r={CELL * 0.55}
                fill="none" stroke="hsl(45 100% 60%)" strokeWidth={3}
                opacity={0.85} />
            );
          })()}
        </svg>
      </div>
    </div>
  );
}

interface CBState { id: string; x: number; y: number; team: 'A' | 'B'; hp: number; maxHp: number; emoji: string }

function rebuildState(replay: ArenaReplay, upto: number, w: number, h: number): { combatants: CBState[] } {
  const emojiFor = (id: string): string => {
    const m = [...replay.teamA.monsters, ...replay.teamB.monsters].find(x => x.id === id);
    if (!m) return '?';
    return SPECIES_EMOJI[m.species] ?? '❓';
  };
  const combatants: CBState[] = [];
  const yStartA = Math.floor((h - replay.teamA.monsters.length) / 2);
  const yStartB = Math.floor((h - replay.teamB.monsters.length) / 2);
  replay.teamA.monsters.forEach((m, i) => combatants.push({
    id: m.id, x: 0, y: yStartA + i, team: 'A', hp: m.maxHp, maxHp: m.maxHp, emoji: emojiFor(m.id),
  }));
  replay.teamB.monsters.forEach((m, i) => combatants.push({
    id: m.id, x: w - 1, y: yStartB + i, team: 'B', hp: m.maxHp, maxHp: m.maxHp, emoji: emojiFor(m.id),
  }));
  for (let i = 0; i <= upto && i < replay.log.length; i++) {
    const ev = replay.log[i];
    const actor = combatants.find(c => c.id === ev.actorId);
    if (actor) { actor.x = ev.toX; actor.y = ev.toY; }
    for (const [id, hp] of Object.entries(ev.hpAfter)) {
      const c = combatants.find(x => x.id === id);
      if (c) c.hp = hp;
    }
  }
  return { combatants };
}

// Duplicate the emoji map here to avoid circular imports.
import type { SpeciesType } from '@/game/types';
const SPECIES_EMOJI: Record<SpeciesType, string> = {
  slime: '🟢', skeleton: '💀', goblin: '👺', mushroom: '🍄', ghost: '👻',
  imp: '😈', golem: '🗿', wisp: '🌟', chimera: '🐲', dragon: '🐉',
  rat: '🐀', spider: '🕷️', bat: '🦇', snake: '🐍', wolf: '🐺',
  beetle: '🪲', crow: '🐦‍⬛', shark: '🦈', frog: '🐸', jellyfish: '🪼',
};

function shade(color: string, amt: number): string {
  // crude — assumes hsl(h s% l%)
  const m = color.match(/hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/);
  if (!m) return color;
  const [, h, s, l] = m;
  return `hsl(${h} ${s}% ${Math.max(0, Math.min(100, Number(l) + amt))}%)`;
}
