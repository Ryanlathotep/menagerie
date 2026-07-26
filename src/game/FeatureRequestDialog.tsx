import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Lightbulb, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
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
  'Quality of Life',
  'New Content',
  'Other',
];

export function FeatureRequestDialog({ isOpen, onClose, context }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Quality of Life');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const submit = async () => {
    if (!user) {
      toast({ title: 'Please sign in to submit a feature request', variant: 'destructive' });
      return;
    }
    if (!title.trim() || !description.trim()) {
      toast({ title: 'Please fill in title and description', variant: 'destructive' });
      return;
    }
    if (title.length > 200 || description.length > 4000) {
      toast({ title: 'Request is too long', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      let username: string | null = null;
      const { data: nameData } = await supabase.rpc('get_my_username');
      username = (nameData as string | null) ?? null;

      const ctx = {
        ...(context ?? {}),
        url: typeof window !== 'undefined' ? window.location.href : null,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        timestamp: new Date().toISOString(),
      };

      const { error } = await supabase.from('feature_requests').insert({
        user_id: user.id,
        username,
        title: title.trim(),
        description: description.trim(),
        category,
        context: ctx,
      });
      if (error) throw error;

      toast({ title: 'Feature request sent', description: 'Thanks for the idea!' });
      setTitle('');
      setDescription('');
      setCategory('Quality of Life');
      onClose();
    } catch (e) {
      console.error('Feature request submit failed', e);
      toast({ title: 'Could not send request', description: String((e as Error).message ?? e), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <Card className="w-full max-w-lg p-5 space-y-4 max-h-[calc(100dvh-1.5rem)] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-primary" />
            Suggest a Feature
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close feature request dialog"><X className="w-4 h-4" /></Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="feature-category">Category</Label>
          <select
            id="feature-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="space-y-2">
          <Label>Title</Label>
          <Input
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Short summary of your idea"
          />
        </div>

        <div className="space-y-2">
          <Label>Describe the idea</Label>
          <Textarea
            value={description}
            maxLength={4000}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What should it do? Why would it help? Any examples from other games?"
            rows={6}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Your URL{user ? ' and username' : ''} are attached automatically.
        </p>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1" disabled={submitting}>Cancel</Button>
          <Button onClick={submit} className="flex-1" disabled={submitting}>
            {submitting ? 'Sending…' : 'Send Request'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
