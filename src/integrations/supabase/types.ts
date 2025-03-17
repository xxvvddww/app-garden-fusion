export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      announcements: {
        Row: {
          announcement_id: string
          content: string
          created_by: string
          created_time: string | null
          status: string
          title: string
        }
        Insert: {
          announcement_id?: string
          content: string
          created_by: string
          created_time?: string | null
          status?: string
          title: string
        }
        Update: {
          announcement_id?: string
          content?: string
          created_by?: string
          created_time?: string | null
          status?: string
          title?: string
        }
        Relationships: []
      }
      bays: {
        Row: {
          bay_id: string
          bay_number: number
          created_by: string | null
          created_date: string | null
          location: string
          status: string
          type: string | null
          updated_by: string | null
          updated_date: string | null
        }
        Insert: {
          bay_id?: string
          bay_number: number
          created_by?: string | null
          created_date?: string | null
          location: string
          status?: string
          type?: string | null
          updated_by?: string | null
          updated_date?: string | null
        }
        Update: {
          bay_id?: string
          bay_number?: number
          created_by?: string | null
          created_date?: string | null
          location?: string
          status?: string
          type?: string | null
          updated_by?: string | null
          updated_date?: string | null
        }
        Relationships: []
      }
      daily_claims: {
        Row: {
          bay_id: string
          claim_date: string
          claim_id: string
          created_by: string | null
          created_date: string | null
          status: string
          user_id: string
        }
        Insert: {
          bay_id: string
          claim_date: string
          claim_id?: string
          created_by?: string | null
          created_date?: string | null
          status?: string
          user_id: string
        }
        Update: {
          bay_id?: string
          claim_date?: string
          claim_id?: string
          created_by?: string | null
          created_date?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_claims_bay_id_fkey"
            columns: ["bay_id"]
            isOneToOne: false
            referencedRelation: "bays"
            referencedColumns: ["bay_id"]
          },
        ]
      }
      permanent_assignments: {
        Row: {
          assignment_id: string
          bay_id: string
          created_by: string | null
          created_date: string | null
          day_of_week: string
          user_id: string
        }
        Insert: {
          assignment_id?: string
          bay_id: string
          created_by?: string | null
          created_date?: string | null
          day_of_week: string
          user_id: string
        }
        Update: {
          assignment_id?: string
          bay_id?: string
          created_by?: string | null
          created_date?: string | null
          day_of_week?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "permanent_assignments_bay_id_fkey"
            columns: ["bay_id"]
            isOneToOne: false
            referencedRelation: "bays"
            referencedColumns: ["bay_id"]
          },
        ]
      }
      users: {
        Row: {
          created_by: string | null
          created_date: string | null
          email: string
          mobile_number: string | null
          name: string | null
          role: string
          status: string
          tsa_id: string | null
          updated_by: string | null
          updated_date: string | null
          user_id: string
        }
        Insert: {
          created_by?: string | null
          created_date?: string | null
          email: string
          mobile_number?: string | null
          name?: string | null
          role?: string
          status?: string
          tsa_id?: string | null
          updated_by?: string | null
          updated_date?: string | null
          user_id: string
        }
        Update: {
          created_by?: string | null
          created_date?: string | null
          email?: string
          mobile_number?: string | null
          name?: string | null
          role?: string
          status?: string
          tsa_id?: string | null
          updated_by?: string | null
          updated_date?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_unread_announcements_for_user: {
        Args: {
          user_id_param: string
        }
        Returns: {
          announcement_id: string
          content: string
          created_by: string
          created_time: string | null
          status: string
          title: string
        }[]
      }
      get_user_role: {
        Args: {
          user_id: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
