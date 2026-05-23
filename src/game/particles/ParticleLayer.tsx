// Mounts inside the dungeon/overworld grid container at the same tile-pixel
// scale as the tiles themselves. Subscribes to particle events and animates
// active effects via rAF, recycling DOM nodes per particle.

import { useEffect, useRef, useState } from 'react';
import { subscribeParticles, type Surface, type ParticleEmitRequest } from './api';
import { getTemplate } from './registry';
import { MOTIONS } from './motions';
import { ParticleGlyph } from './ParticleGlyph';
import { ELEMENT_COLORS } from '../types';

interface Props {
  surface: Surface;
  tileSize: number;
  /** Optional offset that's subtracted from incoming tile coords before pixel
   *  conversion. Use for overworld where the grid container shows a window
   *  centred on the player. Dungeon leaves this at {0,0}. */
  originWorld?: { x: number; y: number };
}

interface ActiveEffect extends ParticleEmitRequest {
  resolvedColor: string;
  pxFrom: { x: number; y: number };
  pxTo: { x: number; y: number };
  pxAffected: { x: number; y: number }[];
}

const HSL = (raw: string) => `hsl(${raw})`;

function resolveColor(req: ParticleEmitRequest): string {
  const tpl = getTemplate(req.effect.templateId);
  const wanted = req.effect.colorOverride ?? tpl?.color ?? 'auto';
  if (wanted !== 'auto' && wanted !== 'auto:element') return wanted;
  const el = req.monster?.element ?? 'normal';
  return HSL(ELEMENT_COLORS[el].primary);
}

function toPx(tile: { x: number; y: number }, tileSize: number, origin: { x: number; y: number }) {
  return { x: (tile.x - origin.x) * tileSize + tileSize / 2, y: (tile.y - origin.y) * tileSize + tileSize / 2 };
}

export function ParticleLayer({ surface, tileSize }: Props) {
  const [active, setActive] = useState<ActiveEffect[]>([]);
  const activeRef = useRef<ActiveEffect[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const tileSizeRef = useRef(tileSize);
  tileSizeRef.current = tileSize;

  // Subscribe to particle events.
  useEffect(() => {
    const off = subscribeParticles((req) => {
      if (req.surface !== surface) return;
      const ts = tileSizeRef.current;
      const eff: ActiveEffect = {
        ...req,
        resolvedColor: resolveColor(req),
        pxFrom: toPx(req.from, ts),
        pxTo: toPx(req.to, ts),
        pxAffected: (req.affected ?? [req.to]).map((p) => toPx(p, ts)),
      };
      activeRef.current = [...activeRef.current, eff];
      setActive(activeRef.current);
      // Auto-purge after duration.
      const dur = req.effect.duration ?? 600;
      setTimeout(() => {
        activeRef.current = activeRef.current.filter((e) => e.id !== req.id);
        setActive(activeRef.current);
      }, dur + 50);
    });
    return () => { off(); };
  }, [surface]);

  // rAF loop drives transform updates on the DOM particle nodes.
  useEffect(() => {
    let raf = 0;
    const tick = (now: number) => {
      const container = containerRef.current;
      if (container) {
        for (const eff of activeRef.current) {
          const elapsed = now - eff.startedAt;
          const dur = eff.effect.duration ?? 600;
          const t = Math.min(1, elapsed / dur);
          const motion = MOTIONS[eff.effect.motion] ?? MOTIONS.projectile;
          const tpl = getTemplate(eff.effect.templateId);
          const count = eff.effect.count ?? 18;
          const jitter = eff.effect.jitter ?? 0.3;
          const baseSize = (tpl?.size ?? 6) * (tileSizeRef.current / 32);
          const nodes = container.querySelectorAll<HTMLElement>(`[data-fx="${eff.id}"] > div`);
          if (nodes.length === 0) continue;
          for (let i = 0; i < nodes.length; i++) {
            const frame = motion(t, i, {
              fromPx: eff.pxFrom,
              toPx: eff.pxTo,
              affectedPx: eff.pxAffected,
              tileSize: tileSizeRef.current,
              count,
              jitter,
              rngSeed: eff.id,
            });
            const n = nodes[i];
            n.style.transform = `translate(${frame.x - baseSize / 2}px, ${frame.y - baseSize / 2}px) rotate(${frame.rotate}deg) scale(${frame.scale})`;
            n.style.opacity = String(frame.opacity);
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (active.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 50, overflow: 'visible' }}
    >
      {active.map((eff) => {
        const tpl = getTemplate(eff.effect.templateId);
        if (!tpl) return null;
        const count = eff.effect.count ?? 18;
        const baseSize = (tpl.size ?? 6) * (tileSize / 32);
        const colorTpl: typeof tpl = { ...tpl, color: eff.resolvedColor };
        return (
          <div key={eff.id} data-fx={eff.id} className="absolute inset-0">
            {Array.from({ length: count }).map((_, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: baseSize,
                  height: baseSize,
                  willChange: 'transform, opacity',
                  filter: `drop-shadow(0 0 ${Math.max(1, baseSize * 0.3)}px ${eff.resolvedColor})`,
                }}
              >
                <ParticleGlyph template={colorTpl} color={eff.resolvedColor} size={baseSize} />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
