// Hand-written mirror of every migration in supabase/migrations/ — kept in
// sync by hand rather than `supabase gen types typescript` so far. A real
// Supabase project now exists (see README); regenerating this file from it
// is a reasonable follow-up instead of continuing to hand-maintain it.
import { TripType, WatchStatus } from '../watches/watch-constants';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          display_name: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          display_name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          display_name?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      device_tokens: {
        Row: {
          id: string;
          user_id: string;
          expo_push_token: string;
          device_info: Record<string, unknown> | null;
          created_at: string;
          last_active_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          expo_push_token: string;
          device_info?: Record<string, unknown> | null;
          created_at?: string;
          last_active_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          expo_push_token?: string;
          device_info?: Record<string, unknown> | null;
          created_at?: string;
          last_active_at?: string;
        };
        Relationships: [];
      };
      airports: {
        Row: {
          iata_code: string;
          name: string;
          city: string;
          country: string;
          latitude: number | null;
          longitude: number | null;
          source: string;
          updated_at: string;
        };
        Insert: {
          iata_code: string;
          name: string;
          city: string;
          country: string;
          latitude?: number | null;
          longitude?: number | null;
          source?: string;
          updated_at?: string;
        };
        Update: {
          iata_code?: string;
          name?: string;
          city?: string;
          country?: string;
          latitude?: number | null;
          longitude?: number | null;
          source?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      watches: {
        Row: {
          id: string;
          user_id: string;
          trip_type: TripType;
          origin_iata: string | null;
          destination_iata: string | null;
          depart_date_from: string;
          depart_date_to: string;
          return_date_from: string | null;
          return_date_to: string | null;
          adults: number;
          target_price: number;
          currency: string;
          baseline_price: number | null;
          baseline_captured_at: string | null;
          baseline_offer_snapshot: unknown;
          latest_price: number | null;
          latest_checked_at: string | null;
          last_notified_price: number | null;
          last_notified_at: string | null;
          status: WatchStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          trip_type: TripType;
          origin_iata?: string | null;
          destination_iata?: string | null;
          depart_date_from: string;
          depart_date_to: string;
          return_date_from?: string | null;
          return_date_to?: string | null;
          adults?: number;
          target_price: number;
          currency?: string;
          baseline_price?: number | null;
          baseline_captured_at?: string | null;
          baseline_offer_snapshot?: unknown;
          latest_price?: number | null;
          latest_checked_at?: string | null;
          last_notified_price?: number | null;
          last_notified_at?: string | null;
          status?: WatchStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          trip_type?: TripType;
          origin_iata?: string | null;
          destination_iata?: string | null;
          depart_date_from?: string;
          depart_date_to?: string;
          return_date_from?: string | null;
          return_date_to?: string | null;
          adults?: number;
          target_price?: number;
          currency?: string;
          baseline_price?: number | null;
          baseline_captured_at?: string | null;
          baseline_offer_snapshot?: unknown;
          latest_price?: number | null;
          latest_checked_at?: string | null;
          last_notified_price?: number | null;
          last_notified_at?: string | null;
          status?: WatchStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      watch_segments: {
        Row: {
          id: string;
          watch_id: string;
          sequence_no: number;
          origin_iata: string;
          destination_iata: string;
          date_from: string;
          date_to: string;
        };
        Insert: {
          id?: string;
          watch_id: string;
          sequence_no: number;
          origin_iata: string;
          destination_iata: string;
          date_from: string;
          date_to: string;
        };
        Update: {
          id?: string;
          watch_id?: string;
          sequence_no?: number;
          origin_iata?: string;
          destination_iata?: string;
          date_from?: string;
          date_to?: string;
        };
        // Lets `.from('watches').select('*, watch_segments(*)')` resolve the
        // embed. Matches the FK Postgres auto-names from the migration's
        // `watch_id uuid references public.watches (id)` column.
        Relationships: [
          {
            foreignKeyName: 'watch_segments_watch_id_fkey';
            columns: ['watch_id'];
            isOneToOne: false;
            referencedRelation: 'watches';
            referencedColumns: ['id'];
          },
        ];
      };
      price_history: {
        Row: {
          id: string;
          watch_id: string;
          checked_at: string;
          depart_date: string;
          return_date: string | null;
          price: number;
          currency: string;
          carrier_code: string | null;
          raw_offer: unknown;
          source: string;
        };
        Insert: {
          id?: string;
          watch_id: string;
          checked_at?: string;
          depart_date: string;
          return_date?: string | null;
          price: number;
          currency?: string;
          carrier_code?: string | null;
          raw_offer?: unknown;
          source?: string;
        };
        Update: {
          id?: string;
          watch_id?: string;
          checked_at?: string;
          depart_date?: string;
          return_date?: string | null;
          price?: number;
          currency?: string;
          carrier_code?: string | null;
          raw_offer?: unknown;
          source?: string;
        };
        Relationships: [];
      };
      price_cache: {
        Row: {
          cache_key: string;
          origin_iata: string;
          destination_iata: string;
          payload: unknown;
          fetched_at: string;
          expires_at: string;
        };
        Insert: {
          cache_key: string;
          origin_iata: string;
          destination_iata: string;
          payload: unknown;
          fetched_at?: string;
          expires_at: string;
        };
        Update: {
          cache_key?: string;
          origin_iata?: string;
          destination_iata?: string;
          payload?: unknown;
          fetched_at?: string;
          expires_at?: string;
        };
        Relationships: [];
      };
      notification_logs: {
        Row: {
          id: string;
          watch_id: string;
          user_id: string;
          price_history_id: string | null;
          previous_price: number;
          new_price: number;
          drop_amount: number;
          drop_percent: number;
          message: string;
          status: 'sent' | 'failed';
          expo_ticket_id: string | null;
          sent_at: string;
        };
        Insert: {
          id?: string;
          watch_id: string;
          user_id: string;
          price_history_id?: string | null;
          previous_price: number;
          new_price: number;
          drop_amount: number;
          drop_percent: number;
          message: string;
          status?: 'sent' | 'failed';
          expo_ticket_id?: string | null;
          sent_at?: string;
        };
        Update: {
          id?: string;
          watch_id?: string;
          user_id?: string;
          price_history_id?: string | null;
          previous_price?: number;
          new_price?: number;
          drop_amount?: number;
          drop_percent?: number;
          message?: string;
          status?: 'sent' | 'failed';
          expo_ticket_id?: string | null;
          sent_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
