/**
 * Ring of spectator monsters around the arena. Uses the real MonsterSpriteSmall
 * renderer and, when possible, pulls species/element pairs from the player's
 * own unlockedMonsters catalog so the audience is made of "real" characters the
 * player has actually met.
 */
import { useMemo } from 'react';
import type { SpeciesType, ElementType } from '@/game/types';
import { SPECIES_DATA } from '@/game/types';
import { MonsterSpriteSmall } from '@/game/sprites';
import { useGame } from '@/game/state';

interface CrowdRingProps {
  count: number;
  cheer?: boolean;
  species?: SpeciesType[];
}

interface Seat {
  species: SpeciesType;
  element: ElementType;
}

const ELEMENTS: ElementType[] = ['normal', 'fire', 'water', 'earth', 'air', 'void'];

export function CrowdRing({ count, cheer, species }: CrowdRingProps) {
  const { state } = useGame();

  const seats: Seat[] = useMemo(() => {
    const out: Seat[] = [];
    const unlocked = state.saveData?.unlockedMonsters ?? [];
    // Prefer the player's own catalog (dedup by species+element) so the
    // audience is populated by monsters they've actually seen.
    const seen = new Set<string>();
    for (const u of unlocked) {
      const key = `${u.species}_${u.element}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ species: u.species, element: u.element });
      if (out.length >= count) break;
    }
    // Pad with the room's biased species list (or all species) if we still
    // don't have enough characters.
    if (out.length < count) {
      const pool = species && species.length ? species : (Object.keys(SPECIES_DATA) as SpeciesType[]);
      let i = 0;
      while (out.length < count) {
        out.push({ species: pool[i % pool.length], element: ELEMENTS[i % ELEMENTS.length] });
        i++;
      }
    }
    return out;
  }, [count, species, state.saveData?.unlockedMonsters]);

  return (
    <div className="pointer-events-none absolute inset-0">
      {seats.map((seat, i) => {
        const angle = (i / seats.length) * Math.PI * 2;
        const rx = 47;
        const ry = 40;
        const x = 50 + Math.cos(angle) * rx;
        const y = 50 + Math.sin(angle) * ry;
        const delay = (i * 137) % 900;
        return (
          <div
            key={i}
            className={`absolute select-none ${cheer ? 'arena-cheer' : 'arena-wiggle'}`}
            style={{
              left: `${x}%`,
              top: `${y}%`,
              transform: 'translate(-50%, -50%)',
              animationDelay: `${delay}ms`,
              filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.4))',
            }}
            title={`${SPECIES_DATA[seat.species].name} · ${seat.element}`}
          >
            <MonsterSpriteSmall species={seat.species} element={seat.element} size={22} />
          </div>
        );
      })}
      <style>{`
        @keyframes arena-wiggle {
          0%, 100% { transform: translate(-50%, -50%) rotate(-3deg); }
          50%      { transform: translate(-50%, -55%) rotate(3deg); }
        }
        @keyframes arena-cheer {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50%      { transform: translate(-50%, -65%) scale(1.35); }
        }
        .arena-wiggle { animation: arena-wiggle 1.8s ease-in-out infinite; }
        .arena-cheer  { animation: arena-cheer 0.55s ease-out; }
      `}</style>
    </div>
  );
}
