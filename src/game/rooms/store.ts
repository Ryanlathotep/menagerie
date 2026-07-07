/** Room read/write helpers backed by game_data_overrides. */
import { supabase } from '@/integrations/supabase/client';
import type { Room } from './types';

const LOCAL_KEY = 'menagerie_rooms_v1_local';

export async function fetchRooms(): Promise<Room[]> {
  try {
    const { data, error } = await supabase
      .from('game_data_overrides')
      .select('data_key, data_value')
      .eq('data_type', 'room');
    if (error) throw error;
    const remote = (data ?? []).map(r => r.data_value as unknown as Room).filter(Boolean);
    return remote;
  } catch (e) {
    console.warn('[rooms] fetch failed, using local', e);
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '[]') as Room[]; } catch { return []; }
  }
}

export async function saveRoom(room: Room): Promise<boolean> {
  const value = { ...room, updatedAt: Date.now() };
  try {
    const { data: existing } = await supabase
      .from('game_data_overrides')
      .select('id')
      .eq('data_type', 'room')
      .eq('data_key', room.id)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase.from('game_data_overrides')
        .update({ data_value: value as any }).eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('game_data_overrides')
        .insert({ data_type: 'room', data_key: room.id, data_value: value as any });
      if (error) throw error;
    }
    return true;
  } catch (e) {
    console.warn('[rooms] save failed, mirror to local', e);
    try {
      const arr = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '[]') as Room[];
      const idx = arr.findIndex(r => r.id === room.id);
      if (idx >= 0) arr[idx] = value; else arr.push(value);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(arr));
      return true;
    } catch { return false; }
  }
}

export async function deleteRoom(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('game_data_overrides')
      .delete().eq('data_type', 'room').eq('data_key', id);
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn('[rooms] delete failed', e);
    return false;
  }
}

export function newBlankRoom(name = 'Untitled Room', w = 12, h = 8, tags: string[] = ['dungeon']): Room {
  const now = Date.now();
  return {
    id: `room_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name, width: w, height: h, cells: [], tags, towerIds: [],
    createdAt: now, updatedAt: now,
  };
}

export function duplicateRoom(r: Room): Room {
  const now = Date.now();
  return {
    ...r,
    id: `room_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name: `${r.name} (copy)`,
    createdAt: now,
    updatedAt: now,
  };
}
