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
      blank_sailings: {
        Row: {
          blank_pct: number | null
          blanked_teu: number | null
          fetched_at: string
          id: number
          planned_teu: number | null
          region: string
          source: string
          week_start: string
        }
        Insert: {
          blank_pct?: number | null
          blanked_teu?: number | null
          fetched_at?: string
          id?: number
          planned_teu?: number | null
          region: string
          source: string
          week_start: string
        }
        Update: {
          blank_pct?: number | null
          blanked_teu?: number | null
          fetched_at?: string
          id?: number
          planned_teu?: number | null
          region?: string
          source?: string
          week_start?: string
        }
        Relationships: []
      }
      bunker_prices: {
        Row: {
          fetched_at: string
          grade: string
          id: number
          obs_date: string
          port: string
          price_usd: number | null
          source: string
          source_url: string | null
        }
        Insert: {
          fetched_at?: string
          grade: string
          id?: number
          obs_date: string
          port: string
          price_usd?: number | null
          source?: string
          source_url?: string | null
        }
        Update: {
          fetched_at?: string
          grade?: string
          id?: number
          obs_date?: string
          port?: string
          price_usd?: number | null
          source?: string
          source_url?: string | null
        }
        Relationships: []
      }
      data_updates: {
        Row: {
          dataset: string
          id: string
          notes: string | null
          record_count: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          dataset: string
          id?: string
          notes?: string | null
          record_count?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          dataset?: string
          id?: string
          notes?: string | null
          record_count?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      delay_index_weekly: {
        Row: {
          data_quality: Database["public"]["Enums"]["data_quality_level"]
          destination: string | null
          gap_vs_premium: number | null
          id: string
          lane_id: string
          median_delay_d: number | null
          median_delay_h: number | null
          methodology_version: string
          milestone: Database["public"]["Enums"]["milestone_code"]
          on_time_rate: number | null
          otp_pct: number | null
          p90_delay_d: number | null
          p90_delay_h: number | null
          route_pattern: string | null
          sample_count: number
          updated_at: string | null
          week_iso: string
        }
        Insert: {
          data_quality: Database["public"]["Enums"]["data_quality_level"]
          destination?: string | null
          gap_vs_premium?: number | null
          id?: string
          lane_id: string
          median_delay_d?: number | null
          median_delay_h?: number | null
          methodology_version?: string
          milestone: Database["public"]["Enums"]["milestone_code"]
          on_time_rate?: number | null
          otp_pct?: number | null
          p90_delay_d?: number | null
          p90_delay_h?: number | null
          route_pattern?: string | null
          sample_count: number
          updated_at?: string | null
          week_iso: string
        }
        Update: {
          data_quality?: Database["public"]["Enums"]["data_quality_level"]
          destination?: string | null
          gap_vs_premium?: number | null
          id?: string
          lane_id?: string
          median_delay_d?: number | null
          median_delay_h?: number | null
          methodology_version?: string
          milestone?: Database["public"]["Enums"]["milestone_code"]
          on_time_rate?: number | null
          otp_pct?: number | null
          p90_delay_d?: number | null
          p90_delay_h?: number | null
          route_pattern?: string | null
          sample_count?: number
          updated_at?: string | null
          week_iso?: string
        }
        Relationships: [
          {
            foreignKeyName: "delay_index_weekly_lane_id_fkey"
            columns: ["lane_id"]
            isOneToOne: false
            referencedRelation: "lanes"
            referencedColumns: ["id"]
          },
        ]
      }
      disruption_events: {
        Row: {
          affected_lanes: string[] | null
          body_en: string | null
          category: string | null
          created_at: string | null
          description_en: string | null
          description_ru: string | null
          event_date: string | null
          event_type: string
          id: string
          impact_days: number | null
          lane_id: string | null
          region: string | null
          resolved_at: string | null
          severity: Database["public"]["Enums"]["disruption_severity"]
          source_url: string | null
          started_at: string | null
          title_en: string
          title_ko: string | null
          title_ru: string | null
          title_zh: string | null
          verified_by: string[] | null
        }
        Insert: {
          affected_lanes?: string[] | null
          body_en?: string | null
          category?: string | null
          created_at?: string | null
          description_en?: string | null
          description_ru?: string | null
          event_date?: string | null
          event_type: string
          id?: string
          impact_days?: number | null
          lane_id?: string | null
          region?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["disruption_severity"]
          source_url?: string | null
          started_at?: string | null
          title_en: string
          title_ko?: string | null
          title_ru?: string | null
          title_zh?: string | null
          verified_by?: string[] | null
        }
        Update: {
          affected_lanes?: string[] | null
          body_en?: string | null
          category?: string | null
          created_at?: string | null
          description_en?: string | null
          description_ru?: string | null
          event_date?: string | null
          event_type?: string
          id?: string
          impact_days?: number | null
          lane_id?: string | null
          region?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["disruption_severity"]
          source_url?: string | null
          started_at?: string | null
          title_en?: string
          title_ko?: string | null
          title_ru?: string | null
          title_zh?: string | null
          verified_by?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "disruption_events_lane_id_fkey"
            columns: ["lane_id"]
            isOneToOne: false
            referencedRelation: "lanes"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_indices: {
        Row: {
          change_pct: number | null
          fetched_at: string
          id: number
          index_code: string
          source: string
          source_url: string | null
          value: number | null
          week_date: string
        }
        Insert: {
          change_pct?: number | null
          fetched_at?: string
          id?: number
          index_code: string
          source: string
          source_url?: string | null
          value?: number | null
          week_date: string
        }
        Update: {
          change_pct?: number | null
          fetched_at?: string
          id?: number
          index_code?: string
          source?: string
          source_url?: string | null
          value?: number | null
          week_date?: string
        }
        Relationships: []
      }
      freight_rates: {
        Row: {
          ann_no: string | null
          carrier: string | null
          container_type: string
          created_at: string | null
          currency: string | null
          data_source: string
          display_order: number | null
          id: string
          imxprt_se: string | null
          is_featured: boolean | null
          is_partner_rate: boolean | null
          pod_code: string
          pod_name: string | null
          pol_code: string
          pol_name: string | null
          rate_usd: number | null
          source_updated_at: string | null
          transit_days: number | null
          valid_from: string | null
          valid_until: string | null
          weekly_change_pct: number | null
        }
        Insert: {
          ann_no?: string | null
          carrier?: string | null
          container_type: string
          created_at?: string | null
          currency?: string | null
          data_source: string
          display_order?: number | null
          id?: string
          imxprt_se?: string | null
          is_featured?: boolean | null
          is_partner_rate?: boolean | null
          pod_code: string
          pod_name?: string | null
          pol_code: string
          pol_name?: string | null
          rate_usd?: number | null
          source_updated_at?: string | null
          transit_days?: number | null
          valid_from?: string | null
          valid_until?: string | null
          weekly_change_pct?: number | null
        }
        Update: {
          ann_no?: string | null
          carrier?: string | null
          container_type?: string
          created_at?: string | null
          currency?: string | null
          data_source?: string
          display_order?: number | null
          id?: string
          imxprt_se?: string | null
          is_featured?: boolean | null
          is_partner_rate?: boolean | null
          pod_code?: string
          pod_name?: string | null
          pol_code?: string
          pol_name?: string | null
          rate_usd?: number | null
          source_updated_at?: string | null
          transit_days?: number | null
          valid_from?: string | null
          valid_until?: string | null
          weekly_change_pct?: number | null
        }
        Relationships: []
      }
      lanes: {
        Row: {
          border_points: string[] | null
          created_at: string | null
          display_order: number | null
          id: string
          is_featured: boolean | null
          name_en: string
          name_ko: string | null
          name_ru: string | null
          name_zh: string | null
          transit_max: number | null
          transit_min: number | null
        }
        Insert: {
          border_points?: string[] | null
          created_at?: string | null
          display_order?: number | null
          id: string
          is_featured?: boolean | null
          name_en: string
          name_ko?: string | null
          name_ru?: string | null
          name_zh?: string | null
          transit_max?: number | null
          transit_min?: number | null
        }
        Update: {
          border_points?: string[] | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_featured?: boolean | null
          name_en?: string
          name_ko?: string | null
          name_ru?: string | null
          name_zh?: string | null
          transit_max?: number | null
          transit_min?: number | null
        }
        Relationships: []
      }
      maritime_news: {
        Row: {
          agent_type: string | null
          category: string | null
          content: string | null
          fetched_at: string
          id: number
          image_url: string | null
          is_hero: boolean | null
          lang: string
          published_at: string | null
          slug: string | null
          source: string
          summary: string | null
          tags: string[] | null
          title: string
          url: string
        }
        Insert: {
          agent_type?: string | null
          category?: string | null
          content?: string | null
          fetched_at?: string
          id?: number
          image_url?: string | null
          is_hero?: boolean | null
          lang?: string
          published_at?: string | null
          slug?: string | null
          source: string
          summary?: string | null
          tags?: string[] | null
          title: string
          url: string
        }
        Update: {
          agent_type?: string | null
          category?: string | null
          content?: string | null
          fetched_at?: string
          id?: number
          image_url?: string | null
          is_hero?: boolean | null
          lang?: string
          published_at?: string | null
          slug?: string | null
          source?: string
          summary?: string | null
          tags?: string[] | null
          title?: string
          url?: string
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          email: string
          id: string
          preferences: Json | null
          source: string | null
          status: string | null
          subscribed_at: string | null
          unsubscribed_at: string | null
        }
        Insert: {
          email: string
          id?: string
          preferences?: Json | null
          source?: string | null
          status?: string | null
          subscribed_at?: string | null
          unsubscribed_at?: string | null
        }
        Update: {
          email?: string
          id?: string
          preferences?: Json | null
          source?: string | null
          status?: string | null
          subscribed_at?: string | null
          unsubscribed_at?: string | null
        }
        Relationships: []
      }
      policy_alerts: {
        Row: {
          code: string
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          meta: string | null
          title: string
        }
        Insert: {
          code: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          meta?: string | null
          title: string
        }
        Update: {
          code?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          meta?: string | null
          title?: string
        }
        Relationships: []
      }
      schedule_reliability: {
        Row: {
          data_type: string
          fetched_at: string
          on_time_pct: number | null
          source: string
          week_start: string
        }
        Insert: {
          data_type?: string
          fetched_at?: string
          on_time_pct?: number | null
          source: string
          week_start: string
        }
        Update: {
          data_type?: string
          fetched_at?: string
          on_time_pct?: number | null
          source?: string
          week_start?: string
        }
        Relationships: []
      }
      shipment_legs: {
        Row: {
          actual_at: string | null
          created_at: string | null
          current_loc: string | null
          data_source: string | null
          delay_days: number | null
          delay_hours: number | null
          delay_reason: string | null
          destination: string | null
          flag: string | null
          id: string
          lane_id: string
          load_type: string | null
          milestone: Database["public"]["Enums"]["milestone_code"]
          planned_at: string | null
          raw_source_file: string | null
          reason_note: string | null
          route_pattern: string | null
          shipment_ref: string
          signal: string | null
          transport_mode: string | null
          week_iso: string
        }
        Insert: {
          actual_at?: string | null
          created_at?: string | null
          current_loc?: string | null
          data_source?: string | null
          delay_days?: number | null
          delay_hours?: number | null
          delay_reason?: string | null
          destination?: string | null
          flag?: string | null
          id?: string
          lane_id: string
          load_type?: string | null
          milestone: Database["public"]["Enums"]["milestone_code"]
          planned_at?: string | null
          raw_source_file?: string | null
          reason_note?: string | null
          route_pattern?: string | null
          shipment_ref: string
          signal?: string | null
          transport_mode?: string | null
          week_iso: string
        }
        Update: {
          actual_at?: string | null
          created_at?: string | null
          current_loc?: string | null
          data_source?: string | null
          delay_days?: number | null
          delay_hours?: number | null
          delay_reason?: string | null
          destination?: string | null
          flag?: string | null
          id?: string
          lane_id?: string
          load_type?: string | null
          milestone?: Database["public"]["Enums"]["milestone_code"]
          planned_at?: string | null
          raw_source_file?: string | null
          reason_note?: string | null
          route_pattern?: string | null
          shipment_ref?: string
          signal?: string | null
          transport_mode?: string | null
          week_iso?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_legs_lane_id_fkey"
            columns: ["lane_id"]
            isOneToOne: false
            referencedRelation: "lanes"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_statistics: {
        Row: {
          country_code: string | null
          country_name: string | null
          data_source: string | null
          export_usd: number | null
          export_weight: number | null
          fetched_at: string | null
          hs_code: string | null
          hs_name: string | null
          id: string
          import_usd: number | null
          import_weight: number | null
          period: string
          stat_type: string
          trade_balance: number | null
        }
        Insert: {
          country_code?: string | null
          country_name?: string | null
          data_source?: string | null
          export_usd?: number | null
          export_weight?: number | null
          fetched_at?: string | null
          hs_code?: string | null
          hs_name?: string | null
          id?: string
          import_usd?: number | null
          import_weight?: number | null
          period: string
          stat_type: string
          trade_balance?: number | null
        }
        Update: {
          country_code?: string | null
          country_name?: string | null
          data_source?: string | null
          export_usd?: number | null
          export_weight?: number | null
          fetched_at?: string | null
          hs_code?: string | null
          hs_name?: string | null
          id?: string
          import_usd?: number | null
          import_weight?: number | null
          period?: string
          stat_type?: string
          trade_balance?: number | null
        }
        Relationships: []
      }
      weekly_briefing_points: {
        Row: {
          agent_type: string
          briefing_id: string
          category: string
          created_at: string | null
          display_order: number
          headline: string
          id: string
        }
        Insert: {
          agent_type: string
          briefing_id: string
          category: string
          created_at?: string | null
          display_order: number
          headline: string
          id?: string
        }
        Update: {
          agent_type?: string
          briefing_id?: string
          category?: string
          created_at?: string | null
          display_order?: number
          headline?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_briefing_points_briefing_id_fkey"
            columns: ["briefing_id"]
            isOneToOne: false
            referencedRelation: "weekly_briefings"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_briefings: {
        Row: {
          content: string | null
          id: string
          published_at: string | null
          subtitle: string | null
          title: string
          week_of: string
        }
        Insert: {
          content?: string | null
          id?: string
          published_at?: string | null
          subtitle?: string | null
          title?: string
          week_of: string
        }
        Update: {
          content?: string | null
          id?: string
          published_at?: string | null
          subtitle?: string | null
          title?: string
          week_of?: string
        }
        Relationships: []
      }
    }
    Views: {
      industry_chapter_stats: {
        Row: {
          export_usd: number | null
          export_weight: number | null
          hs_chapter: string | null
          import_usd: number | null
          import_weight: number | null
          period: string | null
          trade_balance: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      data_quality_level: "confirmed" | "provisional" | "indicative"
      disruption_severity: "high" | "medium" | "low"
      milestone_code:
        | "ORIGIN_DEP"
        | "SEA_TS_ARR"
        | "RAIL_DEP_CN"
        | "KASHI_ARR"
        | "KASHI_BONDED"
        | "TRUCK_DEP"
        | "XIAN_HUB"
        | "CN_BORDER"
        | "KG_UZ_BORDER"
        | "DEST_ARR"
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
      data_quality_level: ["confirmed", "provisional", "indicative"],
      disruption_severity: ["high", "medium", "low"],
      milestone_code: [
        "ORIGIN_DEP",
        "SEA_TS_ARR",
        "RAIL_DEP_CN",
        "KASHI_ARR",
        "KASHI_BONDED",
        "TRUCK_DEP",
        "XIAN_HUB",
        "CN_BORDER",
        "KG_UZ_BORDER",
        "DEST_ARR",
      ],
    },
  },
} as const
