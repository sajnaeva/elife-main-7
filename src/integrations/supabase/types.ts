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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admins: {
        Row: {
          access_all_divisions: boolean
          additional_division_ids: string[]
          cash_collection_enabled: boolean
          created_at: string | null
          created_by: string | null
          division_id: string
          full_name: string | null
          id: string
          is_active: boolean | null
          is_read_only: boolean
          password_hash: string | null
          phone: string | null
          user_id: string | null
        }
        Insert: {
          access_all_divisions?: boolean
          additional_division_ids?: string[]
          cash_collection_enabled?: boolean
          created_at?: string | null
          created_by?: string | null
          division_id: string
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          is_read_only?: boolean
          password_hash?: string | null
          phone?: string | null
          user_id?: string | null
        }
        Update: {
          access_all_divisions?: boolean
          additional_division_ids?: string[]
          cash_collection_enabled?: boolean
          created_at?: string | null
          created_by?: string | null
          division_id?: string
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          is_read_only?: boolean
          password_hash?: string | null
          phone?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admins_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_collections: {
        Row: {
          amount: number
          collected_by: string
          collected_by_name: string | null
          created_at: string
          division_id: string
          id: string
          member_id: string | null
          mobile: string
          notes: string | null
          panchayath_id: string | null
          panchayath_name: string | null
          person_name: string
          receipt_number: string | null
          status: Database["public"]["Enums"]["cash_collection_status"]
          submitted_at: string | null
          submitted_by: string | null
          submitted_by_name: string | null
          updated_at: string
          verified_at: string | null
          verified_by: string | null
          verified_by_name: string | null
        }
        Insert: {
          amount?: number
          collected_by: string
          collected_by_name?: string | null
          created_at?: string
          division_id: string
          id?: string
          member_id?: string | null
          mobile: string
          notes?: string | null
          panchayath_id?: string | null
          panchayath_name?: string | null
          person_name: string
          receipt_number?: string | null
          status?: Database["public"]["Enums"]["cash_collection_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          submitted_by_name?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          verified_by_name?: string | null
        }
        Update: {
          amount?: number
          collected_by?: string
          collected_by_name?: string | null
          created_at?: string
          division_id?: string
          id?: string
          member_id?: string | null
          mobile?: string
          notes?: string | null
          panchayath_id?: string | null
          panchayath_name?: string | null
          person_name?: string
          receipt_number?: string | null
          status?: Database["public"]["Enums"]["cash_collection_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          submitted_by_name?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          verified_by_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_collections_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_collections_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_collections_panchayath_id_fkey"
            columns: ["panchayath_id"]
            isOneToOne: false
            referencedRelation: "panchayaths"
            referencedColumns: ["id"]
          },
        ]
      }
      clusters: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          name_ml: string | null
          panchayath_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          name_ml?: string | null
          panchayath_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          name_ml?: string | null
          panchayath_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clusters_panchayath_id_fkey"
            columns: ["panchayath_id"]
            isOneToOne: false
            referencedRelation: "panchayaths"
            referencedColumns: ["id"]
          },
        ]
      }
      divisions: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          name_ml: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          name_ml?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          name_ml?: string | null
        }
        Relationships: []
      }
      members: {
        Row: {
          added_by: string | null
          cluster_id: string
          created_at: string | null
          division_id: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean | null
          panchayath_id: string
          phone: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          added_by?: string | null
          cluster_id: string
          created_at?: string | null
          division_id: string
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean | null
          panchayath_id: string
          phone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          added_by?: string | null
          cluster_id?: string
          created_at?: string | null
          division_id?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          panchayath_id?: string
          phone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_panchayath_id_fkey"
            columns: ["panchayath_id"]
            isOneToOne: false
            referencedRelation: "panchayaths"
            referencedColumns: ["id"]
          },
        ]
      }
      panchayaths: {
        Row: {
          created_at: string | null
          district: string | null
          id: string
          is_active: boolean | null
          name: string
          name_ml: string | null
          state: string | null
          ward: string | null
        }
        Insert: {
          created_at?: string | null
          district?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          name_ml?: string | null
          state?: string | null
          ward?: string | null
        }
        Update: {
          created_at?: string | null
          district?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          name_ml?: string | null
          state?: string | null
          ward?: string | null
        }
        Relationships: []
      }
      pennyekart_agents: {
        Row: {
          created_at: string | null
          created_by: string | null
          customer_count: number | null
          id: string
          is_active: boolean | null
          mobile: string
          name: string
          panchayath_id: string
          parent_agent_id: string | null
          responsible_panchayath_ids: string[] | null
          responsible_wards: string[] | null
          role: Database["public"]["Enums"]["pennyekart_agent_role"]
          updated_at: string | null
          ward: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          customer_count?: number | null
          id?: string
          is_active?: boolean | null
          mobile: string
          name: string
          panchayath_id: string
          parent_agent_id?: string | null
          responsible_panchayath_ids?: string[] | null
          responsible_wards?: string[] | null
          role: Database["public"]["Enums"]["pennyekart_agent_role"]
          updated_at?: string | null
          ward: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          customer_count?: number | null
          id?: string
          is_active?: boolean | null
          mobile?: string
          name?: string
          panchayath_id?: string
          parent_agent_id?: string | null
          responsible_panchayath_ids?: string[] | null
          responsible_wards?: string[] | null
          role?: Database["public"]["Enums"]["pennyekart_agent_role"]
          updated_at?: string | null
          ward?: string
        }
        Relationships: [
          {
            foreignKeyName: "pennyekart_agents_panchayath_id_fkey"
            columns: ["panchayath_id"]
            isOneToOne: false
            referencedRelation: "panchayaths"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pennyekart_agents_parent_agent_id_fkey"
            columns: ["parent_agent_id"]
            isOneToOne: false
            referencedRelation: "pennyekart_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      program_advertisements: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          poster_url: string | null
          program_id: string
          title: string | null
          updated_at: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          poster_url?: string | null
          program_id: string
          title?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          poster_url?: string | null
          program_id?: string
          title?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "program_advertisements_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_announcements: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          poster_url: string | null
          program_id: string
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          poster_url?: string | null
          program_id: string
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          poster_url?: string | null
          program_id?: string
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "program_announcements_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_form_questions: {
        Row: {
          created_at: string
          id: string
          is_required: boolean
          options: Json | null
          program_id: string
          question_text: string
          question_type: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_required?: boolean
          options?: Json | null
          program_id: string
          question_text: string
          question_type: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_required?: boolean
          options?: Json | null
          program_id?: string
          question_text?: string
          question_type?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "program_form_questions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_modules: {
        Row: {
          created_at: string
          id: string
          is_published: boolean
          module_type: string
          program_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_published?: boolean
          module_type: string
          program_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_published?: boolean
          module_type?: string
          program_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_modules_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_registrations: {
        Row: {
          answers: Json
          created_at: string
          id: string
          max_score: number | null
          percentage: number | null
          program_id: string
          rank: number | null
          total_score: number | null
          verification_scores: Json | null
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          answers?: Json
          created_at?: string
          id?: string
          max_score?: number | null
          percentage?: number | null
          program_id: string
          rank?: number | null
          total_score?: number | null
          verification_scores?: Json | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          answers?: Json
          created_at?: string
          id?: string
          max_score?: number | null
          percentage?: number | null
          program_id?: string
          rank?: number | null
          total_score?: number | null
          verification_scores?: Json | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "program_registrations_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          all_panchayaths: boolean
          created_at: string
          created_by: string
          description: string | null
          division_id: string
          end_date: string | null
          id: string
          is_active: boolean
          name: string
          panchayath_id: string | null
          start_date: string | null
          updated_at: string
          verification_enabled: boolean
        }
        Insert: {
          all_panchayaths?: boolean
          created_at?: string
          created_by: string
          description?: string | null
          division_id: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          name: string
          panchayath_id?: string | null
          start_date?: string | null
          updated_at?: string
          verification_enabled?: boolean
        }
        Update: {
          all_panchayaths?: boolean
          created_at?: string
          created_by?: string
          description?: string | null
          division_id?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          name?: string
          panchayath_id?: string | null
          start_date?: string | null
          updated_at?: string
          verification_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "programs_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_panchayath_id_fkey"
            columns: ["panchayath_id"]
            isOneToOne: false
            referencedRelation: "panchayaths"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_division: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "member"
      cash_collection_status: "pending" | "verified" | "submitted"
      pennyekart_agent_role:
        | "team_leader"
        | "coordinator"
        | "group_leader"
        | "pro"
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
      app_role: ["super_admin", "admin", "member"],
      cash_collection_status: ["pending", "verified", "submitted"],
      pennyekart_agent_role: [
        "team_leader",
        "coordinator",
        "group_leader",
        "pro",
      ],
    },
  },
} as const
