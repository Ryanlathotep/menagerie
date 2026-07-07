/**
 * Admin Arena Room Editor — MVP framework. Ships with the plain oval preset;
 * admins can clone it and tweak floor color, rim color, crowd density.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getAllRooms, saveCustomRooms, DEFAULT_ROOMS } from '@/game/arena/arenaRooms';
import type { ArenaRoom } from '@/game/arena/types';
import { CrowdRing } from '@/game/arena/CrowdRing';
import { toast } from '@/hooks/use-toast';

export function ArenaRoomEditor() {
  const [rooms, setRooms] = useState<ArenaRoom[]>(() => getAllRooms());
  const [selectedId, setSelectedId] = useState<string>(rooms[0].id);
  const current = rooms.find(r => r.id === selectedId) ?? rooms[0];

  const update = (patch: Partial<ArenaRoom>) => {
    const next = rooms.map(r => r.id === selectedId ? { ...r, ...patch } : r);
    setRooms(next);
  };
  const save = () => { saveCustomRooms(rooms); toast({ title: 'Rooms saved.' }); };
  const clone = () => {
    const id = `custom_${Date.now()}`;
    const c: ArenaRoom = { ...current, id, name: `${current.name} Copy` };
    setRooms([...rooms, c]);
    setSelectedId(id);
  };
  const del = () => {
    if (DEFAULT_ROOMS.some(d => d.id === selectedId)) { toast({ title: 'Cannot delete built-in preset', variant: 'destructive' as any }); return; }
    const next = rooms.filter(r => r.id !== selectedId);
    setRooms(next);
    setSelectedId(next[0]?.id ?? DEFAULT_ROOMS[0].id);
  };

  const isBuiltin = DEFAULT_ROOMS.some(d => d.id === current.id);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card className="p-3 space-y-3">
        <div>
          <label className="text-xs font-semibold">Room</label>
          <select className="w-full border rounded px-2 py-1 text-sm bg-background"
            value={selectedId} onChange={e => setSelectedId(e.target.value)}>
            {rooms.map(r => <option key={r.id} value={r.id}>{r.name}{DEFAULT_ROOMS.some(d => d.id === r.id) ? ' (built-in)' : ''}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold">Name</label>
          <Input value={current.name} onChange={e => update({ name: e.target.value })} disabled={isBuiltin}/>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-semibold">Floor color</label>
            <Input value={current.floorColor} onChange={e => update({ floorColor: e.target.value })} disabled={isBuiltin}/>
          </div>
          <div>
            <label className="text-xs font-semibold">Rim color</label>
            <Input value={current.rimColor} onChange={e => update({ rimColor: e.target.value })} disabled={isBuiltin}/>
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold">Crowd density ({current.crowdDensity})</label>
          <input type="range" min={8} max={80} value={current.crowdDensity}
            onChange={e => update({ crowdDensity: Number(e.target.value) })}
            disabled={isBuiltin} className="w-full" />
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={save}>Save all</Button>
          <Button size="sm" variant="outline" onClick={clone}>Clone this</Button>
          <Button size="sm" variant="destructive" onClick={del} disabled={isBuiltin}>Delete</Button>
        </div>
      </Card>

      <Card className="p-3">
        <div className="text-xs font-semibold mb-2">Preview</div>
        <div className="relative w-full aspect-[7/5] rounded-lg overflow-hidden"
             style={{ background: 'linear-gradient(180deg, hsl(28 45% 88%), hsl(28 35% 78%))' }}>
          <div className="absolute inset-4 rounded-[50%]"
               style={{
                 background: current.floorColor,
                 border: `6px solid ${current.rimColor}`,
                 boxShadow: 'inset 0 0 22px rgba(0,0,0,0.15)',
               }}/>
          <CrowdRing count={current.crowdDensity} species={current.crowdSpecies}/>
        </div>
      </Card>
    </div>
  );
}
