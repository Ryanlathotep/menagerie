// Hook + helpers for the public username system used by leaderboards.
//
// - `useMyUsername()` returns the signed-in user's current username (or null).
// - `setMyUsername(name)` validates client-side and calls the secure RPC.
// - `submitTowerFloor(towerId, floor, …)` posts a best-floor; it's a no-op for
//   signed-out users and silently skipped if no username has been set yet.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export const USERNAME_REGEX = /^[A-Za-z0-9_-]{3,20}$/;

export function validateUsername(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return 'Username cannot be empty';
  if (!USERNAME_REGEX.test(trimmed)) {
    return 'Use 3–20 characters: letters, numbers, _ or -';
  }
  return null;
}

export function useMyUsername() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setUsername(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc('get_my_username');
    if (error) {
      console.error('get_my_username failed', error);
      setUsername(null);
    } else {
      setUsername((data as string | null) ?? null);
    }
    setLoading(false);
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (authLoading) return;
    refresh();
  }, [authLoading, refresh]);

  return { username, loading: authLoading || loading, refresh, isAuthenticated };
}

export async function setMyUsername(name: string): Promise<{ ok: true; username: string } | { ok: false; error: string }> {
  const localError = validateUsername(name);
  if (localError) return { ok: false, error: localError };
  const { data, error } = await supabase.rpc('set_username', { _username: name.trim() });
  if (error) return { ok: false, error: error.message };
  const result = data as { username?: string } | null;
  return { ok: true, username: result?.username ?? name.trim() };
}

export async function submitTowerFloor(
  towerId: string,
  floor: number,
  partySnapshot?: unknown,
  runSeconds?: number,
): Promise<void> {
  if (!towerId || !Number.isFinite(floor) || floor < 1) return;
  try {
    await supabase.rpc('submit_tower_floor', {
      _tower_id: towerId,
      _floor: Math.floor(floor),
      _party_snapshot: (partySnapshot ?? null) as never,
      _run_seconds: runSeconds ?? null,
    });
  } catch (e) {
    // Leaderboard submission is best-effort; never block gameplay.
    console.warn('submit_tower_floor failed', e);
  }
}
