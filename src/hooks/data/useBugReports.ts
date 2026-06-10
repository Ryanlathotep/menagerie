// Data hook for admin bug-reports list. Extracted from BugReportsEditor so
// the view component stays focused on rendering. Behavior is identical to
// the inline version that used to live there.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface BugReport {
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

export function useBugReports(filter: string) {
  const { toast } = useToast();
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase
        .from('bug_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (filter !== 'all') q = q.eq('status', filter);
      const { data, error } = await q;
      if (error) throw error;
      setReports((data ?? []) as BugReport[]);
    } catch (e) {
      toast({
        title: 'Failed to load reports',
        description: String((e as Error).message),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [filter, toast]);

  useEffect(() => { load(); }, [load]);

  const update = useCallback(async (id: string, patch: Partial<BugReport>) => {
    const { error } = await supabase
      .from('bug_reports')
      .update(patch as never)
      .eq('id', id);
    if (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
      return;
    }
    setReports((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }, [toast]);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from('bug_reports').delete().eq('id', id);
    if (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
      return;
    }
    setReports((r) => r.filter((x) => x.id !== id));
  }, [toast]);

  return { reports, loading, refresh: load, update, remove };
}
