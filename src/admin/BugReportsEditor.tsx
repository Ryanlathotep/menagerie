import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Bug, RefreshCw, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

interface BugReport {
  id: string;
  user_id: string | null;
  username: string | null;
  title: string;
  description: string;
  category: string | null;
  context: Record<string, unknown> | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

const STATUSES = ['open', 'in-progress', 'resolved', 'wont-fix'];

function SignedScreenshot({ pathOrUrl, index }: { pathOrUrl: string; index: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    // Legacy rows stored full public URLs; new rows store storage paths.
    if (/^https?:\/\//i.test(pathOrUrl)) {
      setUrl(pathOrUrl);
      return;
    }
    (async () => {
      const { data, error } = await supabase.storage
        .from('bug-screenshots')
        .createSignedUrl(pathOrUrl, 3600);
      if (!cancelled && !error) setUrl(data?.signedUrl ?? null);
    })();
    return () => { cancelled = true; };
  }, [pathOrUrl]);
  if (!url) {
    return <div className="w-full h-32 bg-muted/40 border rounded animate-pulse" aria-label="loading screenshot" />;
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block border rounded overflow-hidden hover:opacity-80">
      <img src={url} alt={`screenshot ${index + 1}`} className="w-full h-32 object-cover" />
    </a>
  );
}

export function BugReportsEditor() {
  const { toast } = useToast();
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase.from('bug_reports').select('*').order('created_at', { ascending: false }).limit(500);
      if (filter !== 'all') q = q.eq('status', filter);
      const { data, error } = await q;
      if (error) throw error;
      setReports((data ?? []) as BugReport[]);
    } catch (e) {
      toast({ title: 'Failed to load reports', description: String((e as Error).message), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [filter, toast]);

  useEffect(() => { load(); }, [load]);

  const updateReport = async (id: string, patch: Partial<BugReport>) => {
    const { error } = await supabase.from('bug_reports').update(patch as any).eq('id', id);
    if (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
      return;
    }
    setReports((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  const deleteReport = async (id: string) => {
    if (!confirm('Delete this bug report?')) return;
    const { error } = await supabase.from('bug_reports').delete().eq('id', id);
    if (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
      return;
    }
    setReports((r) => r.filter((x) => x.id !== id));
  };

  const toggle = (id: string) => {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const statusColor = (s: string) =>
    s === 'open' ? 'destructive' : s === 'in-progress' ? 'default' : s === 'resolved' ? 'secondary' : 'outline';

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Bug className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Bug Reports ({reports.length})</h3>
        <div className="flex-1" />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {reports.length === 0 && !loading && (
        <p className="text-sm text-muted-foreground text-center py-8">No bug reports.</p>
      )}

      <div className="space-y-2">
        {reports.map((r) => {
          const isOpen = expanded.has(r.id);
          return (
            <Card key={r.id} className="p-3">
              <div className="flex items-start gap-2">
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => toggle(r.id)}>
                  {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={statusColor(r.status) as any}>{r.status}</Badge>
                    {r.category && <Badge variant="outline">{r.category}</Badge>}
                    <span className="font-medium truncate">{r.title}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {r.username ?? (r.user_id ? `user ${r.user_id.slice(0, 8)}` : 'anonymous')}
                    {' • '}
                    {new Date(r.created_at).toLocaleString()}
                  </div>
                </div>
                <Select value={r.status} onValueChange={(v) => updateReport(r.id, { status: v })}>
                  <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteReport(r.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              {isOpen && (
                <div className="mt-3 pl-9 space-y-3">
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-1">Description</div>
                    <pre className="whitespace-pre-wrap text-sm bg-muted/40 p-2 rounded border">{r.description}</pre>
                  </div>
                  {Array.isArray((r.context as any)?.screenshots) && (r.context as any).screenshots.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground mb-1">
                        Screenshots ({(r.context as any).screenshots.length})
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {((r.context as any).screenshots as string[]).map((ref, i) => (
                          <SignedScreenshot key={i} pathOrUrl={ref} index={i} />
                        ))}
                      </div>
                    </div>
                  )}
                  {r.context && (
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground mb-1">Context</div>
                      <pre className="text-xs bg-muted/40 p-2 rounded border overflow-auto max-h-60">
                        {JSON.stringify(r.context, null, 2)}
                      </pre>
                    </div>
                  )}
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-1">Admin notes</div>
                    <Textarea
                      defaultValue={r.admin_notes ?? ''}
                      rows={3}
                      placeholder="Internal notes…"
                      onBlur={(e) => {
                        const val = e.target.value;
                        if (val !== (r.admin_notes ?? '')) updateReport(r.id, { admin_notes: val });
                      }}
                    />
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
