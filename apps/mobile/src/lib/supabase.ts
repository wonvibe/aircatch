import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY must be set (see .env.example).',
  );
}

// The app talks to Supabase Auth directly (sign up / sign in / refresh);
// the API server only ever verifies the resulting JWT (see apps/api's
// SupabaseAuthGuard). Session persistence uses AsyncStorage since RN has no
// browser localStorage, and detectSessionInUrl is off — there's no OAuth
// redirect flow in this app yet.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
