/**
 * Arena Hub — the modal that opens when the player interacts with an arena
 * building. Tabs: Tournaments, My Teams, Betting, Replays, Shop.
 */
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, Trophy, Coins, Users, ClipboardList, Store, Ticket, Swords } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  loadArenaState, saveArenaState, ensureFutureTournament, fillTournamentWithNpcs,
} from './state';
import type { ArenaBet, ArenaState, ArenaTeam, ArenaTournament, Cadence } from './types';
import { CADENCE_MS } from './types';
import { resolveTournament } from './tournament';
import { computePool, seedNpcBets } from './betting';
import { ArenaReplayPlayer } from './ArenaReplayPlayer';
import { ARENA_SHOP } from './shop';
import { PracticeDuel } from './PracticeDuel';
import { STRATEGY_PRESETS } from './strategyPresets';
import { ArenaChampionsLeaderboard } from './ArenaChampionsLeaderboard';
import { useGame } from "@/game/state";

interface ArenaHubProps {
  onClose: () => void;
}

export function ArenaHub({ onClose }: ArenaHubProps) {
  const { state, dispatch } = useGame();
  const [arena, setArena] = useState<ArenaState>(() => loadArenaState());
  const [now, setNow] = useState(Date.now());
  const [openReplay, setOpenReplay] = useState<string | null>(null);

  // Persist arena state on every change
  useEffect(() => { saveArenaState(arena); }, [arena]);
  // Tick clock every second for countdowns
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);

  // Auto-resolve any tournament whose time has passed
  useEffect(() => {
    let s = arena;
    let changed = false;
    for (const cadence of ['daily', 'weekly', 'monthly'] as Cadence[]) {
      const t = s.tournaments[cadence];
      if (!t.resolved && t.startsAt <= now) {
        const filled = fillTournamentWithNpcs(t);
        s = { ...s, tournaments: { ...s.tournaments, [cadence]: filled } };
        const result = resolveTournament(s, cadence, state.saveData.unlockedMonsters);
        s = result.state;
        if (result.payoutsToPlayer > 0) {
          dispatch({ type: 'ADD_TOWN_GOLD', amount: result.payoutsToPlayer } as any);
          toast({ title: `Arena payout: ${result.payoutsToPlayer}gp`, description: `${cadence} tournament settled.` });
        } else {
          toast({ title: `${cadence} tournament resolved`, description: `Winner: ${s.tournaments[cadence].teams.find(x => x.id === result.winnerId)?.name ?? '—'}` });
        }
        // Roll to the next cycle
        s = ensureFutureTournament(s, cadence, now + 1000);
        changed = true;
      }
    }
    if (changed) setArena(s);
  }, [now]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 bg-background/70 backdrop-blur-sm z-50 flex items-center justify-center p-2">
      <Card className="w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">
        <div className="p-3 border-b flex items-center justify-between bg-gradient-to-r from-amber-500/10 to-red-500/10">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" /> The Arena
            </h2>
            <p className="text-xs text-muted-foreground">
              Tournaments · Bets · Replays · Arena Shop
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm flex items-center gap-1"><Coins className="h-4 w-4 text-amber-500"/> {state.saveData.gold ?? 0} gp</span>
            <span className="text-sm flex items-center gap-1"><Ticket className="h-4 w-4 text-purple-500"/> {arena.currency} tokens</span>
            <Button size="icon" variant="ghost" onClick={onClose}><X className="h-4 w-4"/></Button>
          </div>
        </div>

        <Tabs defaultValue="tournaments" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-3 mt-2 justify-start">
            <TabsTrigger value="tournaments"><Trophy className="h-4 w-4 mr-1"/>Tournaments</TabsTrigger>
            <TabsTrigger value="teams"><Users className="h-4 w-4 mr-1"/>My Teams</TabsTrigger>
            <TabsTrigger value="bets"><ClipboardList className="h-4 w-4 mr-1"/>Bets</TabsTrigger>
            <TabsTrigger value="replays">🎞️ Replays</TabsTrigger>
            <TabsTrigger value="practice"><Swords className="h-4 w-4 mr-1"/>Practice</TabsTrigger>
            <TabsTrigger value="shop"><Store className="h-4 w-4 mr-1"/>Shop</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1">
            <TabsContent value="tournaments" className="p-3 space-y-3">
              {(['daily', 'weekly', 'monthly'] as Cadence[]).map(cadence => (
                <TournamentCard
                  key={cadence}
                  cadence={cadence}
                  now={now}
                  arena={arena}
                  setArena={setArena}
                />
              ))}
            </TabsContent>

            <TabsContent value="teams" className="p-3 space-y-3">
              <TeamsTab arena={arena} setArena={setArena} />
            </TabsContent>

            <TabsContent value="bets" className="p-3">
              <BetsTab arena={arena} setArena={setArena} playerGold={state.saveData.gold ?? 0}
                onSpend={(amt) => dispatch({ type: 'SPEND_TOWN_GOLD', amount: amt } as any)} />
            </TabsContent>

            <TabsContent value="replays" className="p-3 space-y-2">
              {arena.replays.length === 0 && <p className="text-sm text-muted-foreground">No replays yet. Wait for a tournament to resolve.</p>}
              {openReplay ? (
                (() => {
                  const r = arena.replays.find(x => x.id === openReplay);
                  return r ? <ArenaReplayPlayer replay={r} onClose={() => setOpenReplay(null)} /> : null;
                })()
              ) : (
                <ul className="divide-y">
                  {[...arena.replays].reverse().map(r => (
                    <li key={r.id} className="flex items-center justify-between py-2">
                      <div>
                        <div className="text-sm">
                          <b className="text-blue-500">{r.teamA.name}</b>
                          <span className="mx-1 text-muted-foreground">vs</span>
                          <b className="text-red-500">{r.teamB.name}</b>
                          <span className="text-xs text-muted-foreground ml-2">
                            · {r.cadence} · {r.turns} turns · winner {r.winner === 'A' ? r.teamA.name : r.winner === 'B' ? r.teamB.name : 'Draw'}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setOpenReplay(r.id)}>Watch</Button>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="practice" className="p-3">
              <PracticeDuel arena={arena} unlocked={state.saveData.unlockedMonsters ?? []} />
            </TabsContent>

            <TabsContent value="shop" className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              {ARENA_SHOP.map(entry => {
                const owned = arena.purchasedItems.includes(entry.item.id);
                const canBuy = arena.currency >= entry.cost && !owned;
                return (
                  <Card key={entry.item.id} className="p-3">
                    <div className="flex items-start gap-3">
                      <div className="text-2xl">{entry.item.icon}</div>
                      <div className="flex-1">
                        <div className="font-semibold text-sm">{entry.item.name}</div>
                        <div className="text-xs text-muted-foreground">{entry.item.description}</div>
                        <div className="text-[11px] mt-1">{entry.flavor}</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs">{entry.cost} 🎟️</span>
                      <Button size="sm" disabled={!canBuy}
                        onClick={() => {
                          setArena(s => ({
                            ...s,
                            currency: s.currency - entry.cost,
                            purchasedItems: [...s.purchasedItems, entry.item.id],
                          }));
                          dispatch({ type: 'ADD_EQUIPMENT', item: entry.item } as any);
                          toast({ title: `Bought ${entry.item.name}` });
                        }}>
                        {owned ? 'Owned' : 'Buy'}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </Card>
    </div>
  );
}

// ─── Tournament card ─────────────────────────────────────────

function TournamentCard({
  cadence, now, arena, setArena,
}: { cadence: Cadence; now: number; arena: ArenaState; setArena: React.Dispatch<React.SetStateAction<ArenaState>> }) {
  const { state } = useGame();
  const t = arena.tournaments[cadence];
  const remaining = Math.max(0, t.startsAt - now);
  const playerHasEntry = t.teams.some(x => x.ownerId === 'player');
  const canEnter = arena.playerTeams.length > 0 && !playerHasEntry;

  return (
    <Card className="p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold capitalize flex items-center gap-2">
            {cadence === 'daily' ? '🌅' : cadence === 'weekly' ? '📅' : '📆'} {cadence} tournament
          </div>
          <div className="text-xs text-muted-foreground">
            Starts in <b>{formatDuration(remaining)}</b> · seed {t.seed} · {t.teams.length}/8 teams
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!playerHasEntry && (
            <select className="border rounded px-2 py-1 text-xs bg-background"
              onChange={e => {
                const teamId = e.target.value;
                if (!teamId) return;
                const team = arena.playerTeams.find(x => x.id === teamId);
                if (!team) return;
                setArena(s => ({
                  ...s,
                  tournaments: {
                    ...s.tournaments,
                    [cadence]: { ...s.tournaments[cadence], teams: [...s.tournaments[cadence].teams, team].slice(0, 8) },
                  },
                }));
                toast({ title: `Entered ${team.name} in ${cadence} tournament` });
              }}
              defaultValue="">
              <option value="">Enter team…</option>
              {arena.playerTeams.map(pt => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
            </select>
          )}
          <Button size="sm" variant="outline"
            onClick={() => {
              const filled = fillTournamentWithNpcs(t);
              let s: ArenaState = { ...arena, tournaments: { ...arena.tournaments, [cadence]: filled } };
              const r = resolveTournament(s, cadence, state.saveData.unlockedMonsters);
              s = ensureFutureTournament(r.state, cadence, Date.now() + 1000);
              setArena(s);
              toast({ title: 'Tournament resolved now', description: `Winner: ${filled.teams.find(x => x.id === r.winnerId)?.name ?? '—'}` });
            }}>
            Simulate now
          </Button>
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        {canEnter ? '✅ You can enter — bracket fills with NPCs on resolve.' : playerHasEntry ? '🏳️ Your team is queued.' : '⚠️ Save a team on the "My Teams" tab first.'}
      </div>
    </Card>
  );
}

function formatDuration(ms: number): string {
  if (ms <= 0) return 'now!';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

// ─── Teams tab ─────────────────────────────────────────

function TeamsTab({ arena, setArena }: { arena: ArenaState; setArena: React.Dispatch<React.SetStateAction<ArenaState>> }) {
  const { state } = useGame();
  const [name, setName] = useState('My Team');
  const [selected, setSelected] = useState<string[]>([]);
  const unlocked = state.saveData.unlockedMonsters ?? [];

  return (
    <div className="space-y-4">
      <Card className="p-3 space-y-2">
        <div className="text-sm font-semibold">Create a team (up to 6)</div>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Team name" />
        <div className="text-xs text-muted-foreground">Selected: {selected.length}/6</div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-64 overflow-auto p-1">
          {unlocked.map(m => {
            const active = selected.includes(m.comboId);
            return (
              <button key={m.comboId}
                onClick={() => setSelected(sel => active ? sel.filter(x => x !== m.comboId) : sel.length < 6 ? [...sel, m.comboId] : sel)}
                className={`text-left border rounded p-2 text-xs ${active ? 'border-primary bg-primary/10' : 'hover:bg-muted'}`}>
                <div className="font-medium capitalize">{m.element} {m.species}</div>
                <div className="text-muted-foreground">{m.classType} · L{m.level}</div>
              </button>
            );
          })}
        </div>
        <Button size="sm" disabled={selected.length === 0}
          onClick={() => {
            const avgLevel = selected.reduce((sum, id) => {
              const um = unlocked.find(x => x.comboId === id);
              return sum + (um?.level ?? 1);
            }, 0) / Math.max(1, selected.length);
            const team: ArenaTeam = {
              id: `player_${Date.now()}`, name: name || 'My Team', ownerId: 'player',
              memberCombos: selected, level: Math.round(avgLevel), banner: '⭐',
            };
            setArena(s => ({ ...s, playerTeams: [...s.playerTeams, team] }));
            setSelected([]); setName('My Team');
            toast({ title: `Saved team "${team.name}"` });
          }}>
          Save team
        </Button>
      </Card>

      <div className="space-y-2">
        <div className="text-sm font-semibold">Saved teams</div>
        {arena.playerTeams.length === 0 && <p className="text-xs text-muted-foreground">No teams yet.</p>}
        {arena.playerTeams.map(t => (
          <Card key={t.id} className="p-2 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">{t.banner} {t.name} <span className="text-xs text-muted-foreground">(avg L{t.level})</span></div>
              <div className="text-[11px] text-muted-foreground">{t.memberCombos.join(', ')}</div>
            </div>
            <Button size="sm" variant="destructive" onClick={() => setArena(s => ({ ...s, playerTeams: s.playerTeams.filter(x => x.id !== t.id) }))}>Delete</Button>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Bets tab ─────────────────────────────────────────

function BetsTab({
  arena, setArena, playerGold, onSpend,
}: { arena: ArenaState; setArena: React.Dispatch<React.SetStateAction<ArenaState>>; playerGold: number; onSpend: (amt: number) => void }) {
  const [wager, setWager] = useState<Record<string, number>>({});

  const open: Array<{ cadence: Cadence; t: ArenaTournament }> = [];
  for (const c of ['daily', 'weekly', 'monthly'] as Cadence[]) {
    open.push({ cadence: c, t: arena.tournaments[c] });
  }

  return (
    <div className="space-y-4">
      {open.map(({ cadence, t }) => {
        const filled = fillTournamentWithNpcs(t);
        // Preview R1 matches so bettors always have something to bet on
        const previewMatches = t.matches.length > 0 ? t.matches.filter(m => m.round === 1) :
          Array.from({ length: filled.teams.length / 2 }).map((_, i) => ({
            id: `preview_${cadence}_r1_${i}`,
            round: 1, teamAId: filled.teams[i * 2].id, teamBId: filled.teams[i * 2 + 1].id,
          }));
        return (
          <Card key={cadence} className="p-3 space-y-2">
            <div className="text-sm font-semibold capitalize">{cadence} — R1 matches</div>
            {previewMatches.map(m => {
              const npcBets = arena.bets.filter(b => b.matchId === m.id).length ? [] : seedNpcBets(m as any, t.seed);
              const combined = [...arena.bets.filter(b => b.matchId === m.id), ...npcBets];
              const pool = computePool(combined, m as any);
              const teamA = filled.teams.find(x => x.id === m.teamAId)!;
              const teamB = filled.teams.find(x => x.id === m.teamBId)!;
              const placeBet = (teamId: string) => {
                const amt = wager[m.id] ?? 0;
                if (amt <= 0) return;
                if (playerGold < amt) { toast({ title: 'Not enough gold', variant: 'destructive' as any }); return; }
                onSpend(amt);
                setArena(s => ({
                  ...s,
                  bets: [...s.bets.filter(b => !(b.matchId === m.id && b.bettor === 'player' && b.teamId === teamId)),
                    ...(s.bets.some(b => b.matchId === m.id && b.bettor === 'player' && b.teamId === teamId)
                      ? [{ ...s.bets.find(b => b.matchId === m.id && b.bettor === 'player' && b.teamId === teamId)!, amount: (s.bets.find(b => b.matchId === m.id && b.bettor === 'player' && b.teamId === teamId)!.amount + amt) }]
                      : [{ matchId: m.id, bettor: 'player', teamId, amount: amt, placedAt: Date.now() } as ArenaBet]),
                  ],
                }));
                toast({ title: `Bet ${amt}gp on ${teamId === m.teamAId ? teamA.name : teamB.name}` });
              };
              return (
                <div key={m.id} className="border rounded p-2 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <b className="text-blue-500">{teamA.name}</b>
                      <span className="mx-1 text-muted-foreground">vs</span>
                      <b className="text-red-500">{teamB.name}</b>
                    </div>
                    <div className="text-muted-foreground">Pool {pool.totalPool}gp · A {pool.perTeam[teamA.id] ?? 0} / B {pool.perTeam[teamB.id] ?? 0}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input type="number" min={1} className="h-7 w-24 text-xs"
                      value={wager[m.id] ?? ''} onChange={e => setWager(w => ({ ...w, [m.id]: Number(e.target.value) }))}
                      placeholder="Bet gp" />
                    <Button size="sm" variant="outline" onClick={() => placeBet(teamA.id)}>Bet on {teamA.name}</Button>
                    <Button size="sm" variant="outline" onClick={() => placeBet(teamB.id)}>Bet on {teamB.name}</Button>
                  </div>
                </div>
              );
            })}
          </Card>
        );
      })}
    </div>
  );
}
