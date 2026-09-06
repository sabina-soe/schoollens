import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ipv4Fetch } from "@/lib/ipv4-fetch";

function supabaseUrl(): string | null {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    null
  );
}

function supabaseAnonKey(): string | null {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    null
  );
}

/** Read-only server client. Uses IPv4 fetch so Windows Node does not throw "fetch failed". */
export function createServerSupabase(): SupabaseClient | null {
  const url = supabaseUrl();
  const key = supabaseAnonKey();
  if (!url || !key) return null;

  return createClient(url, key, {
    global: { fetch: ipv4Fetch },
  });
}
