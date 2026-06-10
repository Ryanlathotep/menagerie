// Data hook for admin feature-requests list. Extracted from
// FeatureRequestsEditor so the view component stays focused on rendering.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface FeatureRequest {
  id: string;
  user_id: string | null;
  username: string | null;
  title: string;
  description: string;
  category: string | null;
  context: Record<string, unknown> | null;
  status: string;
  admin_notes: string | null;
  upvotes: number;
  created_at: string;
  updated_at: string;
}

export function useFeatureRequests(filter: string) {
  const { toast } = useToast();
  const [items, setItems] = useState<FeatureRequest[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase
        .from('feature_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (filter !== 'all') q = q.eq('status', filter);
      const { data, error } = await q;
      if (error) throw error;
      setItems((data ?? []) as FeatureRequest[]);
    } catch (e) {
      toast({
        title: 'Failed to load requests',
        description: String((e as Error).message),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [filter, toast]);

  useEffect(() => { load(); }, [load]);

  const update = useCallback(async (id: string, patch: Partial<FeatureRequest>) => {
    const { error } = await supabase
      .from('feature_requests')
      .update(patch as never)
      .eq('id', id);
    if (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
      return;
    }
    setItems((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }, [toast]);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from('feature_requests').delete().eq('id', id);
    if (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
      return;
    }
    setItems((r) => r.filter((x) => x.id !== id));
  }, [toast]);

  return { items, loading, refresh: load, update, remove };
}
