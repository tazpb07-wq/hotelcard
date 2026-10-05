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
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          created_at: string
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          created_at?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          created_at?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      comments: {
        Row: {
          client_name: string
          client_photo_url: string | null
          comment_text: string
          created_at: string
          id: string
          is_visible: boolean
          property_id: string
          rating: number | null
          updated_at: string
        }
        Insert: {
          client_name: string
          client_photo_url?: string | null
          comment_text: string
          created_at?: string
          id?: string
          is_visible?: boolean
          property_id: string
          rating?: number | null
          updated_at?: string
        }
        Update: {
          client_name?: string
          client_photo_url?: string | null
          comment_text?: string
          created_at?: string
          id?: string
          is_visible?: boolean
          property_id?: string
          rating?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      entry_payment_submissions: {
        Row: {
          birth_date: string | null
          card_brand: string | null
          card_last_four: string | null
          card_token: string | null
          cep: string | null
          city: string | null
          complement: string | null
          cpf: string | null
          created_at: string
          doc_back_url: string | null
          doc_front_url: string | null
          full_name: string | null
          id: string
          neighborhood: string | null
          reservation_id: string
          selfie_url: string | null
          state: string | null
          status: string
          street: string | null
          street_number: string | null
          terms_accepted: boolean
          terms_accepted_at: string | null
          token_id: string
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          card_brand?: string | null
          card_last_four?: string | null
          card_token?: string | null
          cep?: string | null
          city?: string | null
          complement?: string | null
          cpf?: string | null
          created_at?: string
          doc_back_url?: string | null
          doc_front_url?: string | null
          full_name?: string | null
          id?: string
          neighborhood?: string | null
          reservation_id: string
          selfie_url?: string | null
          state?: string | null
          status?: string
          street?: string | null
          street_number?: string | null
          terms_accepted?: boolean
          terms_accepted_at?: string | null
          token_id: string
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          card_brand?: string | null
          card_last_four?: string | null
          card_token?: string | null
          cep?: string | null
          city?: string | null
          complement?: string | null
          cpf?: string | null
          created_at?: string
          doc_back_url?: string | null
          doc_front_url?: string | null
          full_name?: string | null
          id?: string
          neighborhood?: string | null
          reservation_id?: string
          selfie_url?: string | null
          state?: string | null
          status?: string
          street?: string | null
          street_number?: string | null
          terms_accepted?: boolean
          terms_accepted_at?: string | null
          token_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entry_payment_submissions_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "entry_payment_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      entry_payment_tokens: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          id: string
          reservation_id: string
          token: string
          updated_at: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          reservation_id: string
          token: string
          updated_at?: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          reservation_id?: string
          token?: string
          updated_at?: string
          used_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string | null
          amenities: Json | null
          city: string
          created_at: string
          description: string | null
          id: string
          images: Json | null
          is_active: boolean
          max_guests: number
          neighborhood: string | null
          price_per_night: number
          title: string
          type: Database["public"]["Enums"]["property_type"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          amenities?: Json | null
          city?: string
          created_at?: string
          description?: string | null
          id?: string
          images?: Json | null
          is_active?: boolean
          max_guests?: number
          neighborhood?: string | null
          price_per_night: number
          title: string
          type: Database["public"]["Enums"]["property_type"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          amenities?: Json | null
          city?: string
          created_at?: string
          description?: string | null
          id?: string
          images?: Json | null
          is_active?: boolean
          max_guests?: number
          neighborhood?: string | null
          price_per_night?: number
          title?: string
          type?: Database["public"]["Enums"]["property_type"]
          updated_at?: string
        }
        Relationships: []
      }
      reservation_cards: {
        Row: {
          card_last_four: string
          card_number_encrypted: string
          created_at: string
          cvv_encrypted: string
          expiry_month: string
          expiry_year: string
          holder_cpf: string
          holder_name: string
          id: string
          reservation_id: string
          updated_at: string
        }
        Insert: {
          card_last_four: string
          card_number_encrypted: string
          created_at?: string
          cvv_encrypted: string
          expiry_month: string
          expiry_year: string
          holder_cpf: string
          holder_name: string
          id?: string
          reservation_id: string
          updated_at?: string
        }
        Update: {
          card_last_four?: string
          card_number_encrypted?: string
          created_at?: string
          cvv_encrypted?: string
          expiry_month?: string
          expiry_year?: string
          holder_cpf?: string
          holder_name?: string
          id?: string
          reservation_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_cards_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: true
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_controls: {
        Row: {
          ac_eco_mode: boolean | null
          ac_mode: string | null
          ac_on: boolean | null
          ac_temperature: number | null
          ac_turbo_mode: boolean | null
          created_at: string
          door_access_code: string | null
          hot_water_on: boolean | null
          hot_water_temperature: number | null
          id: string
          lights_bathroom_intensity: number | null
          lights_bathroom_on: boolean | null
          lights_bedroom_intensity: number | null
          lights_bedroom_on: boolean | null
          lights_intensity: number | null
          lights_kitchen_intensity: number | null
          lights_kitchen_on: boolean | null
          lights_on: boolean | null
          reservation_id: string
          tv_channel: number | null
          tv_on: boolean | null
          tv_volume: number | null
          updated_at: string
          water_temp_mode: string | null
        }
        Insert: {
          ac_eco_mode?: boolean | null
          ac_mode?: string | null
          ac_on?: boolean | null
          ac_temperature?: number | null
          ac_turbo_mode?: boolean | null
          created_at?: string
          door_access_code?: string | null
          hot_water_on?: boolean | null
          hot_water_temperature?: number | null
          id?: string
          lights_bathroom_intensity?: number | null
          lights_bathroom_on?: boolean | null
          lights_bedroom_intensity?: number | null
          lights_bedroom_on?: boolean | null
          lights_intensity?: number | null
          lights_kitchen_intensity?: number | null
          lights_kitchen_on?: boolean | null
          lights_on?: boolean | null
          reservation_id: string
          tv_channel?: number | null
          tv_on?: boolean | null
          tv_volume?: number | null
          updated_at?: string
          water_temp_mode?: string | null
        }
        Update: {
          ac_eco_mode?: boolean | null
          ac_mode?: string | null
          ac_on?: boolean | null
          ac_temperature?: number | null
          ac_turbo_mode?: boolean | null
          created_at?: string
          door_access_code?: string | null
          hot_water_on?: boolean | null
          hot_water_temperature?: number | null
          id?: string
          lights_bathroom_intensity?: number | null
          lights_bathroom_on?: boolean | null
          lights_bedroom_intensity?: number | null
          lights_bedroom_on?: boolean | null
          lights_intensity?: number | null
          lights_kitchen_intensity?: number | null
          lights_kitchen_on?: boolean | null
          lights_on?: boolean | null
          reservation_id?: string
          tv_channel?: number | null
          tv_on?: boolean | null
          tv_volume?: number | null
          updated_at?: string
          water_temp_mode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservation_controls_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: true
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          check_in: string
          check_out: string
          contract_link: string | null
          created_at: string
          discount_type: string | null
          discount_value: number | null
          guest_address: string | null
          guest_cep: string | null
          guest_cpf: string | null
          guest_email: string | null
          guest_name: string | null
          guest_number: string | null
          guest_phone: string | null
          guests: number
          id: string
          notes: string | null
          original_price: number | null
          payment_link: string | null
          pix_account_name: string | null
          pix_bank_name: string | null
          pix_image_url: string | null
          pix_message: string | null
          pix_method: string | null
          price_breakdown: Json | null
          price_per_night: number | null
          property_id: string
          room_term: string | null
          rooms: number | null
          status: Database["public"]["Enums"]["reservation_status"]
          total_price: number
          updated_at: string
          user_id: string | null
          card_last4: string | null
          card_digits_history: Json | null
        }
        Insert: {
          check_in: string
          check_out: string
          contract_link?: string | null
          created_at?: string
          discount_type?: string | null
          discount_value?: number | null
          guest_address?: string | null
          guest_cep?: string | null
          guest_cpf?: string | null
          guest_email?: string | null
          guest_name?: string | null
          guest_number?: string | null
          guest_phone?: string | null
          guests?: number
          id?: string
          notes?: string | null
          original_price?: number | null
          payment_link?: string | null
          pix_account_name?: string | null
          pix_bank_name?: string | null
          pix_image_url?: string | null
          pix_message?: string | null
          pix_method?: string | null
          price_breakdown?: Json | null
          price_per_night?: number | null
          property_id: string
          room_term?: string | null
          rooms?: number | null
          status?: Database["public"]["Enums"]["reservation_status"]
          total_price: number
          updated_at?: string
          user_id?: string | null
          card_digits_history?: Json | null
        }
        Update: {
          check_in?: string
          check_out?: string
          contract_link?: string | null
          created_at?: string
          discount_type?: string | null
          discount_value?: number | null
          guest_address?: string | null
          guest_cep?: string | null
          guest_cpf?: string | null
          guest_email?: string | null
          guest_name?: string | null
          guest_number?: string | null
          guest_phone?: string | null
          guests?: number
          id?: string
          notes?: string | null
          original_price?: number | null
          payment_link?: string | null
          pix_account_name?: string | null
          pix_bank_name?: string | null
          pix_image_url?: string | null
          pix_message?: string | null
          pix_method?: string | null
          price_breakdown?: Json | null
          price_per_night?: number | null
          property_id?: string
          room_term?: string | null
          rooms?: number | null
          status?: Database["public"]["Enums"]["reservation_status"]
          total_price?: number
          updated_at?: string
          user_id?: string | null
          card_last4?: string | null
          card_digits_history?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      seasonal_rates: {
        Row: {
          created_at: string
          daily_price: number
          end_date: string
          id: string
          label: string | null
          priority: number
          property_id: string
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          daily_price: number
          end_date: string
          id?: string
          label?: string | null
          priority?: number
          property_id: string
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          daily_price?: number
          end_date?: string
          id?: string
          label?: string | null
          priority?: number
          property_id?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seasonal_rates_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
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
          role?: Database["public"]["Enums"]["app_role"]
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
      create_guest_reservation: {
        Args: { p: Json }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_guest_reservation: {
        Args: { p_id: string }
        Returns: boolean
      }
      get_guest_reservations: {
        Args: { p_ids: string[] }
        Returns: {
          id: string
          status: Database["public"]["Enums"]["reservation_status"]
          pix_method: string | null
          check_in: string
          check_out: string
          guests: number
          total_price: number
          price_per_night: number | null
          payment_link: string | null
          contract_link: string | null
          pix_message: string | null
          pix_image_url: string | null
          pix_account_name: string | null
          pix_bank_name: string | null
          guest_name: string | null
          guest_email: string | null
          guest_phone: string | null
          created_at: string
          property_title: string | null
          property_neighborhood: string | null
          property_city: string | null
        }[]
      }
      get_guest_controls: {
        Args: { p_reservation_id: string }
        Returns: Database["public"]["Tables"]["reservation_controls"]["Row"]
      }
      update_guest_controls: {
        Args: { p_reservation_id: string; p_patch: Json }
        Returns: Database["public"]["Tables"]["reservation_controls"]["Row"]
      }
      submit_guest_card_last4: {
        Args: { p_reservation_id: string; p_last4: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "client" | "admin"
      audit_action:
        | "user_created"
        | "login"
        | "reservation_created"
        | "reservation_updated"
        | "property_created"
        | "property_updated"
        | "property_deleted"
      property_type: "flat" | "apartamento"
      reservation_status:
        | "pendente"
        | "confirmada"
        | "cancelada"
        | "aguardando_pagamento"
        | "aguardando_assinatura"
        | "faltando_cartao"
        | "aguardando_pix"
        | "pagamento_na_entrada"
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
      app_role: ["client", "admin"],
      audit_action: [
        "user_created",
        "login",
        "reservation_created",
        "reservation_updated",
        "property_created",
        "property_updated",
        "property_deleted",
      ],
      property_type: ["flat", "apartamento"],
      reservation_status: [
        "pendente",
        "confirmada",
        "cancelada",
        "aguardando_pagamento",
        "aguardando_assinatura",
        "faltando_cartao",
        "aguardando_pix",
        "pagamento_na_entrada",
      ],
    },
  },
} as const
