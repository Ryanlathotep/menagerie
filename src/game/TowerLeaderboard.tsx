// Renders the top players for a single tower. Fetches lazily on mount via
// the public RPC `get_tower_leaderboard` (no auth required to view).

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Trophy, Loader2 } from 'lucide-react';

interface LeaderboardEntry {
  rank: number;
  username: string;
  best_floor: number;
  party_snapshot: unknown;
  run_seconds: number | null;
  achieved_at: string;
}

interface TowerLeaderboardProps {
  towerId: string;
  limit?: number;
}

export function TowerLeaderboard({ towerId, limit = 10 }: TowerLeaderboardProps) {
  const [rows, setRows] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    supabase
      .rpc('get_tower_leaderboard', { _tower_id: towerId, _limit: limit })
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) {
          setError(err.message);
          setRows([]);
        } else {
          setRows((data as LeaderboardEntry[]) ?? []);
        }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [towerId, limit]);

  return (
    <div className="mt-2 rounded-md border bg-muted/30 p-2 space-y-1">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
        <Trophy className="w-3 h-3 text-amber-500" />
        Top Floors
      </div>

      {loading && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground py-1">
          <Loader2 className="w-3 h-3 animate-spin" /> Loading…
        </div>
      )}

      {!loading && error && (
        <div className="text-[11px] text-destructive">Failed to load: {error}</div>
      )}

      {!loading && !error && rows && rows.length === 0 && (
        <div className="text-[11px] text-muted-foreground italic">
          No floors recorded yet — be the first!
        </div>
      )}

      {!loading && !error && rows && rows.length > 0 && (
        <ol className="space-y-0.5">
          {rows.map(r => (
            <li key={r.rank} className="flex items-baseline justify-between gap-2 text-[11px]">
              <span className="flex items-baseline gap-1.5 min-w-0">
                <span
                  className={`font-mono w-5 text-right ${
                    r.rank === 1 ? 'text-amber-500 font-bold' :
                    r.rank === 2 ? 'text-zinc-400 font-bold' :
                    r.rank === 3 ? 'text-amber-700 font-bold' :
                    'text-muted-foreground'
                  }`}
                >
                  {r.rank}.
                </span>
                <span className="truncate font-medium">{r.username}</span>
              </span>
              <span className="font-mono text-foreground">F{r.best_floor}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
