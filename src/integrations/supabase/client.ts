import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || 'https://preview.invalid';
const publishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) || 'preview-only-key';
const memory = new Map<string, string>();
const memoryStorage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => { memory.set(key, value); },
  removeItem: (key: string) => { memory.delete(key); },
};

export const supabase = createClient<Database>(supabaseUrl, publishableKey, {
  auth: { storage: memoryStorage, persistSession: true, autoRefreshToken: true },
});
