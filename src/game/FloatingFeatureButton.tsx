import { useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { FeatureRequestDialog } from './FeatureRequestDialog';
import { FloatingActionButton } from './FloatingActionButton';

const STORAGE_KEY = 'feature-button-position-v1';

/**
 * Always-visible floating "suggest a feature" button. Draggable; position
 * persists. Pairs with FloatingBugButton — defaults to sitting just above it
 * in the bottom-right corner.
 */
export function FloatingFeatureButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <FloatingActionButton
        storageKey={STORAGE_KEY}
        defaultPosition={({ w, h, size }) => ({
          x: w - size - 12,
          y: h - size - 12 - (size + 8), // stacked above the bug button by default
        })}
        hasHome
        onTap={() => setOpen(true)}
        title="Suggest a feature (drag to reposition)"
        ariaLabel="Suggest a feature"
        className="bg-card/90 text-amber-700 hover:bg-amber-100 hover:text-amber-800 dark:text-amber-300 dark:hover:bg-amber-900/40"
      >
        <Lightbulb className="h-5 w-5 pointer-events-none" />
      </FloatingActionButton>
      <FeatureRequestDialog isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
