import { useState } from 'react';
import { Bug } from 'lucide-react';
import { ReportBugDialog } from './ReportBugDialog';
import { FloatingActionButton } from './FloatingActionButton';

const STORAGE_KEY = 'bug-button-position-v1';

/**
 * Always-visible floating bug-report button. Draggable; position persists.
 * Thin wrapper over the shared FloatingActionButton so every always-on
 * floating control shares one implementation.
 */
export function FloatingBugButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <FloatingActionButton
        storageKey={STORAGE_KEY}
        defaultPosition={({ w, h, size }) => ({
          x: w - size - 12,
          y: h - size - 12,
        })}
        hasHome
        onTap={() => setOpen(true)}
        title="Report a bug (drag to reposition)"
        ariaLabel="Report a bug"
      >
        <Bug className="h-5 w-5 pointer-events-none" />
      </FloatingActionButton>
      <ReportBugDialog isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
