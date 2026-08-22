import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from './database.types';

/**
 * Wraps a single service-role Supabase client for the whole API process.
 *
 * The service role key bypasses Row Level Security, so every read/write made
 * through this client MUST filter by the authenticated user's id explicitly
 * (see WatchesService, MeService, etc.) — RLS in the migrations is a second
 * line of defense, not the one this backend relies on. `Database` (see
 * database.types.ts) gives query results real row types instead of `any`.
 */
@Injectable()
export class SupabaseService implements OnModuleInit {
  private client!: SupabaseClient<Database>;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const url = this.config.get<string>('SUPABASE_URL');
    const serviceRoleKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!url || !serviceRoleKey) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.example).',
      );
    }

    this.client = createClient<Database>(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  getClient(): SupabaseClient<Database> {
    return this.client;
  }
}
