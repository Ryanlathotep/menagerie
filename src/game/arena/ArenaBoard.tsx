/**
 * Renders the arena board using the SAME dungeon tile art (FloorTile / WallTile /
 * DoorTile / TrapTile / TreasureTile / StairsTile) and the SAME MonsterSprite
 * renderer used everywhere else in the game, so the arena reads visually as part
 * of the world instead of a separate mini-game.
 *
 * Layout comes from the replay: `gridWidth`/`gridHeight` (24×24 by default) plus
 * `features` painted in the admin Room Editor.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ArenaReplay, ArenaReplayFeature } from './types';
import {
  FloorTile, WallTile, DoorTile, TrapTile, TreasureTile, StairsTile, StairsUpTile,
} from '@/game/TileGraphics';
import { MonsterSprite } from '@/game/sprites';
import { CrowdRing } from './CrowdRing';
import { getRoom } from './arenaRooms';
import type { SpeciesType, ElementType, ClassType } from '@/game/types';

interface ArenaBoardProps {
  replay: ArenaReplay;
  currentEventIndex: number;
  width?: number;
  height?: number;
}

export function ArenaBoard({ replay, currentEventIndex, width, height }: ArenaBoardProps) {
  const room = getRoom(replay.roomId);
  const gw = width ?? replay.gridWidth ?? 24;
  const gh = height ?? replay.gridHeight ?? 24;

  const state = useMemo(
    () => rebuildState(replay, currentEventIndex, gw, gh),
    [replay, currentEventIndex, gw, gh],
  );
  const currentEvent = replay.log[currentEventIndex];
  const cheer = !!currentEvent?.crit;

  // +2 in each dimension so the tile floor is framed by a wall ring.
  const framedW = gw + 2;
  const framedH = gh + 2;

  // Responsive cell size — the whole board scales to the container width.
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [cell, setCell] = useState(18);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      const next = Math.max(6, Math.floor(Math.min(w / (framedW + 2), h / (framedH + 1))));
      setCell(prev => (prev === next ? prev : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [framedW, framedH]);

  const featureMap = useMemo(() => {
    const m = new Map<string, ArenaReplayFeature['kind']>();
    for (const f of replay.features ?? []) m.set(`${f.x},${f.y}`, f.kind);
    return m;
  }, [replay.features]);

  return (
    <div
      ref={wrapRef}
      className="relative w-full max-w-3xl mx-auto rounded-lg overflow-hidden border-2 border-amber-900/40"
      style={{ background: 'hsl(40 30% 92%)', aspectRatio: `${framedW + 4} / ${framedH + 3}` }}
    >
      {/* Spectator crowd sits behind/around the arena floor */}
      <CrowdRing count={room.crowdDensity} cheer={cheer} species={room.crowdSpecies} />

      {/* Tile floor + wall frame */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${framedW}, ${cell}px)`,
            gridAutoRows: `${cell}px`,
          }}
        >
          {Array.from({ length: framedH }).map((_, ry) =>
            Array.from({ length: framedW }).map((__, rx) => {
              const isBorder = rx === 0 || ry === 0 || rx === framedW - 1 || ry === framedH - 1;
              const seed = rx * 31 + ry * 17 + replay.seed;
              const kind = isBorder ? 'wall' : featureMap.get(`${rx - 1},${ry - 1}`);
              return (
                <div key={`${rx}-${ry}`} className="relative" style={{ width: cell, height: cell }}>
                  <FloorTile size={cell} seed={seed} />
                  {kind && (
                    <div className="absolute inset-0">
                      <FeatureTile kind={kind} size={cell} seed={seed} />
                    </div>
                  )}
                </div>
              );
            }),
          )}
        </div>

        {/* Combatant overlay layered on top of the tile grid */}
        <div
          className="absolute pointer-events-none"
          style={{ left: cell, top: cell, width: cell * gw, height: cell * gh }}
        >
          {state.combatants.map((c) => {
            const critHere = cheer && currentEvent?.targetId === c.id;
            const hpFrac = Math.max(0, c.hp / Math.max(1, c.maxHp));
            const hpColor =
              hpFrac > 0.5 ? 'hsl(120 60% 42%)' : hpFrac > 0.2 ? 'hsl(45 90% 45%)' : 'hsl(0 70% 50%)';
            return (
              <div
                key={c.id}
                className="absolute transition-all duration-200 flex flex-col items-center"
                style={{
                  left: c.x * cell,
                  top: c.y * cell,
                  width: cell,
                  height: cell,
                  opacity: c.hp > 0 ? 1 : 0.25,
                }}
              >
                {/* Team-colored floor plate under the sprite */}
                <div
                  className="absolute inset-0.5 rounded-full"
                  style={{
                    background:
                      c.team === 'A'
                        ? 'radial-gradient(circle, hsl(210 70% 55% / 0.35), transparent 70%)'
                        : 'radial-gradient(circle, hsl(0 70% 55% / 0.35), transparent 70%)',
                  }}
                />
                <div
                  className="relative"
                  style={{
                    transform: c.team === 'B' ? 'scaleX(-1)' : undefined,
                    filter: critHere ? 'drop-shadow(0 0 6px hsl(45 100% 60%))' : undefined,
                  }}
                >
                  <MonsterSprite
                    species={c.species}
                    element={c.element}
                    classType={c.classType}
                    size={Math.max(8, cell - 3)}
                    animated={false}
                  />
                </div>
                {/* HP bar */}
                <div
                  className="absolute left-0.5 right-0.5 rounded-sm overflow-hidden border border-black/40"
                  style={{ bottom: -2, height: 3, background: 'hsl(0 0% 15% / 0.5)' }}
                >
                  <div
                    className="h-full transition-all"
                    style={{ width: `${hpFrac * 100}%`, background: hpColor }}
                  />
                </div>
                {critHere && (
                  <div
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{ boxShadow: '0 0 0 3px hsl(45 100% 60%)', animation: 'arena-crit-pulse 0.55s ease-out' }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="absolute left-2 bottom-1 text-[10px] text-amber-900/70">
        {gw}×{gh}{replay.layoutName ? ` · ${replay.layoutName}` : ''}
      </div>

      <style>{`
        @keyframes arena-crit-pulse {
          0%   { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.4); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function FeatureTile({ kind, size, seed }: { kind: ArenaReplayFeature['kind']; size: number; seed: number }) {
  switch (kind) {
    case 'wall': return <WallTile size={size} seed={seed} />;
    case 'door': return <DoorTile size={size} seed={seed} />;
    case 'chest': return <TreasureTile size={size} seed={seed} />;
    case 'stairs_down': return <StairsTile size={size} seed={seed} />;
    case 'stairs_up': return <StairsUpTile size={size} seed={seed} />;
    case 'trap_spike': return <TrapTile size={size} seed={seed} trapType="spike" />;
    case 'trap_dart': return <TrapTile size={size} seed={seed} trapType="dart" />;
    case 'box':
    case 'lever':
    default:
      return (
        <div className="w-full h-full flex items-center justify-center" style={{ fontSize: Math.max(7, size * 0.6) }}>
          {kind === 'box' ? '📦' : '🎚️'}
        </div>
      );
  }
}

interface CBState {
  id: string;
  x: number;
  y: number;
  team: 'A' | 'B';
  hp: number;
  maxHp: number;
  species: SpeciesType;
  element: ElementType;
  classType: ClassType;
}

function rebuildState(
  replay: ArenaReplay,
  upto: number,
  w: number,
  h: number,
): { combatants: CBState[] } {
  const lookup = (id: string) =>
    [...replay.teamA.monsters, ...replay.teamB.monsters].find((m) => m.id === id);

  const combatants: CBState[] = [];
  const yStartA = Math.floor((h - replay.teamA.monsters.length) / 2);
  const yStartB = Math.floor((h - replay.teamB.monsters.length) / 2);

  replay.teamA.monsters.forEach((m, i) =>
    combatants.push({
      id: m.id,
      x: 0,
      y: yStartA + i,
      team: 'A',
      hp: m.maxHp,
      maxHp: m.maxHp,
      species: m.species,
      element: m.element,
      classType: m.classType,
    }),
  );
  replay.teamB.monsters.forEach((m, i) =>
    combatants.push({
      id: m.id,
      x: w - 1,
      y: yStartB + i,
      team: 'B',
      hp: m.maxHp,
      maxHp: m.maxHp,
      species: m.species,
      element: m.element,
      classType: m.classType,
    }),
  );

  for (let i = 0; i <= upto && i < replay.log.length; i++) {
    const ev = replay.log[i];
    const actor = combatants.find((c) => c.id === ev.actorId);
    if (actor) {
      actor.x = ev.toX;
      actor.y = ev.toY;
    }
    for (const [id, hp] of Object.entries(ev.hpAfter)) {
      const c = combatants.find((x) => x.id === id);
      if (c) {
        c.hp = hp;
        // Keep species/element/class in case log referenced something new
        const src = lookup(id);
        if (src) {
          c.species = src.species;
          c.element = src.element;
          c.classType = src.classType;
        }
      }
    }
  }
  return { combatants };
}
