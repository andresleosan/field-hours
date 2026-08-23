import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || 'https://preview.invalid';
const publishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) || 'preview-only-key';

export const supabase = createClient<Database>(supabaseUrl, publishableKey, {
  auth: {
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  },
});
