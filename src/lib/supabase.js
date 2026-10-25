import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(url && anonKey && !url.includes('your-project'));
export let supabase = null;
export let supabaseConfigError = null;

if (hasSupabaseConfig) {
  try {
    supabase = createClient(url, anonKey);
  } catch (error) {
    supabaseConfigError = error;
    console.error('Supabase configuration is invalid.', error);
  }
}
