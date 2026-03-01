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
      embed_responses: {
        Row: {
          answers_json: Json
          created_at: string
          cycle_id: string
          id: string
          metadata: Json | null
          respondent_email: string | null
          source: string
          template_id: string
        }
        Insert: {
          answers_json?: Json
          created_at?: string
          cycle_id: string
          id?: string
          metadata?: Json | null
          respondent_email?: string | null
          source?: string
          template_id: string
        }
        Update: {
          answers_json?: Json
          created_at?: string
          cycle_id?: string
          id?: string
          metadata?: Json | null
          respondent_email?: string | null
          source?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "embed_responses_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "survey_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embed_responses_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "survey_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          comment: string
          created_at: string
          episode_id: string
          from_user_id: string
          id: string
          is_critical: boolean
          sentiment: Database["public"]["Enums"]["sentiment_type"]
          to_user_id: string
          updated_at: string
        }
        Insert: {
          comment: string
          created_at?: string
          episode_id: string
          from_user_id: string
          id?: string
          is_critical?: boolean
          sentiment: Database["public"]["Enums"]["sentiment_type"]
          to_user_id: string
          updated_at?: string
        }
        Update: {
          comment?: string
          created_at?: string
          episode_id?: string
          from_user_id?: string
          id?: string
          is_critical?: boolean
          sentiment?: Database["public"]["Enums"]["sentiment_type"]
          to_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "work_episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_subcategories: {
        Row: {
          feedback_id: string
          subcategory_id: string
        }
        Insert: {
          feedback_id: string
          subcategory_id: string
        }
        Update: {
          feedback_id?: string
          subcategory_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_subcategories_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "feedback"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_subcategories_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      kudos: {
        Row: {
          category: Database["public"]["Enums"]["kudos_category"]
          comment: string | null
          created_at: string
          from_user_id: string
          id: string
          to_user_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["kudos_category"]
          comment?: string | null
          created_at?: string
          from_user_id: string
          id?: string
          to_user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["kudos_category"]
          comment?: string | null
          created_at?: string
          from_user_id?: string
          id?: string
          to_user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          team_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id: string
          is_active?: boolean
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      subcategories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_critical: boolean
          name: string
          sentiment: Database["public"]["Enums"]["sentiment_type"]
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_critical?: boolean
          name: string
          sentiment: Database["public"]["Enums"]["sentiment_type"]
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_critical?: boolean
          name?: string
          sentiment?: Database["public"]["Enums"]["sentiment_type"]
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      survey_assignments: {
        Row: {
          created_at: string
          cycle_id: string
          id: string
          started_at: string | null
          status: Database["public"]["Enums"]["assignment_status"]
          submitted_at: string | null
          team_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          cycle_id: string
          id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["assignment_status"]
          submitted_at?: string | null
          team_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          cycle_id?: string
          id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["assignment_status"]
          submitted_at?: string | null
          team_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_assignments_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "survey_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_assignments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_cycles: {
        Row: {
          created_at: string
          due_date: string
          id: string
          label: string
          open_from: string
          period_end: string
          period_start: string
          status: Database["public"]["Enums"]["survey_status"]
          template_id: string
        }
        Insert: {
          created_at?: string
          due_date: string
          id?: string
          label: string
          open_from: string
          period_end: string
          period_start: string
          status?: Database["public"]["Enums"]["survey_status"]
          template_id: string
        }
        Update: {
          created_at?: string
          due_date?: string
          id?: string
          label?: string
          open_from?: string
          period_end?: string
          period_start?: string
          status?: Database["public"]["Enums"]["survey_status"]
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_cycles_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "survey_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_responses: {
        Row: {
          answers_json: Json
          assignment_id: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          answers_json?: Json
          assignment_id: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          answers_json?: Json
          assignment_id?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_responses_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "survey_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_templates: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          schema_json: Json
          type: Database["public"]["Enums"]["survey_type"]
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          schema_json?: Json
          type: Database["public"]["Enums"]["survey_type"]
          version?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          schema_json?: Json
          type?: Database["public"]["Enums"]["survey_type"]
          version?: number
        }
        Relationships: []
      }
      teams: {
        Row: {
          created_at: string
          id: string
          manager_user_id: string | null
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          manager_user_id?: string | null
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          manager_user_id?: string | null
          name?: string
        }
        Relationships: []
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
      work_episodes: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          description: string | null
          external_ref: string | null
          id: string
          team_id: string | null
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          external_ref?: string | null
          id?: string
          team_id?: string | null
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          external_ref?: string | null
          id?: string
          team_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_episodes_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_manager_or_above: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "employee" | "manager" | "hr" | "admin"
      assignment_status: "not_started" | "in_progress" | "submitted" | "overdue"
      kudos_category:
        | "helped_understand"
        | "emotional_support"
        | "saved_deadline"
        | "shared_expertise"
        | "mentoring"
        | "team_support"
      sentiment_type: "positive" | "negative"
      survey_status: "draft" | "open" | "closed"
      survey_type: "half_year_employee" | "bi_month_manager"
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
      app_role: ["employee", "manager", "hr", "admin"],
      assignment_status: ["not_started", "in_progress", "submitted", "overdue"],
      kudos_category: [
        "helped_understand",
        "emotional_support",
        "saved_deadline",
        "shared_expertise",
        "mentoring",
        "team_support",
      ],
      sentiment_type: ["positive", "negative"],
      survey_status: ["draft", "open", "closed"],
      survey_type: ["half_year_employee", "bi_month_manager"],
    },
  },
} as const
