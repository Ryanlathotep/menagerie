import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Copy } from 'lucide-react';

/**
 * Generic "Copy fields from another entry" picker for admin editors that don't
 * support custom new-entry creation (monsters, equipment sets, recipes).
 *
 * The picker calls onPick(sourceId) with the chosen source. The parent is
 * responsible for deep-cloning that source's data into the editor state while
 * preserving the currently-selected target's id (so Save still writes the
 * override under the target's key).
 */
export function CopyFromPicker<T extends { id: string; name?: string }>({
  sources,
  excludeId,
  onPick,
  label = 'Copy fields from',
}: {
  sources: T[];
  excludeId?: string;
  onPick: (sourceId: string) => void;
  label?: string;
}) {
  const options = sources.filter((s) => s.id !== excludeId);
  return (
    <div className="rounded-md border border-dashed border-border bg-muted/20 p-2 space-y-1">
      <div className="flex items-center gap-2">
        <Copy className="w-3.5 h-3.5 text-muted-foreground" />
        <Label className="text-xs">{label}</Label>
      </div>
      <Select value="" onValueChange={(v) => v && onPick(v)}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="Pick an entry to clone into this editor…" />
        </SelectTrigger>
        <SelectContent>
          {options.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name || s.id}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="text-[10px] text-muted-foreground leading-tight">
        Loads the source's fields into the editor below. Review, then Save to write under the current entry.
      </div>
    </div>
  );
}
