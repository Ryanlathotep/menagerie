// Overlay that draws compass-style arrows on the edge of the overworld
// viewport pointing toward off-screen points of interest:
//   • the player's home / starter town (homeBase position)
//   • the home Tower of the Infinite
//   • all major themed dungeon towers (element / class / species)
//
// Each arrow shows distance in tiles. Targets that fall inside the visible
// VIEW_RANGE of the renderer are not drawn (they're already on screen).

import { useEffect, useRef, useState } from 'react';
import { OverworldState } from './overworld';
import { DungeonEntrance } from './types';

// Must mirror the constants in OverworldRenderer.tsx
const VIEW_RANGE = 8;

export interface ArrowToggles {
  home: boolean;
  homeTower: boolean;
  majorDungeons: boolean;
  // Per-dungeon waypoint pins (id → enabled). Used for procedural / "minor"
  // dungeons that don't fall under the major-towers toggle.
  dungeonWaypoints?: Record<string, boolean>;
}

interface Props {
  overworld: OverworldState;
  toggles: ArrowToggles;
}

interface Target {
  key: string;
  x: number;
  y: number;
  label: string;
  icon: string;
  // Tailwind color classes for the arrow body / glow
  colorClass: string;
}

const ELEMENT_EMOJI: Record<string, string> = {
  fire: '🔥', water: '💧', earth: '🌿', air: '💨', void: '🌑', normal: '⚪',
};
const CLASS_EMOJI: Record<string, string> = {
  normal: '⚪', kinetic: '💥', energy: '⚡', biological: '🌱',
  chemical: '🧪', political: '👑',
};
const SPECIES_EMOJI: Record<string, string> = {
  slime: '🟢', skeleton: '💀', goblin: '👺', mushroom: '🍄', ghost: '👻',
  imp: '😈', golem: '🗿', wisp: '✨', chimera: '🦁', dragon: '🐉',
  rat: '🐀', spider: '🕷️', bat: '🦇', snake: '🐍', wolf: '🐺',
  beetle: '🪲', crow: '🐦‍⬛', shark: '🦈', frog: '🐸', jellyfish: '🪼',
};

function dungeonIcon(d: DungeonEntrance): string {
  if (d.isHome) return '🗼';
  if (d.theme?.kind === 'element' && d.theme.value) return ELEMENT_EMOJI[d.theme.value as string] || '✨';
  if (d.theme?.kind === 'class' && d.theme.value) return CLASS_EMOJI[d.theme.value as string] || '⚔️';
  if (d.theme?.kind === 'species' && d.theme.value) return SPECIES_EMOJI[d.theme.value as string] || '🐾';
  return '🏰';
}

export function OverworldDirectionArrows({ overworld, toggles }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  // Track the actual rendered size so the arrows snap to the true edge,
  // independent of zoom or sidebar resize.
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const update = () => {
      const r = el.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const px = overworld.playerPosition.x;
  const py = overworld.playerPosition.y;

  // Build the active target list from toggles
  const targets: Target[] = [];

  if (toggles.home) {
    targets.push({
      key: 'home',
      x: overworld.homeBase.position.x,
      y: overworld.homeBase.position.y,
      label: 'Home',
      icon: '🏠',
      colorClass: 'text-amber-400 bg-amber-500/15 border-amber-400/60',
    });
  }

  const dungeons = Object.values(overworld.dungeonEntrances || {});

  if (toggles.homeTower) {
    const homeTower = dungeons.find(d => d.isHome);
    if (homeTower) {
      targets.push({
        key: homeTower.id,
        x: homeTower.worldX,
        y: homeTower.worldY,
        label: homeTower.name || 'Tower of the Infinite',
        icon: '🗼',
        colorClass: 'text-violet-300 bg-violet-500/15 border-violet-400/60',
      });
    }
  }

  if (toggles.majorDungeons) {
    for (const d of dungeons) {
      if (d.isHome) continue;
      // Major = themed towers (element / class / species). Skip procedural.
      if (!d.category || d.category === 'procedural') continue;
      targets.push({
        key: d.id,
        x: d.worldX,
        y: d.worldY,
        label: d.name || 'Dungeon',
        icon: dungeonIcon(d),
        colorClass: 'text-sky-300 bg-sky-500/15 border-sky-400/60',
      });
    }
  }

  // No work to do
  const hasWork = targets.length > 0 && size.w > 0 && size.h > 0;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none z-20"
      aria-hidden
    >
      {hasWork && targets.map(t => {
        const dx = t.x - px;
        const dy = t.y - py;
        const dist = Math.abs(dx) + Math.abs(dy); // Manhattan distance in tiles

        // Skip targets that are visible on the map already
        if (Math.abs(dx) <= VIEW_RANGE && Math.abs(dy) <= VIEW_RANGE) return null;
        if (dx === 0 && dy === 0) return null;

        // Project the direction vector onto the rectangle boundary, with
        // a small inset so the arrow card stays fully on screen.
        const cx = size.w / 2;
        const cy = size.h / 2;
        const inset = 36; // px from edge for the card center
        const halfW = Math.max(10, cx - inset);
        const halfH = Math.max(10, cy - inset);

        const angle = Math.atan2(dy, dx); // screen y grows downward, world y too
        // Scale so the vector touches the rectangle edge
        const scale = Math.min(
          halfW / Math.max(0.0001, Math.abs(Math.cos(angle))),
          halfH / Math.max(0.0001, Math.abs(Math.sin(angle))),
        );
        const ex = cx + Math.cos(angle) * scale;
        const ey = cy + Math.sin(angle) * scale;

        // Rotate arrow icon to point outward
        const rotDeg = (angle * 180) / Math.PI;

        return (
          <div
            key={t.key}
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{ left: ex, top: ey }}
          >
            <div
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border backdrop-blur-sm shadow-md text-[10px] font-medium leading-none ${t.colorClass}`}
              title={`${t.label} — ${dist} tiles`}
            >
              <span
                className="inline-block text-[12px] leading-none"
                style={{ transform: `rotate(${rotDeg}deg)` }}
              >
                ➤
              </span>
              <span className="text-base leading-none">{t.icon}</span>
              <span className="tabular-nums opacity-90">{dist}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
