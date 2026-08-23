import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const defaultSupabaseUrl = 'https://lukmmizugpnecispdzsn.supabase.co';
const defaultPublishableKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1a21taXp1Z3BuZWNpc3BkenNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NDU4NDMsImV4cCI6MjA3NzMyMTg0M30.9EsH3hNhXSplK5ymxN1JT5ScV17fVaHD8486nMa2k6Q';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || defaultSupabaseUrl;
const publishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) || defaultPublishableKey;

export const supabase = createClient<Database>(supabaseUrl, publishableKey, {
  auth: {
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  },
});
