import { createClient } from '@supabase/supabase-js';

let cachedSupabaseClient = null;
let cachedKey = null;

/**
 * Returns a cached singleton Supabase client using environment variables
 * or optional runtime syncConfig overrides.
 */
export const getSupabase = (config) => {
  const url = import.meta.env?.VITE_SUPABASE_URL || config?.supabaseUrl;
  const key = import.meta.env?.VITE_SUPABASE_ANON_KEY || config?.supabaseKey;
  if (!url || !key) return null;

  const cacheId = `${url}::${key}`;
  if (!cachedSupabaseClient || cachedKey !== cacheId) {
    cachedSupabaseClient = createClient(url, key);
    cachedKey = cacheId;
  }
  return cachedSupabaseClient;
};
