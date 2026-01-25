import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { SaveData } from '@/game/types';

export function useCloudSave() {
  const { user, isAuthenticated } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const saveToCloud = useCallback(async (saveData: SaveData) => {
    if (!isAuthenticated || !user) {
      return { success: false, error: 'Not authenticated' };
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

      setLastSyncTime(new Date());
      return { success: true };
    } catch (error: any) {
      console.error('Cloud save error:', error);
      return { success: false, error: error.message };
    } finally {
      setSyncing(false);
    }
  }, [user, isAuthenticated]);

  const loadFromCloud = useCallback(async (): Promise<{ success: boolean; data?: SaveData; error?: string }> => {
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
        return { success: true, data: data.save_data as unknown as SaveData };
      }

      return { success: true, data: undefined };
    } catch (error: any) {
      console.error('Cloud load error:', error);
      return { success: false, error: error.message };
    } finally {
      setSyncing(false);
    }
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

    // Compare saves - use the one with more progress
    const cloudData = cloudResult.data;
    const localProgress = (localSaveData.unlockedMonsters?.length || 0) + 
                          (localSaveData.highestFloor || 0) + 
                          (localSaveData.totalRuns || 0);
    const cloudProgress = (cloudData.unlockedMonsters?.length || 0) + 
                          (cloudData.highestFloor || 0) + 
                          (cloudData.totalRuns || 0);

    if (cloudProgress > localProgress) {
      toast.success('Cloud save loaded!');
      return { action: 'downloaded' as const, data: cloudData };
    } else if (localProgress > cloudProgress) {
      await saveToCloud(localSaveData);
      toast.success('Cloud save updated!');
      return { action: 'uploaded' as const };
    }

    return { action: 'synced' as const };
  }, [isAuthenticated, loadFromCloud, saveToCloud]);

  return {
    saveToCloud,
    loadFromCloud,
    syncSave,
    syncing,
    lastSyncTime,
    isAuthenticated,
  };
}
