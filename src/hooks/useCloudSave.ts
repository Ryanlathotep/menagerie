import { useCallback, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { SaveData } from '@/game/types';

function scoreSave(save: SaveData): number {
  const monsterScore = (save.unlockedMonsters || []).reduce(
    (acc, monster) => {
      const masteryUses = Object.values((monster as any).moveMastery || {}).reduce(
        (sum: number, mastery: any) => sum + (mastery?.uses || 0),
        0,
      ) as number;
      return acc + (monster.level || 1) * 5 + Math.floor((monster.experience || 0) / 100) + masteryUses;
    },
    0,
  );

  const overworld = save.overworldState as any;
  const exploredTiles = overworld?.__exploredTiles?.length
    ?? (overworld?.tileOverrides ? Object.keys(overworld.tileOverrides).length : 0);
  const buildings = overworld?.playerBuildings?.length || 0;
  const totalSteps = overworld?.totalSteps || 0;
  const wood = overworld?.woodCollected || 0;
  const stone = overworld?.stoneCollected || 0;

  return (
    (save.unlockedMonsters?.length || 0) * 10 +
    (save.highestFloor || 0) * 3 +
    (save.totalRuns || 0) +
    monsterScore +
    exploredTiles +
    buildings * 20 +
    Math.floor(totalSteps / 10) +
    Math.floor((wood + stone) / 5)
  );
}

export function useCloudSave() {
  const { user, isAuthenticated } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const loadFromCloud = useCallback(async (): Promise<{ success: boolean; data?: SaveData; updatedAt?: string; error?: string }> => {
    if (!isAuthenticated || !user) {
      return { success: false, error: 'Not authenticated' };
    }

    setSyncing(true);
    try {
      const { data, error } = await supabase
        .from('game_saves')
        .select('save_data, updated_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setLastSyncTime(new Date(data.updated_at));
        return {
          success: true,
          data: data.save_data as unknown as SaveData,
          updatedAt: data.updated_at,
        };
      }

      return { success: true, data: undefined };
    } catch (error: any) {
      console.error('Cloud load error:', error);
      return { success: false, error: error.message };
    } finally {
      setSyncing(false);
    }
  }, [user, isAuthenticated]);

  const saveToCloud = useCallback(async (
    saveData: SaveData,
    options: { skipPreflight?: boolean } = {},
  ) => {
    if (!isAuthenticated || !user) {
      return { success: false, error: 'Not authenticated' };
    }

    if (!options.skipPreflight) {
      const cloudResult = await loadFromCloud();
      if (!cloudResult.success) {
        return { success: false, error: cloudResult.error || 'Could not read cloud save before saving' };
      }

      if (cloudResult.data) {
        const localProgress = scoreSave(saveData);
        const cloudProgress = scoreSave(cloudResult.data);
        if (cloudProgress > localProgress) {
          return {
            success: false,
            error: 'Cloud save is newer than this device copy. Use Sync now to load it first.',
            conflict: true,
            cloudData: cloudResult.data,
          } as const;
        }
      }
    }

    setSyncing(true);
    try {
      const { error } = await supabase
        .from('game_saves')
        .upsert({
          user_id: user.id,
          save_data: saveData as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        } as any, {
          onConflict: 'user_id',
        });

      if (error) throw error;

      // Best-effort snapshot into rolling history (trigger keeps last 5).
      try {
        await supabase.from('game_save_snapshots' as any).insert({
          user_id: user.id,
          save_data: saveData as unknown as Record<string, unknown>,
          kind: options.snapshotKind ?? 'auto',
          label: options.snapshotLabel ?? null,
        });
      } catch (snapErr) {
        console.warn('Snapshot insert failed (non-fatal):', snapErr);
      }

      const now = new Date();
      setLastSyncTime(now);
      return { success: true, savedAt: now.toISOString() };
    } catch (error: any) {
      console.error('Cloud save error:', error);
      return { success: false, error: error.message };
    } finally {
      setSyncing(false);
    }
  }, [user, isAuthenticated, loadFromCloud]);

  const listSnapshots = useCallback(async () => {
    if (!isAuthenticated || !user) return { success: false as const, error: 'Not authenticated' };
    const { data, error } = await supabase
      .from('game_save_snapshots' as any)
      .select('id, created_at, kind, label')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);
    if (error) return { success: false as const, error: error.message };
    return { success: true as const, snapshots: (data ?? []) as Array<{ id: string; created_at: string; kind: string; label: string | null }> };
  }, [user, isAuthenticated]);

  const restoreSnapshot = useCallback(async (snapshotId: string): Promise<{ success: boolean; data?: SaveData; error?: string }> => {
    if (!isAuthenticated || !user) return { success: false, error: 'Not authenticated' };
    const { data, error } = await supabase
      .from('game_save_snapshots' as any)
      .select('save_data')
      .eq('id', snapshotId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) return { success: false, error: error.message };
    if (!data) return { success: false, error: 'Snapshot not found' };
    return { success: true, data: (data as any).save_data as SaveData };
  }, [user, isAuthenticated]);


  const syncSave = useCallback(async (localSaveData: SaveData) => {
    if (!isAuthenticated) return { action: 'skip' as const };

    const cloudResult = await loadFromCloud();
    
    if (!cloudResult.success) {
      return { action: 'error' as const, error: cloudResult.error };
    }

    if (!cloudResult.data) {
      // No cloud save - upload local
      await saveToCloud(localSaveData);
      toast.success('Progress synced to cloud!');
      return { action: 'uploaded' as const };
    }

    // Compare saves - use the one with more progress.
    // IMPORTANT: count monster LEVELS and overworld exploration too — otherwise
    // a slightly-newer cloud save (one extra run/floor) can wipe a local save
    // that has dozens of levels and a fully-explored overworld, and vice versa.
    const cloudData = cloudResult.data;
    const localProgress = scoreSave(localSaveData);
    const cloudProgress = scoreSave(cloudData);

    if (cloudProgress > localProgress) {
      toast.success('Cloud save loaded!');
      return { action: 'downloaded' as const, data: cloudData };
    } else if (localProgress > cloudProgress) {
      const result = await saveToCloud(localSaveData, { skipPreflight: true });
      if (!result.success) {
        return { action: 'error' as const, error: result.error };
      }
      toast.success('Cloud save updated!');
      return { action: 'uploaded' as const };
    }

    return { action: 'synced' as const };
  }, [isAuthenticated, loadFromCloud, saveToCloud]);

  const cloudScore = useMemo(() => ({ scoreSave }), []);

  return {
    saveToCloud,
    loadFromCloud,
    syncSave,
    syncing,
    lastSyncTime,
    isAuthenticated,
    scoreSave: cloudScore.scoreSave,
  };
}
