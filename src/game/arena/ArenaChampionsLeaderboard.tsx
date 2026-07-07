/**
 * Read-only cross-server arena champions leaderboard.
 * Anon read is allowed by RLS; each authenticated user can upsert their own row per cadence.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Trophy, Loader2 } from 'lucide-react';
import type { Cadence } from './types';

interface Row {
  username: string;
  cadence: string;
  team_name: string;
  wins: number;
  world_seed: number | null;
  achieved_at: string;
}

interface Props {
  cadence: Cadence;
  limit?: number;
}

export function ArenaChampionsLeaderboard({ cadence, limit = 10 }: Props) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setErr(null);
    supabase
      .from('arena_champions')
      .select('username, cadence, team_name, wins, world_seed, achieved_at')
      .eq('cadence', cadence)
      .order('wins', { ascending: false })
      .order('achieved_at', { ascending: false })
      .limit(limit)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { setErr(error.message); setRows([]); }
        else setRows(data as Row[]);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [cadence, limit]);

  return (
    <div className="mt-1 rounded border bg-muted/30 p-2 space-y-1">
      <div className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
        <Trophy className="w-3 h-3 text-amber-500" />
        {cadence} champions (cross-server)
      </div>
      {loading && <div className="flex items-center gap-1 text-[11px] text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin"/>Loading…</div>}
      {!loading && err && <div className="text-[11px] text-destructive">{err}</div>}
      {!loading && !err && rows && rows.length === 0 && (
        <div className="text-[11px] text-muted-foreground italic">No champions yet — win a bracket to appear here!</div>
      )}
      {!loading && !err && rows && rows.length > 0 && (
        <ol className="space-y-0.5">
          {rows.map((r, i) => (
            <li key={`${r.username}_${i}`} className="flex items-baseline justify-between gap-2 text-[11px]">
              <span className="flex items-baseline gap-1 min-w-0">
                <span className={`font-mono w-5 text-right ${i === 0 ? 'text-amber-500 font-bold' : i === 1 ? 'text-zinc-400 font-bold' : i === 2 ? 'text-amber-700 font-bold' : 'text-muted-foreground'}`}>{i + 1}.</span>
                <span className="truncate">{r.username}</span>
                <span className="text-muted-foreground truncate">· {r.team_name}</span>
              </span>
              <span className="tabular-nums">{r.wins}🏆</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Called by tournament resolution when the player wins a bracket. Best-effort — silently no-ops when signed out. */
export async function submitArenaChampion(params: {
  cadence: Cadence;
  teamName: string;
  teamSnapshot: unknown;
  worldSeed: number | null;
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Fetch username; keep silent on failure.
    const { data: nameRow } = await supabase.from('usernames').select('username').eq('user_id', user.id).maybeSingle();
    const username = (nameRow?.username as string) ?? 'Anonymous';
    // Upsert: bump wins on the existing (user_id,cadence) row.
    const { data: existing } = await supabase
      .from('arena_champions')
      .select('id, wins')
      .eq('user_id', user.id)
      .eq('cadence', params.cadence)
      .maybeSingle();
    if (existing) {
      await supabase.from('arena_champions').update({
        wins: (existing.wins ?? 0) + 1,
        team_name: params.teamName,
        team_snapshot: params.teamSnapshot as any,
        world_seed: params.worldSeed,
        username,
        achieved_at: new Date().toISOString(),
      }).eq('id', existing.id);
    } else {
      await supabase.from('arena_champions').insert({
        user_id: user.id,
        username,
        cadence: params.cadence,
        team_name: params.teamName,
        team_snapshot: params.teamSnapshot as any,
        world_seed: params.worldSeed,
        wins: 1,
      });
    }
  } catch (e) {
    console.warn('[arena] submitArenaChampion failed', e);
  }
}
