import { useState } from 'react';
import { Bug } from 'lucide-react';
import { ReportBugDialog } from './ReportBugDialog';

/**
 * Always-visible floating bug-report button. Mounted globally during beta so
 * a screenshot + report is one click away from any screen.
 */
export function FloatingBugButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Report a bug"
        aria-label="Report a bug"
        className="fixed bottom-3 right-3 z-[9999] flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card/90 text-foreground shadow-md backdrop-blur transition hover:scale-105 hover:bg-accent hover:text-accent-foreground"
      >
        <Bug className="h-5 w-5" />
      </button>
      <ReportBugDialog isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
