// Dialog for using a Skill Forge "Scroll of <Move>" item.
//
// Two flows:
//   - Teach: permanently add the move to a chosen party member's pool
//     (persisted via TEACH_MOVE_FROM_SCROLL on saveData.taughtMoves).
//   - Cast Once: fire the move immediately in the active battle, ignoring
//     class/element/species/stamina requirements. Scroll consumed either way.

import { useState } from 'react';
import { Monster, InventoryItem } from './types';
import { MonsterSprite } from './sprites';
import { Move, getMoveById } from './moves';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ScrollUseDialogProps {
  open: boolean;
  scroll: InventoryItem | null;
  party: Monster[];
  canCast: boolean; // true only when there is an active battle
  onTeach: (comboId: string, moveId: string, itemId: string) => void;
  onCast: (move: Move, itemId: string) => void;
  onClose: () => void;
}

function moveIdFromScroll(item: InventoryItem | null): string | null {
  if (!item?.effect) return null;
  if (!item.effect.startsWith('teach_move:')) return null;
  return item.effect.slice('teach_move:'.length);
}

export function ScrollUseDialog({
  open,
  scroll,
  party,
  canCast,
  onTeach,
  onCast,
  onClose,
}: ScrollUseDialogProps) {
  const [mode, setMode] = useState<'choose' | 'pick_target'>('choose');

  const moveId = moveIdFromScroll(scroll);
  const move = moveId ? getMoveById(moveId) : undefined;

  const reset = () => {
    setMode('choose');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  if (!scroll || !move || !moveId) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>📜 {scroll.name}</DialogTitle>
          <DialogDescription>
            {move.name} — {move.type} · power {move.power} · accuracy {move.accuracy}%
            {move.staminaCost ? ` · ${move.staminaCost} stamina` : ''}
          </DialogDescription>
        </DialogHeader>

        {mode === 'choose' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {move.description}
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => setMode('pick_target')}>
                Teach a monster (permanent)
              </Button>
              <Button
                variant="secondary"
                disabled={!canCast}
                onClick={() => {
                  onCast(move, scroll.id);
                  handleClose();
                }}
              >
                {canCast ? 'Cast once (free, ignores requirements)' : 'Cast once — only in combat'}
              </Button>
              <Button variant="ghost" onClick={handleClose}>Cancel</Button>
            </div>
          </div>
        )}

        {mode === 'pick_target' && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Choose a monster to learn <span className="font-semibold">{move.name}</span>:
            </p>
            <ScrollArea className="max-h-80">
              <div className="flex flex-col gap-2 pr-2">
                {party.map((m, idx) => {
                  const comboId = `${m.species}_${m.element}_${m.class}`;
                  return (
                    <button
                      key={idx}
                      className="flex items-center gap-3 rounded border p-2 text-left hover:bg-accent"
                      onClick={() => {
                        onTeach(comboId, moveId, scroll.id);
                        handleClose();
                      }}
                    >
                      <div className="w-10 h-10 shrink-0">
                        <MonsterSprite monster={m} size={40} />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-sm">{m.name}</div>
                        <div className="text-xs text-muted-foreground">
                          Lv {m.level} · {m.element} · {m.class}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
            <Button variant="ghost" onClick={() => setMode('choose')}>Back</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
