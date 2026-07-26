// One menu, every tile, every platform.
//
// Replaces the fragmented per-tile-type right-click menus (waypoint, water,
// road, building, attack picker, grass context, etc.) with a single centered
// modal. The parent passes a fully-built action list — this component is
// purely presentational so the same shell works on overworld and dungeon.
//
// Opens from PC right-click and touch long-press. Tap / left-click is still
// movement (handled upstream).

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { X, type LucideIcon } from 'lucide-react';


export interface UnifiedTileAction {
  id: string;
  label: string;
  /** Optional secondary text rendered under the label. */
  hint?: string;
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  /** Tooltip / aria reason for why this action is disabled. */
  disabledReason?: string;
  variant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'ghost';
}

export interface UnifiedTileInfo {
  /** Key/value rows describing the tile (terrain, biome, elevation, etc.). */
  label: string;
  value: string;
}

export interface UnifiedTileCreature {
  name: string;
  level?: number;
  element?: string;
  klass?: string;
  hp?: number;
  maxHp?: number;
  /** Pre-formatted warning lines, e.g. "1.5x elemental advantage". */
  warnings?: string[];
}

interface UnifiedTileMenuProps {
  worldX: number;
  worldY: number;
  /** Big title at the top (e.g. "🏰 Fire Tower", "🍃 Open ground"). */
  title: string;
  /** Small line under the title — coords + extra metadata. */
  subtitle?: string;
  info?: UnifiedTileInfo[];
  creature?: UnifiedTileCreature;
  actions: UnifiedTileAction[];
  /** Free-form footer note, italicized. */
  footnote?: string;
  onClose: () => void;
}

export function UnifiedTileMenu({
  worldX,
  worldY,
  title,
  subtitle,
  info,
  creature,
  actions,
  footnote,
  onClose,
}: UnifiedTileMenuProps) {
  // Touch long-press opens the menu, but the same finger lifting fires a
  // synthesized click on whatever element is now under it — which is the
  // overlay that just appeared. Without a grace period, the menu would
  // close the moment the player releases their finger. We also require
  // the closing press to *start* on the overlay (not bubble up from a
  // button), to prevent accidental dismissal while tapping near a row.
  const openedAtRef = useRef<number>(Date.now());
  const overlayPressRef = useRef<boolean>(false);
  useEffect(() => { openedAtRef.current = Date.now(); }, []);

  const tryClose = () => {
    if (Date.now() - openedAtRef.current < 450) return;
    onClose();
  };

  // The menu is rendered from inside the map container, which is scaled
  // (CSS transform) and `overflow-hidden`. A transformed ancestor makes
  // `position: fixed` resolve against that ancestor, so the overlay gets
  // clipped to the map viewport and its scroll area is cut off. Portal to
  // <body> so the overlay is always full-viewport and fully scrollable.
  return createPortal(
    <div
      className="fixed inset-0 bg-background/60 backdrop-blur-sm z-50 flex items-start sm:items-center justify-center p-3 overflow-y-auto overscroll-contain"
      onPointerDown={(e) => { overlayPressRef.current = e.target === e.currentTarget; }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        if (!overlayPressRef.current) return;
        overlayPressRef.current = false;
        tryClose();
      }}
      onContextMenu={(e) => { e.preventDefault(); tryClose(); }}
    >
      <Card
        className="p-4 max-w-sm w-full space-y-3 my-auto max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain [touch-action:pan-y]"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.stopPropagation()}
      >


        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-base font-bold truncate">{title}</h2>
            <p className="text-[11px] text-muted-foreground">
              ({worldX}, {worldY}){subtitle ? ` · ${subtitle}` : ''}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} aria-label="Close menu">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Tile info block */}
        {info && info.length > 0 && (
          <div className="rounded-md border bg-muted/40 px-2.5 py-2 space-y-0.5">
            {info.map((row, i) => (
              <div key={i} className="flex justify-between gap-2 text-[11px]">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-medium text-right truncate">{row.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Creature block */}
        {creature && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-2 space-y-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-bold truncate">{creature.name}</span>
              {creature.level != null && (
                <span className="text-[11px] text-muted-foreground shrink-0">Lv {creature.level}</span>
              )}
            </div>
            {(creature.element || creature.klass) && (
              <div className="text-[10px] text-muted-foreground capitalize">
                {[creature.element, creature.klass].filter(Boolean).join(' · ')}
              </div>
            )}
            {creature.hp != null && creature.maxHp != null && creature.maxHp > 0 && (
              <div>
                <div className="h-1.5 w-full rounded-full bg-background overflow-hidden">
                  <div
                    className="h-full bg-destructive transition-all"
                    style={{ width: `${Math.max(0, Math.min(100, (creature.hp / creature.maxHp) * 100))}%` }}
                  />
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {creature.hp} / {creature.maxHp} HP
                </div>
              </div>
            )}
            {creature.warnings && creature.warnings.length > 0 && (
              <ul className="text-[10px] text-amber-600 dark:text-amber-400 space-y-0.5 pt-0.5">
                {creature.warnings.map((w, i) => <li key={i}>⚠ {w}</li>)}
              </ul>
            )}
          </div>
        )}

        {/* Actions */}
        {actions.length > 0 ? (
          <div className="space-y-1.5">
            {actions.map((a) => {
              const Icon = a.icon;
              return (
                <Button
                  key={a.id}
                  variant={a.variant ?? 'secondary'}
                  className="w-full justify-start h-auto py-2"
                  onClick={a.onClick}
                  disabled={a.disabled}
                  title={a.disabled ? a.disabledReason : undefined}
                >
                  <Icon className="h-4 w-4 mr-2 shrink-0" />
                  <span className="flex-1 text-left">
                    <span className="block leading-tight">{a.label}</span>
                    {(a.hint || (a.disabled && a.disabledReason)) && (
                      <span className="block text-[10px] opacity-70 leading-tight">
                        {a.disabled ? a.disabledReason : a.hint}
                      </span>
                    )}
                  </span>
                </Button>
              );
            })}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground text-center py-2">
            Nothing to do here.
          </p>
        )}

        {footnote && (
          <p className="text-[10px] text-muted-foreground text-center italic">
            {footnote}
          </p>
        )}
      </Card>
    </div>
  );
}
