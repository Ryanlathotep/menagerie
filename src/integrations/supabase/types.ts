export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      arena_champions: {
        Row: {
          achieved_at: string
          cadence: string
          id: string
          team_name: string
          team_snapshot: Json
          user_id: string
          username: string
          wins: number
          world_seed: number | null
        }
        Insert: {
          achieved_at?: string
          cadence: string
          id?: string
          team_name: string
          team_snapshot: Json
          user_id: string
          username: string
          wins?: number
          world_seed?: number | null
        }
        Update: {
          achieved_at?: string
          cadence?: string
          id?: string
          team_name?: string
          team_snapshot?: Json
          user_id?: string
          username?: string
          wins?: number
          world_seed?: number | null
        }
        Relationships: []
      }
      bug_reports: {
        Row: {
          admin_notes: string | null
          category: string | null
          context: Json | null
          created_at: string
          description: string
          id: string
          status: string
          title: string
          updated_at: string
          user_id: string | null
          username: string | null
        }
        Insert: {
          admin_notes?: string | null
          category?: string | null
          context?: Json | null
          created_at?: string
          description: string
          id?: string
          status?: string
          title: string
          updated_at?: string
          user_id?: string | null
          username?: string | null
        }
        Update: {
          admin_notes?: string | null
          category?: string | null
          context?: Json | null
          created_at?: string
          description?: string
          id?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      crafting_recipes_discovered: {
        Row: {
          blueprint_id: string
          discovered_at: string
          discovered_by: string | null
          discovered_by_username: string | null
          grid_json: Json
          grid_size: number
          hash: string
          inventor_station_kind: string | null
          inventor_station_stats: Json | null
          inventor_station_tier: number | null
          item_name: string
          world_seed: string | null
        }
        Insert: {
          blueprint_id: string
          discovered_at?: string
          discovered_by?: string | null
          discovered_by_username?: string | null
          grid_json: Json
          grid_size?: number
          hash: string
          inventor_station_kind?: string | null
          inventor_station_stats?: Json | null
          inventor_station_tier?: number | null
          item_name: string
          world_seed?: string | null
        }
        Update: {
          blueprint_id?: string
          discovered_at?: string
          discovered_by?: string | null
          discovered_by_username?: string | null
          grid_json?: Json
          grid_size?: number
          hash?: string
          inventor_station_kind?: string | null
          inventor_station_stats?: Json | null
          inventor_station_tier?: number | null
          item_name?: string
          world_seed?: string | null
        }
        Relationships: []
      }
      custom_sprites: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          sprite_data: Json
          sprite_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          sprite_data: Json
          sprite_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          sprite_data?: Json
          sprite_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      discovery_leaderboard: {
        Row: {
          achieved_at: string
          discovered_count: number
          id: string
          updated_at: string
          user_id: string
          world_seed: number | null
        }
        Insert: {
          achieved_at?: string
          discovered_count?: number
          id?: string
          updated_at?: string
          user_id: string
          world_seed?: number | null
        }
        Update: {
          achieved_at?: string
          discovered_count?: number
          id?: string
          updated_at?: string
          user_id?: string
          world_seed?: number | null
        }
        Relationships: []
      }
      exploration_leaderboard: {
        Row: {
          achieved_at: string
          id: string
          tiles_explored: number
          updated_at: string
          user_id: string
          world_seed: number | null
        }
        Insert: {
          achieved_at?: string
          id?: string
          tiles_explored?: number
          updated_at?: string
          user_id: string
          world_seed?: number | null
        }
        Update: {
          achieved_at?: string
          id?: string
          tiles_explored?: number
          updated_at?: string
          user_id?: string
          world_seed?: number | null
        }
        Relationships: []
      }
      feature_requests: {
        Row: {
          admin_notes: string | null
          category: string | null
          context: Json | null
          created_at: string
          description: string
          id: string
          status: string
          title: string
          updated_at: string
          upvotes: number
          user_id: string | null
          username: string | null
        }
        Insert: {
          admin_notes?: string | null
          category?: string | null
          context?: Json | null
          created_at?: string
          description: string
          id?: string
          status?: string
          title: string
          updated_at?: string
          upvotes?: number
          user_id?: string | null
          username?: string | null
        }
        Update: {
          admin_notes?: string | null
          category?: string | null
          context?: Json | null
          created_at?: string
          description?: string
          id?: string
          status?: string
          title?: string
          updated_at?: string
          upvotes?: number
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      game_data_overrides: {
        Row: {
          created_at: string
          created_by: string | null
          data_key: string
          data_type: string
          data_value: Json
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_key: string
          data_type: string
          data_value: Json
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_key?: string
          data_type?: string
          data_value?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      game_save_snapshots: {
        Row: {
          created_at: string
          id: string
          kind: string
          label: string | null
          save_data: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          label?: string | null
          save_data: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          label?: string | null
          save_data?: Json
          user_id?: string
        }
        Relationships: []
      }
      game_saves: {
        Row: {
          created_at: string
          id: string
          save_data: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          save_data?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          save_data?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      qa_runs: {
        Row: {
          app_version: string | null
          console_errors: Json
          created_at: string
          fail_count: number
          id: string
          notes: string | null
          pass_count: number
          ran_at: string
          results: Json
          user_id: string
          world_seed: number | null
        }
        Insert: {
          app_version?: string | null
          console_errors?: Json
          created_at?: string
          fail_count?: number
          id?: string
          notes?: string | null
          pass_count?: number
          ran_at?: string
          results?: Json
          user_id: string
          world_seed?: number | null
        }
        Update: {
          app_version?: string | null
          console_errors?: Json
          created_at?: string
          fail_count?: number
          id?: string
          notes?: string | null
          pass_count?: number
          ran_at?: string
          results?: Json
          user_id?: string
          world_seed?: number | null
        }
        Relationships: []
      }
      tower_leaderboard: {
        Row: {
          achieved_at: string
          best_floor: number
          id: string
          party_snapshot: Json | null
          run_seconds: number | null
          tower_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          achieved_at?: string
          best_floor: number
          id?: string
          party_snapshot?: Json | null
          run_seconds?: number | null
          tower_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          achieved_at?: string
          best_floor?: number
          id?: string
          party_snapshot?: Json | null
          run_seconds?: number | null
          tower_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      usernames: {
        Row: {
          auto_generated: boolean
          created_at: string
          updated_at: string
          user_id: string
          username: string
          username_lower: string | null
        }
        Insert: {
          auto_generated?: boolean
          created_at?: string
          updated_at?: string
          user_id: string
          username: string
          username_lower?: string | null
        }
        Update: {
          auto_generated?: boolean
          created_at?: string
          updated_at?: string
          user_id?: string
          username?: string
          username_lower?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ensure_username: { Args: never; Returns: Json }
      get_discovery_leaderboard: {
        Args: { _limit?: number }
        Returns: {
          achieved_at: string
          discovered_count: number
          rank: number
          username: string
          world_seed: number
        }[]
      }
      get_exploration_leaderboard: {
        Args: { _limit?: number }
        Returns: {
          achieved_at: string
          rank: number
          tiles_explored: number
          username: string
          world_seed: number
        }[]
      }
      get_my_username: { Args: never; Returns: string }
      get_my_username_info: { Args: never; Returns: Json }
      get_tower_leaderboard: {
        Args: { _limit?: number; _tower_id: string }
        Returns: {
          achieved_at: string
          best_floor: number
          party_snapshot: Json
          rank: number
          run_seconds: number
          username: string
        }[]
      }
      grant_admin_by_email: { Args: { _email: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_original_admin: { Args: { _user_id: string }; Returns: boolean }
      list_admins: {
        Args: never
        Returns: {
          email: string
          granted_at: string
          is_original: boolean
          user_id: string
        }[]
      }
      revoke_admin: { Args: { _user_id: string }; Returns: undefined }
      set_username: { Args: { _username: string }; Returns: Json }
      submit_discovery_count: {
        Args: { _count: number; _world_seed?: number }
        Returns: Json
      }
      submit_exploration_count: {
        Args: { _count: number; _world_seed?: number }
        Returns: Json
      }
      submit_tower_floor: {
        Args: {
          _floor: number
          _party_snapshot?: Json
          _run_seconds?: number
          _tower_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
