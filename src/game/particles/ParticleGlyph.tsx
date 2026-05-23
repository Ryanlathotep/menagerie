// Renders a single particle glyph — either a built-in SVG shape or an
// uploaded image. Pure / memoizable.

import type { ParticleTemplate, ParticleShape } from './types';

function ShapeSvg({ shape, color, glow, size }: { shape: ParticleShape; color: string; glow?: string; size: number }) {
  const s = size;
  const g = glow ?? color;
  switch (shape) {
    case 'circle':
      return <svg width={s} height={s} viewBox="-5 -5 10 10"><circle r="4" fill={color} /></svg>;
    case 'spark':
      return (
        <svg width={s} height={s} viewBox="-5 -5 10 10">
          <path d="M0,-5 L1,-1 L5,0 L1,1 L0,5 L-1,1 L-5,0 L-1,-1 Z" fill={color} stroke={g} strokeWidth="0.3" />
        </svg>
      );
    case 'star':
      return (
        <svg width={s} height={s} viewBox="-5 -5 10 10">
          <path d="M0,-5 L1.5,-1.5 L5,-1 L2,1.5 L3,5 L0,3 L-3,5 L-2,1.5 L-5,-1 L-1.5,-1.5 Z" fill={color} />
        </svg>
      );
    case 'diamond':
      return <svg width={s} height={s} viewBox="-5 -5 10 10"><path d="M0,-5 L5,0 L0,5 L-5,0 Z" fill={color} stroke={g} strokeWidth="0.4" /></svg>;
    case 'droplet':
      return <svg width={s} height={s} viewBox="-5 -5 10 10"><path d="M0,-5 Q4,0 0,5 Q-4,0 0,-5 Z" fill={color} /></svg>;
    case 'flame':
      return (
        <svg width={s} height={s} viewBox="-5 -5 10 10">
          <path d="M0,-5 Q3,-2 2,2 Q3,4 0,5 Q-3,4 -2,2 Q-3,-2 0,-5 Z" fill={color} />
          <path d="M0,-2 Q1.5,0 0,3 Q-1.5,0 0,-2 Z" fill={g} opacity="0.7" />
        </svg>
      );
    case 'leaf':
      return <svg width={s} height={s} viewBox="-5 -5 10 10"><path d="M-4,4 Q-4,-4 4,-4 Q4,4 -4,4 Z" fill={color} /></svg>;
    case 'snowflake':
      return (
        <svg width={s} height={s} viewBox="-5 -5 10 10" stroke={color} strokeWidth="0.7" fill="none" strokeLinecap="round">
          <line x1="0" y1="-5" x2="0" y2="5" />
          <line x1="-5" y1="0" x2="5" y2="0" />
          <line x1="-3.5" y1="-3.5" x2="3.5" y2="3.5" />
          <line x1="-3.5" y1="3.5" x2="3.5" y2="-3.5" />
        </svg>
      );
    case 'rune':
      return (
        <svg width={s} height={s} viewBox="-5 -5 10 10" stroke={color} strokeWidth="0.6" fill="none">
          <circle r="4" />
          <path d="M-3,-2 L3,2 M-3,2 L3,-2" />
        </svg>
      );
    case 'bolt':
      return <svg width={s} height={s} viewBox="-5 -5 10 10"><path d="M-1,-5 L2,-1 L0,0 L2,5 L-2,1 L0,0 L-2,-5 Z" fill={color} /></svg>;
    case 'cross':
      return (
        <svg width={s} height={s} viewBox="-5 -5 10 10">
          <rect x="-1" y="-5" width="2" height="10" fill={color} />
          <rect x="-5" y="-1" width="10" height="2" fill={color} />
        </svg>
      );
    case 'ring':
      return <svg width={s} height={s} viewBox="-5 -5 10 10"><circle r="4" fill="none" stroke={color} strokeWidth="0.8" /></svg>;
  }
}

export function ParticleGlyph({ template, color, size }: { template: ParticleTemplate; color: string; size: number }) {
  if (template.imageUrl) {
    return (
      <img
        src={template.imageUrl}
        width={size}
        height={size}
        alt=""
        draggable={false}
        style={{ display: 'block', pointerEvents: 'none', userSelect: 'none' }}
      />
    );
  }
  return <ShapeSvg shape={template.shape} color={color} glow={template.glow} size={size} />;
}
