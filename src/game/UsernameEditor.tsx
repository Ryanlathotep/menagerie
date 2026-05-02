// Username editor shown in Settings. Locked once set, with an explicit Edit
// button that re-checks uniqueness server-side. Signed-out players see a
// short note explaining sign-in is required for leaderboards.

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User as UserIcon, Pencil, Check, X } from 'lucide-react';
import { useMyUsername, setMyUsername, validateUsername } from '@/hooks/useUsername';
import { toast } from 'sonner';

export function UsernameEditor() {
  const { username, loading, refresh, isAuthenticated } = useMyUsername();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="space-y-2 pt-4 border-t">
        <Label className="text-base flex items-center gap-2">
          <UserIcon className="w-4 h-4 text-primary" />
          Public Username
        </Label>
        <p className="text-xs text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="space-y-2 pt-4 border-t">
        <Label className="text-base flex items-center gap-2">
          <UserIcon className="w-4 h-4 text-primary" />
          Public Username
        </Label>
        <p className="text-xs text-muted-foreground">
          Sign in to claim a public username and post to tower leaderboards.
        </p>
      </div>
    );
  }

  const startEdit = () => {
    setDraft(username ?? '');
    setLocalError(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft('');
    setLocalError(null);
  };

  const save = async () => {
    const err = validateUsername(draft);
    if (err) {
      setLocalError(err);
      return;
    }
    setSaving(true);
    const result = await setMyUsername(draft);
    setSaving(false);
    if (result.ok === false) {
      setLocalError(result.error);
      return;
    }
    toast.success(`Username set to ${result.username}`);
    setEditing(false);
    setDraft('');
    setLocalError(null);
    refresh();
  };

  return (
    <div className="space-y-2 pt-4 border-t">
      <Label className="text-base flex items-center gap-2">
        <UserIcon className="w-4 h-4 text-primary" />
        Public Username
      </Label>
      <p className="text-xs text-muted-foreground -mt-1">
        Shown on tower leaderboards. 3–20 characters: letters, numbers, _ or -.
      </p>

      {!editing ? (
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-md border bg-muted/40 px-3 py-2 text-sm font-mono">
            {username ?? <span className="text-muted-foreground italic">Not set</span>}
          </div>
          <Button variant="outline" size="sm" onClick={startEdit}>
            <Pencil className="w-3.5 h-3.5 mr-1" />
            {username ? 'Edit' : 'Set'}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (localError) setLocalError(null);
            }}
            placeholder="e.g. SlimeKing_42"
            maxLength={20}
            autoFocus
            disabled={saving}
            className="h-9 text-sm font-mono"
          />
          {localError && (
            <p className="text-xs text-destructive">{localError}</p>
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={cancelEdit} disabled={saving}>
              <X className="w-3.5 h-3.5 mr-1" /> Cancel
            </Button>
            <Button size="sm" className="flex-1" onClick={save} disabled={saving}>
              <Check className="w-3.5 h-3.5 mr-1" /> {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Names are unique. Changing yours frees the old name for others.
          </p>
        </div>
      )}
    </div>
  );
}
