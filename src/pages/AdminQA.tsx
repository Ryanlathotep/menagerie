import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useGame, GameProvider } from '@/game/state';
import { useAuth } from '@/hooks/useAuth';
import { useAdminRole } from '@/hooks/useAdminRole';
import { runAllInvariants, summarize, type InvariantResult } from '@/dev/qaInvariants';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface QaRunRow {
  id: string;
  ran_at: string;
  pass_count: number;
  fail_count: number;
  results: InvariantResult[];
  notes: string | null;
}

export default function AdminQA() {
  const { state } = useGame();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdminRole();
  const [results, setResults] = useState<InvariantResult[] | null>(null);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<QaRunRow[]>([]);
  const [savingHistory, setSavingHistory] = useState(false);
  const [consoleErrors, setConsoleErrors] = useState<string[]>([]);

  // Capture console errors that occur while the panel is open.
  useEffect(() => {
    const original = console.error;
    console.error = (...args: unknown[]) => {
      setConsoleErrors(prev => [...prev.slice(-49), args.map(a => (a instanceof Error ? a.message : String(a))).join(' ')]);
      original(...args);
    };
    return () => { console.error = original; };
  }, []);

  const loadHistory = async () => {
    const { data, error } = await supabase
      .from('qa_runs')
      .select('id, ran_at, pass_count, fail_count, results, notes')
      .order('ran_at', { ascending: false })
      .limit(20);
    if (!error && data) setHistory(data as unknown as QaRunRow[]);
  };

  useEffect(() => { if (isAdmin) loadHistory(); }, [isAdmin]);

  const runSuite = async () => {
    setRunning(true);
    setConsoleErrors([]);
    try {
      const out = runAllInvariants(state);
      setResults(out);
      const s = summarize(out);
      if (user) {
        setSavingHistory(true);
        const { error } = await supabase.from('qa_runs').insert([{
          user_id: user.id,
          pass_count: s.pass,
          fail_count: s.fail,
          results: JSON.parse(JSON.stringify(out)),
          console_errors: JSON.parse(JSON.stringify(consoleErrors)),
          app_version: 'menagerie',
          world_seed: (state.saveData as { _worldSeed?: number })._worldSeed ?? null,
        }]);
        setSavingHistory(false);
        if (!error) loadHistory();
      }
    } finally {
      setRunning(false);
    }
  };

  const summary = useMemo(() => results ? summarize(results) : null, [results]);
  const suggestions = useMemo(() => results ? buildSuggestions(results) : [], [results]);

  if (authLoading || adminLoading) return <div className="p-6">Loading…</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Menagerie QA</h1>
            <p className="text-sm text-muted-foreground">In-app regression suite for persistence, inventory, and reducer invariants.</p>
          </div>
          <Link to="/" className="text-sm underline">← Back to game</Link>
        </header>

        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={runSuite} disabled={running}>
              {running ? 'Running…' : 'Run Smoke Test'}
            </Button>
            {summary && (
              <>
                <Badge variant={summary.fail === 0 ? 'default' : 'destructive'}>
                  {summary.pass}/{summary.total} passed
                </Badge>
                {savingHistory && <span className="text-xs text-muted-foreground">saving…</span>}
              </>
            )}
          </div>

          {results && (
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2 w-16">Result</th>
                    <th className="text-left p-2">Invariant</th>
                    <th className="text-left p-2">Detail</th>
                    <th className="text-left p-2 w-24">Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map(r => (
                    <tr key={r.id} className="border-t">
                      <td className="p-2">{r.pass ? '✅' : '❌'}</td>
                      <td className="p-2 font-medium">{r.name}</td>
                      <td className="p-2 text-muted-foreground">{r.detail}{r.memoryRef && <div className="text-xs mt-1 opacity-70">mem://{r.memoryRef}</div>}</td>
                      <td className="p-2 uppercase text-xs">{r.severity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="border rounded-md p-3 bg-destructive/5 space-y-2">
              <h3 className="font-semibold">Suggested fixes</h3>
              <ul className="list-disc list-inside text-sm space-y-1">
                {suggestions.map(s => <li key={s.id}>{s.suggestion}</li>)}
              </ul>
            </div>
          )}

          {consoleErrors.length > 0 && (
            <div className="border rounded-md p-3 bg-warning/5">
              <h3 className="font-semibold text-sm mb-1">Console errors during run ({consoleErrors.length})</h3>
              <ScrollArea className="h-24">
                <ul className="text-xs font-mono space-y-1">
                  {consoleErrors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </ScrollArea>
            </div>
          )}
        </Card>

        <Card className="p-4 space-y-2">
          <h2 className="font-semibold">History (last 20)</h2>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No runs recorded yet.</p>
          ) : (
            <ScrollArea className="h-64">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2">When</th>
                    <th className="text-left p-2">Pass</th>
                    <th className="text-left p-2">Fail</th>
                    <th className="text-left p-2">Failing invariants</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(h => {
                    const failing = (h.results ?? []).filter(r => !r.pass).map(r => r.id).join(', ');
                    return (
                      <tr key={h.id} className="border-t">
                        <td className="p-2">{new Date(h.ran_at).toLocaleString()}</td>
                        <td className="p-2">{h.pass_count}</td>
                        <td className="p-2">{h.fail_count}</td>
                        <td className="p-2 text-xs text-muted-foreground">{failing || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ScrollArea>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="font-semibold mb-1">Debug bridge</h2>
          <p className="text-sm text-muted-foreground">
            Open browser DevTools and call <code className="bg-muted px-1 rounded">window.__menagerie.help()</code> for the full bridge API,
            or <code className="bg-muted px-1 rounded">window.__menagerie.runSmokeTest()</code> to run this suite from the console.
          </p>
        </Card>
      </div>
    </div>
  );
}

function buildSuggestions(results: InvariantResult[]) {
  const map: Record<string, string> = {
    'end-run-persists-four': 'Inspect src/game/state.ts END_RUN reducer (~line 362) and persistRunPartyProgress (~line 74). The four-field write must go through the canonical helper.',
    'flee-persists-four': 'Inspect FLEE_DUNGEON reducer (~line 465). It must call persistRunPartyProgress like END_RUN does — never write unlockedMonsters inline.',
    'pre-run-unequip-recovery': 'Check START_RUN recovery block in state.ts (~line 292-320). The diff between member.equipment and final selection must be pushed onto mergedStorage.',
    'mastery-merge-max': 'persistRunPartyProgress mastery merge regressed. Verify the max-uses comparison at state.ts ~line 95.',
    'unified-inventory-live': 'Find the most recent ADD_ITEM / USE_ITEM / DROP_ITEM change. Both run.inventory and saveData.storedItems must be mirrored in the same case.',
    'corrupt-save-tolerance': 'Helper threw or returned empty on missing moveMastery. Add a guard like (existing.moveMastery || {}) where it iterates mastery entries.',
  };
  return results.filter(r => !r.pass).map(r => ({ id: r.id, suggestion: map[r.id] || r.detail }));
}
