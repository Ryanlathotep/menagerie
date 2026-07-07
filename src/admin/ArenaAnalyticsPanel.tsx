/**
 * Arena Analytics Panel — pulls from localStorage-backed arena state and
 * summarizes win rates by element/class/species and move usage.
 */
import { useMemo, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { loadArenaState, saveArenaState } from '@/game/arena/state';
import { byClass, byElement, bySpecies, byMove, balanceSuggestions } from '@/game/arena/analytics';
import type { ArenaState } from '@/game/arena/types';

export function ArenaAnalyticsPanel() {
  const [arena, setArena] = useState<ArenaState>(() => loadArenaState());
  useEffect(() => {
    const id = setInterval(() => setArena(loadArenaState()), 5000);
    return () => clearInterval(id);
  }, []);

  const rows = arena.analytics;
  const elem = useMemo(() => byElement(rows), [rows]);
  const cls = useMemo(() => byClass(rows), [rows]);
  const sp = useMemo(() => bySpecies(rows), [rows]);
  const mv = useMemo(() => byMove(rows), [rows]);
  const suggestions = [
    ...balanceSuggestions(elem, 'Element'),
    ...balanceSuggestions(cls, 'Class'),
    ...balanceSuggestions(sp, 'Species'),
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Arena Analytics</div>
          <div className="text-xs text-muted-foreground">
            {rows.length} matches recorded · buffer cap 5,000
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setArena(loadArenaState())}>Refresh</Button>
          <Button size="sm" variant="destructive"
            onClick={() => {
              const cleared: ArenaState = { ...arena, analytics: [] };
              saveArenaState(cleared); setArena(cleared);
            }}>Clear analytics</Button>
        </div>
      </div>

      {suggestions.length > 0 && (
        <Card className="p-3 bg-amber-500/10">
          <div className="text-xs font-semibold mb-1">💡 Balance suggestions</div>
          <ul className="text-xs space-y-1">{suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <StatTable title="By element" rows={elem}/>
        <StatTable title="By class" rows={cls}/>
        <StatTable title="By species" rows={sp}/>
      </div>

      <Card className="p-3">
        <div className="text-sm font-semibold mb-2">Move usage (top 30)</div>
        <ScrollArea className="h-72">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr><th className="text-left">Move</th><th>Uses</th><th>Avg dmg</th><th>Crit%</th></tr>
            </thead>
            <tbody>
              {mv.slice(0, 30).map(m => (
                <tr key={m.moveId} className="border-t">
                  <td className="text-left py-1">{m.moveId}</td>
                  <td className="text-center">{m.uses}</td>
                  <td className="text-center">{m.avgDamage.toFixed(1)}</td>
                  <td className="text-center">{(m.critRate * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      </Card>
    </div>
  );
}

function StatTable({ title, rows }: { title: string; rows: Array<{ key: string; matches: number; wins: number; winRate: number; avgDmgDealt: number }> }) {
  return (
    <Card className="p-3">
      <div className="text-sm font-semibold mb-2">{title}</div>
      <table className="w-full text-xs">
        <thead className="text-muted-foreground">
          <tr><th className="text-left">Key</th><th>W/M</th><th>Win%</th><th>Avg dmg</th></tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.key} className="border-t">
              <td className="text-left py-1 capitalize">{r.key}</td>
              <td className="text-center">{r.wins}/{r.matches}</td>
              <td className="text-center">{(r.winRate * 100).toFixed(1)}%</td>
              <td className="text-center">{r.avgDmgDealt.toFixed(0)}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={4} className="text-center py-3 text-muted-foreground">No data yet</td></tr>}
        </tbody>
      </table>
    </Card>
  );
}
