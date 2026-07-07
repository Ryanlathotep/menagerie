import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

export type DataType = 'moves' | 'equipment' | 'recipes' | 'monsters' | 'sprites' | 'shape_templates' | 'asset_image' | 'particle_template' | 'particle_effect' | 'particle_default' | 'world_gen' | 'tile_asset' | 'tile_pattern' | 'craft_pattern' | 'material_effect';

interface GameDataOverride {
  id: string;
  data_type: string;
  data_key: string;
  data_value: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export function useGameDataOverrides(dataType?: DataType) {
  const [overrides, setOverrides] = useState<GameDataOverride[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOverrides = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase.from('game_data_overrides').select('*');
      
      if (dataType) {
        query = query.eq('data_type', dataType);
      }

      const { data, error } = await query.order('updated_at', { ascending: false });

      if (error) throw error;
      setOverrides((data as GameDataOverride[]) || []);
    } catch (err) {
      console.error('Failed to fetch overrides:', err);
      toast.error('Failed to load game data');
    } finally {
      setLoading(false);
    }
  }, [dataType]);

  useEffect(() => {
    fetchOverrides();
  }, [fetchOverrides]);

  const saveOverride = async (
    type: DataType,
    key: string,
    value: Record<string, unknown>
  ) => {
    try {
      // Check if override exists
      const { data: existing } = await supabase
        .from('game_data_overrides')
        .select('id')
        .eq('data_type', type)
        .eq('data_key', key)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('game_data_overrides')
          .update({ data_value: value as Json })
          .eq('id', existing.id);
        
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('game_data_overrides')
          .insert({
            data_type: type,
            data_key: key,
            data_value: value as Json,
          });
        
        if (error) throw error;
      }
      
      toast.success('Game data saved');
      await fetchOverrides();
      return true;
    } catch (err) {
      console.error('Failed to save override:', err);
      toast.error('Failed to save game data');
      return false;
    }
  };

  const deleteOverride = async (type: DataType, key: string) => {
    try {
      const { error } = await supabase
        .from('game_data_overrides')
        .delete()
        .eq('data_type', type)
        .eq('data_key', key);

      if (error) throw error;
      
      toast.success('Override deleted');
      await fetchOverrides();
      return true;
    } catch (err) {
      console.error('Failed to delete override:', err);
      toast.error('Failed to delete');
      return false;
    }
  };

  const getOverride = (type: DataType, key: string): Record<string, unknown> | null => {
    const found = overrides.find(o => o.data_type === type && o.data_key === key);
    return found?.data_value || null;
  };

  return {
    overrides,
    loading,
    saveOverride,
    deleteOverride,
    getOverride,
    refetch: fetchOverrides,
  };
}
