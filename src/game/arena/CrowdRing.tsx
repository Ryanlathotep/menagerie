/**
 * Ring of non-combat spectator monsters around the arena. Each spectator is
 * a species emoji on a chip; a gentle CSS wiggle plays constantly, and a
 * `cheer` prop briefly boosts scale for crit events.
 */
import { useMemo } from 'react';
import type { SpeciesType } from '@/game/types';
import { SPECIES_DATA } from '@/game/types';

interface CrowdRingProps {
  count: number;
  cheer?: boolean;
  species?: SpeciesType[];
}

const SPECIES_EMOJI: Record<SpeciesType, string> = {
  slime: '🟢', skeleton: '💀', goblin: '👺', mushroom: '🍄', ghost: '👻',
  imp: '😈', golem: '🗿', wisp: '🌟', chimera: '🐲', dragon: '🐉',
  rat: '🐀', spider: '🕷️', bat: '🦇', snake: '🐍', wolf: '🐺',
  beetle: '🪲', crow: '🐦‍⬛', shark: '🦈', frog: '🐸', jellyfish: '🪼',
};

export function CrowdRing({ count, cheer, species }: CrowdRingProps) {
  const seats = useMemo(() => {
    const src = species && species.length ? species : (Object.keys(SPECIES_DATA) as SpeciesType[]);
    const out: SpeciesType[] = [];
    for (let i = 0; i < count; i++) out.push(src[i % src.length]);
    return out;
  }, [count, species]);

  return (
    <div className="pointer-events-none absolute inset-0">
      {seats.map((sp, i) => {
        const angle = (i / seats.length) * Math.PI * 2;
        const rx = 47, ry = 32;
        const x = 50 + Math.cos(angle) * rx;
        const y = 50 + Math.sin(angle) * ry;
        const delay = (i * 137) % 900;
        return (
          <div
            key={i}
            className={`absolute select-none text-lg ${cheer ? 'arena-cheer' : 'arena-wiggle'}`}
            style={{
              left: `${x}%`, top: `${y}%`,
              transform: 'translate(-50%, -50%)',
              animationDelay: `${delay}ms`,
              filter: 'drop-shadow(0 1px 0 rgba(0,0,0,0.3))',
            }}
            title={SPECIES_DATA[sp].name}
          >
            {SPECIES_EMOJI[sp]}
          </div>
        );
      })}
      <style>{`
        @keyframes arena-wiggle {
          0%, 100% { transform: translate(-50%, -50%) rotate(-3deg); }
          50% { transform: translate(-50%, -55%) rotate(3deg); }
        }
        @keyframes arena-cheer {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -65%) scale(1.35); }
        }
        .arena-wiggle { animation: arena-wiggle 1.8s ease-in-out infinite; }
        .arena-cheer  { animation: arena-cheer 0.55s ease-out; }
      `}</style>
    </div>
  );
}
