import { useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Bug, X, Camera, Upload, Trash2 } from 'lucide-react';
import { toPng } from 'html-to-image';

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
  'Performance',
  'Other',
];

interface Shot {
  id: string;
  dataUrl: string; // local preview
  blob: Blob;
  name: string;
}

export function ReportBugDialog({ isOpen, onClose, context }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Other');
  const [submitting, setSubmitting] = useState(false);
  const [shots, setShots] = useState<Shot[]>([]);
  const [capturing, setCapturing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const addShot = (blob: Blob, name: string) => {
    if (shots.length >= 4) {
      toast({ title: 'Max 4 screenshots', variant: 'destructive' });
      return;
    }
    if (blob.size > 5 * 1024 * 1024) {
      toast({ title: 'Image too large (max 5MB)', variant: 'destructive' });
      return;
    }
    const dataUrl = URL.createObjectURL(blob);
    setShots((s) => [...s, { id: crypto.randomUUID(), dataUrl, blob, name }]);
  };

  const captureScreen = async () => {
    setCapturing(true);
    // Hide the dialog briefly so it doesn't appear in the screenshot
    const dialogEl = document.getElementById('bug-report-dialog');
    if (dialogEl) dialogEl.style.visibility = 'hidden';
    try {
      // Wait a frame for the hide to apply
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const dataUrl = await toPng(document.body, {
        cacheBust: true,
        pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
      });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      addShot(blob, `screen-${Date.now()}.png`);
    } catch (e) {
      console.error('Screenshot failed', e);
      toast({ title: 'Screenshot failed', description: String((e as Error).message ?? e), variant: 'destructive' });
    } finally {
      if (dialogEl) dialogEl.style.visibility = 'visible';
      setCapturing(false);
    }
  };

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((f) => {
      if (!f.type.startsWith('image/')) return;
      addShot(f, f.name);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeShot = (id: string) => {
    setShots((s) => {
      const target = s.find((x) => x.id === id);
      if (target) URL.revokeObjectURL(target.dataUrl);
      return s.filter((x) => x.id !== id);
    });
  };

  const uploadShots = async (): Promise<string[]> => {
    // Bucket is private. Store storage paths; admin viewer signs URLs on demand.
    const paths: string[] = [];
    for (const shot of shots) {
      const ext = shot.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `${user?.id ?? 'anon'}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from('bug-screenshots')
        .upload(path, shot.blob, { contentType: shot.blob.type || 'image/png', upsert: false });
      if (error) throw error;
      paths.push(path);
    }
    return paths;
  };

  const submit = async () => {
    if (!user) {
      toast({ title: 'Please sign in to submit a bug report', variant: 'destructive' });
      return;
    }
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
      let username: string | null = null;
      const { data: nameData } = await supabase.rpc('get_my_username');
      username = (nameData as string | null) ?? null;

      const screenshotUrls = shots.length ? await uploadShots() : [];

      const ctx = {
        ...(context ?? {}),
        url: typeof window !== 'undefined' ? window.location.href : null,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        viewport: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : null,
        timestamp: new Date().toISOString(),
        screenshots: screenshotUrls,
      };

      const { error } = await supabase.from('bug_reports').insert({
        user_id: user.id,
        username,
        title: title.trim(),
        description: description.trim(),
        category,
        context: ctx,
      });
      if (error) throw error;


      toast({ title: 'Bug report sent', description: 'Thanks! Admins will review it.' });
      shots.forEach((s) => URL.revokeObjectURL(s.dataUrl));
      setShots([]);
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
    <div
      id="bug-report-dialog"
      className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <Card className="w-full max-w-lg p-5 space-y-4 max-h-[calc(100dvh-1.5rem)] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Bug className="w-5 h-5 text-primary" />
            Report a Bug
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close bug report dialog"><X className="w-4 h-4" /></Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bug-category">Category</Label>
          {/* Native select — avoids portal/z-index issues with the modal */}
          <select
            id="bug-category"
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
            rows={6}
          />
        </div>

        <div className="space-y-2">
          <Label>Screenshots ({shots.length}/4)</Label>
          <div className="flex gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={captureScreen}
              disabled={capturing || shots.length >= 4}
            >
              <Camera className="w-4 h-4 mr-1" />
              {capturing ? 'Capturing…' : 'Capture Screen'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={shots.length >= 4}
            >
              <Upload className="w-4 h-4 mr-1" />
              Upload Image
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => onFiles(e.target.files)}
            />
          </div>
          {shots.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              {shots.map((s) => (
                <div key={s.id} className="relative group border rounded overflow-hidden bg-muted/40">
                  <img src={s.dataUrl} alt="screenshot" className="w-full h-24 object-cover" />
                  <button
                    type="button"
                    onClick={() => removeShot(s.id)}
                    className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded p-1 opacity-90"
                    aria-label="Remove screenshot"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Screen, viewport, URL{user ? ', and your username' : ''} are attached automatically.
          </p>
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1" disabled={submitting}>Cancel</Button>
          <Button onClick={submit} className="flex-1" disabled={submitting || capturing}>
            {submitting ? 'Sending…' : 'Send Report'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
