import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Bug, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Optional snapshot of current game state to attach as context */
  context?: Record<string, unknown>;
}

const CATEGORIES = [
  'Combat',
  'Movement / Navigation',
  'UI / Menus',
  'Overworld',
  'Dungeon',
  'Crafting / Equipment',
  'Monsters / Recruiting',
  'Save / Load',
  'Performance',
  'Other',
];

export function ReportBugDialog({ isOpen, onClose, context }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Other');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const submit = async () => {
    if (!title.trim() || !description.trim()) {
      toast({ title: 'Please fill in title and description', variant: 'destructive' });
      return;
    }
    if (title.length > 200 || description.length > 4000) {
      toast({ title: 'Report is too long', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      // Try to grab username if available
      let username: string | null = null;
      if (user) {
        const { data } = await supabase.rpc('get_my_username');
        username = (data as string | null) ?? null;
      }

      const ctx = {
        ...(context ?? {}),
        url: typeof window !== 'undefined' ? window.location.href : null,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        viewport: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : null,
        timestamp: new Date().toISOString(),
      };

      const { error } = await supabase.from('bug_reports').insert({
        user_id: user?.id ?? null,
        username,
        title: title.trim(),
        description: description.trim(),
        category,
        context: ctx,
      });
      if (error) throw error;

      toast({ title: 'Bug report sent', description: 'Thanks! Admins will review it.' });
      setTitle('');
      setDescription('');
      setCategory('Other');
      onClose();
    } catch (e) {
      console.error('Bug report submit failed', e);
      toast({ title: 'Could not send report', description: String((e as Error).message ?? e), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="w-full max-w-lg p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Bug className="w-5 h-5 text-primary" />
            Report a Bug
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>

        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Title</Label>
          <Input
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Short summary"
          />
        </div>

        <div className="space-y-2">
          <Label>What happened?</Label>
          <Textarea
            value={description}
            maxLength={4000}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Steps to reproduce, what you expected, what happened instead…"
            rows={7}
          />
          <p className="text-xs text-muted-foreground">
            Your current screen, viewport, and (if signed in) username will be attached automatically.
          </p>
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1" disabled={submitting}>Cancel</Button>
          <Button onClick={submit} className="flex-1" disabled={submitting}>
            {submitting ? 'Sending…' : 'Send Report'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
