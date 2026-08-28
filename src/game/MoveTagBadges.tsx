// Shared, single-source-of-truth rendering of every tag a move carries.
//
// Move metadata (type, element, class, targeting pattern, AoE radius, piercing,
// wall penetration, movement, DoT/buff/debuff effect, priority, grapple, trap
// triggering) used to be scattered across ad-hoc badges in each panel, so most
// tags were invisible. `getMoveTags` derives the full list from the move data
// (after `normalizeMoveTags` has repaired it) and `MoveTagBadges` renders it
// identically everywhere: cards, tooltips, tier selectors and the targeting HUD.

import { Badge } from '@/components/ui/badge';
import type { Move } from './moves';
import { isAoeMove } from './moveTags';

export interface MoveTag {
  /** Short badge text, e.g. "AoE r2". */
  label: string;
  /** Long explanation shown on hover. */
  title: string;
  /** Tailwind classes for the badge. */
  className: string;
}

const TONE = {
  type: 'bg-primary/15 text-primary border-primary/30',
  element: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30',
  klass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  shape: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30',
  special: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
  effect: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  neutral: 'bg-muted text-muted-foreground border-border',
} as const;

const PATTERN_LABELS: Record<string, string> = {
  single: 'Single target',
  piercing: 'Piercing line',
  aura: 'Aura (around self)',
  cone: 'Cone',
  area: 'Area blast',
  custom: 'Custom shape',
  line: 'Line',
};

const DOT_WORDS = ['poison', 'burn', 'bleed'];

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Every tag that applies to a move, in a stable display order. */
export function getMoveTags(move: Move): MoveTag[] {
  const tags: MoveTag[] = [];
  const effect = move.effect ?? '';
  const pretty = effect.replace(/_/g, ' ');

  // ── Core typing ──
  tags.push({
    label: move.type,
    title: `Move type: ${move.type}`,
    className: TONE.type,
  });

  if (move.power > 0) {
    tags.push({ label: 'damage', title: 'Deals damage', className: TONE.type });
  }
  if (move.type === 'heal' || effect.includes('heal') || effect.includes('restore')) {
    tags.push({ label: 'heal', title: `Restorative: ${pretty || 'heals'}`, className: TONE.effect });
  }

  // ── Element / class ──
  if (move.element) {
    tags.push({
      label: move.element,
      title: `Element: ${titleCase(move.element)} — used for elemental matchups`,
      className: TONE.element,
    });
  }
  if (move.inheritMonsterElement) {
    tags.push({
      label: 'user element',
      title: "Uses the caster's own element for matchup calculations",
      className: TONE.element,
    });
  }
  if (move.classBonus) {
    tags.push({
      label: move.classBonus,
      title: `Class: ${titleCase(move.classBonus)} — used for class matchups`,
      className: TONE.klass,
    });
  }
  if (move.inheritMonsterClass) {
    tags.push({
      label: 'user class',
      title: "Uses the caster's own class for matchup calculations",
      className: TONE.klass,
    });
  }

  // ── Shape / targeting ──
  const pattern = move.customShape ? 'custom' : move.targeting;
  if (pattern) {
    tags.push({
      label: PATTERN_LABELS[pattern] ?? pattern,
      title: `Targeting pattern: ${PATTERN_LABELS[pattern] ?? pattern}`,
      className: TONE.shape,
    });
  }
  if (isAoeMove(move)) {
    const r = move.aoeRadius ?? 0;
    tags.push({
      label: r > 0 ? `AoE r${r}` : 'AoE',
      title: r > 0
        ? `Area of effect: hits every valid tile within ${r} tile${r === 1 ? '' : 's'}`
        : 'Area of effect: hits multiple tiles',
      className: TONE.shape,
    });
  }
  if (move.piercing) {
    tags.push({
      label: 'piercing',
      title: 'Passes through and hits every enemy in the line',
      className: TONE.shape,
    });
  }
  if (move.wallPenetrate) {
    tags.push({
      label: 'ignores walls',
      title: 'Can be used through walls and other blocking tiles',
      className: TONE.special,
    });
  }
  if (move.movement) {
    tags.push({
      label: 'movement',
      title: 'Repositions the user',
      className: TONE.special,
    });
  }
  if (move.movement && (move.power > 0 || move.customShape)) {
    tags.push({
      label: move.comboOrder === 'attack_then_move' ? 'attack → move' : 'move → attack',
      title:
        move.comboOrder === 'attack_then_move'
          ? 'Combo: attack resolves first, then the user repositions'
          : 'Combo: the user repositions first, then the attack resolves',
      className: TONE.special,
    });
  }

  // ── Effects ──
  if (effect) {
    if (effect.includes('raise_')) {
      tags.push({ label: 'buff', title: `Buff: ${pretty}`, className: TONE.effect });
    }
    if (effect.includes('lower_')) {
      tags.push({ label: 'debuff', title: `Debuff: ${pretty}`, className: TONE.effect });
    }
    const dot = DOT_WORDS.find((w) => effect.includes(w));
    if (dot) {
      tags.push({
        label: 'damage over time',
        title: `Applies ${dot} — damage continues over several turns`,
        className: TONE.effect,
      });
    }
    if (effect.includes('drain_stamina')) {
      tags.push({ label: 'stamina drain', title: 'Drains the target\'s stamina', className: TONE.effect });
    }
    // Always surface the raw effect id so nothing is hidden.
    tags.push({ label: pretty, title: `Special effect: ${pretty}`, className: TONE.neutral });
  }

  if (move.grapple?.forces) {
    tags.push({
      label: 'grapples',
      title: 'On hit, both fighters become Grappled (reduced ranged accuracy, movement and escape chance)',
      className: TONE.special,
    });
  }
  if (move.triggersTrapsOnAoe) {
    tags.push({
      label: 'triggers traps',
      title: 'Its area sets off traps and runes it overlaps',
      className: TONE.special,
    });
  }
  if (move.speedMod !== 0) {
    tags.push({
      label: `${move.speedMod > 0 ? '+' : ''}${move.speedMod} priority`,
      title:
        move.speedMod > 0
          ? 'Acts earlier in the turn order'
          : 'Acts later in the turn order',
      className: TONE.neutral,
    });
  }
  if (move.manaCost) {
    tags.push({ label: `${move.manaCost} mana`, title: `Mana cost: ${move.manaCost}`, className: TONE.neutral });
  }
  if (move.unlockLevel && move.unlockLevel > 1) {
    tags.push({
      label: `Lv ${move.unlockLevel}+`,
      title: `Unlocks at level ${move.unlockLevel}`,
      className: TONE.neutral,
    });
  }
  if (move.aspects?.length) {
    tags.push({
      label: `aspects: ${move.aspects.join('/')}`,
      title: `Powered by aspect(s): ${move.aspects.join(', ')}`,
      className: TONE.neutral,
    });
  }
  if (move.custom) {
    tags.push({ label: 'custom', title: 'Custom move created in the admin tools', className: TONE.neutral });
  }

  return tags;
}

interface MoveTagBadgesProps {
  move: Move;
  /** Cap the number of badges shown (a "+N" badge summarises the rest). */
  max?: number;
  size?: 'xs' | 'sm';
  className?: string;
}

/** Renders every tag on a move as hoverable badges. */
export function MoveTagBadges({ move, max, size = 'xs', className = '' }: MoveTagBadgesProps) {
  const tags = getMoveTags(move);
  if (tags.length === 0) return null;

  const shown = max ? tags.slice(0, max) : tags;
  const hidden = tags.length - shown.length;
  const text = size === 'xs' ? 'text-[8px] px-1 py-0 h-auto leading-4' : 'text-[10px] px-1.5 py-0 h-auto leading-5';

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {shown.map((t) => (
        <Badge
          key={t.label}
          variant="outline"
          title={t.title}
          className={`${text} font-medium ${t.className}`}
        >
          {t.label}
        </Badge>
      ))}
      {hidden > 0 && (
        <Badge
          variant="outline"
          title={tags.slice(shown.length).map((t) => t.title).join('\n')}
          className={`${text} ${TONE.neutral}`}
        >
          +{hidden}
        </Badge>
      )}
    </div>
  );
}
