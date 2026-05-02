// Top-N leaderboard of players ranked by overworld tiles explored.
// Public read via the `get_exploration_leaderboard` RPC — no auth required.

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Compass, Loader2 } from 'lucide-react';

interface ExplorationEntry {
  rank: number;
  user_id: string;
  username: string;
  tiles_explored: number;
  world_seed: number | null;
  achieved_at: string;
}

export function ExplorationLeaderboard({ limit = 10 }: { limit?: number }) {
  const [rows, setRows] = useState<ExplorationEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    supabase
      .rpc('get_exploration_leaderboard', { _limit: limit })
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) {
          setError(err.message);
          setRows([]);
        } else {
          setRows((data as ExplorationEntry[]) ?? []);
        }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [limit]);

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        <Compass className="w-3.5 h-3.5 text-emerald-600" />
        Most Tiles Explored — Top {limit}
      </div>

      {loading && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-1">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
        </div>
      )}

      {!loading && error && (
        <div className="text-xs text-destructive">Failed to load: {error}</div>
      )}

      {!loading && !error && rows && rows.length === 0 && (
        <div className="text-xs text-muted-foreground italic">
          No explorers ranked yet — set a username and explore the overworld to appear here.
        </div>
      )}

      {!loading && !error && rows && rows.length > 0 && (
        <ol className="space-y-0.5">
          {rows.map(r => (
            <li
              key={r.user_id}
              className="flex items-baseline justify-between gap-2 text-xs"
            >
              <span className="flex items-baseline gap-1.5 min-w-0">
                <span
                  className={`font-mono w-6 text-right ${
                    r.rank === 1 ? 'text-amber-500 font-bold' :
                    r.rank === 2 ? 'text-zinc-400 font-bold' :
                    r.rank === 3 ? 'text-amber-700 font-bold' :
                    'text-muted-foreground'
                  }`}
                >
                  {r.rank}.
                </span>
                <span className="truncate font-medium">{r.username}</span>
                {r.world_seed != null && (
                  <span
                    className="font-mono text-[10px] text-muted-foreground/80"
                    title={`World seed: ${r.world_seed}`}
                  >
                    🌱{r.world_seed}
                  </span>
                )}
              </span>
              <span className="font-mono text-foreground">
                {r.tiles_explored.toLocaleString()}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
