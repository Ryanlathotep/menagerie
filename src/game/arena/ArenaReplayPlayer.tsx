/**
 * Replay player — step through recorded ReplayEvents on an ArenaBoard, with
 * play/pause/step controls and a scrollable action log sidebar.
 */
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ArenaReplay } from './types';
import { ArenaBoard } from './ArenaBoard';
import { Play, Pause, SkipBack, SkipForward, ChevronsRight, ChevronsLeft } from 'lucide-react';

interface Props {
  replay: ArenaReplay;
  onClose?: () => void;
}

export function ArenaReplayPlayer({ replay, onClose }: Props) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(600); // ms per step
  const [filter, setFilter] = useState<'all' | 'crits' | 'faints'>('all');

  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => {
      setIdx(i => {
        if (i >= replay.log.length - 1) { setPlaying(false); return i; }
        return i + 1;
      });
    }, speed);
    return () => clearTimeout(t);
  }, [playing, idx, speed, replay.log.length]);

  const filtered = useMemo(() => {
    return replay.log.map((ev, i) => ({ ev, i }))
      .filter(({ ev }) => filter === 'all' ? true : filter === 'crits' ? ev.crit : ev.faint);
  }, [replay.log, filter]);

  const winnerName = replay.winner === 'A' ? replay.teamA.name : replay.winner === 'B' ? replay.teamB.name : 'Draw';

  return (
    <div className="flex flex-col lg:flex-row gap-3 w-full">
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">
              <span className="text-blue-500">{replay.teamA.name}</span>
              <span className="mx-2 text-muted-foreground">vs</span>
              <span className="text-red-500">{replay.teamB.name}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Winner: <b>{winnerName}</b> · {replay.turns} turns · seed {replay.seed}
            </div>
          </div>
          {onClose && <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>}
        </div>
        <ArenaBoard replay={replay} currentEventIndex={idx} />
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Button size="icon" variant="outline" onClick={() => setIdx(0)}><SkipBack className="h-4 w-4" /></Button>
          <Button size="icon" variant="outline" onClick={() => setIdx(i => Math.max(0, i - 1))}><ChevronsLeft className="h-4 w-4" /></Button>
          <Button size="icon" variant="default" onClick={() => setPlaying(p => !p)}>
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button size="icon" variant="outline" onClick={() => setIdx(i => Math.min(replay.log.length - 1, i + 1))}><ChevronsRight className="h-4 w-4" /></Button>
          <Button size="icon" variant="outline" onClick={() => setIdx(replay.log.length - 1)}><SkipForward className="h-4 w-4" /></Button>
          <span className="ml-2 text-muted-foreground">Turn {idx + 1}/{replay.log.length}</span>
          <select className="ml-auto border rounded px-2 py-1 text-xs bg-background"
            value={speed} onChange={e => setSpeed(Number(e.target.value))}>
            <option value={1200}>0.5x</option>
            <option value={600}>1x</option>
            <option value={300}>2x</option>
            <option value={100}>6x</option>
          </select>
        </div>
      </div>
      <div className="w-full lg:w-80 border rounded-md p-2">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold">Log</span>
          <select className="ml-auto border rounded px-2 py-0.5 text-xs bg-background"
            value={filter} onChange={e => setFilter(e.target.value as any)}>
            <option value="all">All ({replay.log.length})</option>
            <option value="crits">Crits</option>
            <option value="faints">Faints</option>
          </select>
        </div>
        <ScrollArea className="h-[420px] pr-2">
          <ol className="space-y-1 text-xs">
            {filtered.map(({ ev, i }) => (
              <li key={i}
                className={`px-2 py-1 rounded cursor-pointer border ${i === idx ? 'bg-primary/10 border-primary' : 'border-transparent hover:bg-muted'}`}
                onClick={() => { setIdx(i); setPlaying(false); }}>
                <span className={ev.actorTeam === 'A' ? 'text-blue-500' : 'text-red-500'}>[{ev.actorTeam}]</span>{' '}
                <span className="text-muted-foreground">T{ev.turn}</span>{' '}
                {ev.message}
                {ev.crit && <span className="text-amber-500"> ✦crit</span>}
                {ev.faint && <span className="text-destructive"> ☠</span>}
              </li>
            ))}
          </ol>
        </ScrollArea>
      </div>
    </div>
  );
}
