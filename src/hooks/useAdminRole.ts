import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useAdminRole() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  // Remember the last user id we actually checked so transient auth re-emits
  // (TOKEN_REFRESHED, tab-focus SIGNED_IN, etc.) don't flicker isAdmin back
  // to false and yank admins out of /admin/* via the route gates.
  const lastCheckedUserId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function checkAdminRole() {
      if (!user) {
        if (lastCheckedUserId.current === null) setIsAdmin(false);
        setLoading(false);
        return;
      }
      if (lastCheckedUserId.current === user.id) {
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          console.error('Error checking admin role:', error);
          setIsAdmin(false);
        } else {
          setIsAdmin(!!data);
          lastCheckedUserId.current = user.id;
        }
      } catch (err) {
        console.error('Failed to check admin role:', err);
        if (!cancelled) setIsAdmin(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (!authLoading) checkAdminRole();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  return { isAdmin, loading: loading || authLoading };
}
