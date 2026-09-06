import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { ipv4Fetch } from "@/lib/ipv4-fetch";

function supabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
}

function supabaseAnonKey(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
}

/** Cookie-aware client for Server Components / Route Handlers (auth session). */
export async function createSupabaseServerClient() {
  const url = supabaseUrl();
  const anonKey = supabaseAnonKey();

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    global: { fetch: ipv4Fetch },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component — middleware will refresh sessions.
        }
      },
    },
  });
}

/**
 * Anon client for public reads.
 * IPv4 fetch avoids Windows Node `TypeError: fetch failed`.
 */
export function createSupabaseAnonClient() {
  const url = supabaseUrl();
  const anonKey = supabaseAnonKey();

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: ipv4Fetch },
  });
}

/** Same client, but returns null when env is missing — for optional live search. */
export function createServerSupabase(): SupabaseClient | null {
  try {
    return createSupabaseAnonClient();
  } catch {
    return null;
  }
}
