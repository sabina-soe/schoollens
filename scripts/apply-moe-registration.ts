/**
 * Upsert moe_registration claims from the official MoE approved list.
 * Does not wipe other claims. Creates the official source if missing.
 *
 * Windows often throws a bare TypeError: fetch failed because Undici
 * cannot complete the TLS connection. This script uses Node https with
 * IPv4 only, and prints the underlying error code.
 *
 * If Node still cannot reach Supabase, run scripts/apply-moe-registration.sql
 * in the Supabase SQL editor instead.
 *
 * Requires:
 *   SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   npx tsx scripts/apply-moe-registration.ts
 */
import dns from "node:dns";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  MOE_SOURCE_DATE,
  MOE_SOURCE_NAME,
  lookupMoeRegistration,
  moeEvidenceNote,
} from "../lib/moe-list";
import { formatError, ipv4Fetch, probeHttps } from "./ipv4-fetch";

dns.setDefaultResultOrder("ipv4first");

function loadEnv(filename: string) {
  try {
    const raw = readFileSync(resolve(process.cwd(), filename), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim().replace(/^\uFEFF/, "");
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // optional
  }
}

loadEnv(".env.local");
loadEnv(".env");

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let last: unknown;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      const delay = 1000 * 2 ** (attempt - 1);
      console.warn(
        `${label} failed (${attempt}/4): ${formatError(err)}. Retrying in ${delay}ms…`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw last instanceof Error ? last : new Error(formatError(last));
}

async function probeHost(url: string) {
  const host = new URL(url).host;
  const lookup = await dns.promises.lookup(host, { all: true });
  const v4 = lookup.filter((row) => row.family === 4).map((row) => row.address);
  const v6 = lookup.filter((row) => row.family === 6).map((row) => row.address);
  console.log(`DNS ${host}: IPv4=${v4.join(",") || "none"} IPv6=${v6.join(",") || "none"}`);
}

async function main() {
  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  }
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  console.log(`Node ${process.version}`);
  console.log(`Connecting to ${new URL(url).origin} via Node https IPv4…`);
  console.log(
    `Env present: URL=yes SERVICE_ROLE=${serviceRoleKey ? "yes" : "no"}`,
  );
  await probeHost(url);
  try {
    console.log(await probeHttps(new URL(url).origin));
  } catch (err) {
    console.error(`HTTPS probe failed: ${formatError(err)}`);
    throw err;
  }

  const supabase: SupabaseClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: ipv4Fetch as typeof fetch },
  });

  let sourceId: number;
  const existingSource = await withRetry("load official source", async () => {
    const result = await supabase
      .from("sources")
      .select("id")
      .eq("name", MOE_SOURCE_NAME)
      .maybeSingle();
    if (result.error) throw new Error(result.error.message);
    return result;
  });

  if (existingSource.data?.id) {
    sourceId = existingSource.data.id as number;
  } else {
    const inserted = await withRetry("insert official source", async () => {
      const result = await supabase
        .from("sources")
        .insert({
          name: MOE_SOURCE_NAME,
          type: "official",
          base_reliability: 0.95,
          notes:
            "Ministry of Education list under the Nov 2023 Directive. Parsed from MOE_Approve_List.xlsx.",
        })
        .select("id")
        .single();
      if (result.error) throw new Error(result.error.message);
      return result;
    });
    sourceId = inserted.data.id as number;
  }

  const schools = await withRetry("load schools", async () => {
    const result = await supabase
      .from("schools")
      .select("id, name, aliases, city, is_synthetic");
    if (result.error) throw new Error(result.error.message);
    return result;
  });

  let upserted = 0;
  for (const school of schools.data ?? []) {
    const lookup = lookupMoeRegistration({
      name: school.name as string,
      aliases: (school.aliases as string | null) ?? null,
      city: (school.city as string | null) ?? null,
    });

    const existing = await withRetry(`load claim for ${school.name}`, async () => {
      const result = await supabase
        .from("claims")
        .select("id")
        .eq("school_id", school.id)
        .eq("source_id", sourceId)
        .eq("field_name", "moe_registration")
        .maybeSingle();
      if (result.error) throw new Error(result.error.message);
      return result;
    });

    const payload = {
      school_id: school.id,
      source_id: sourceId,
      field_name: "moe_registration",
      grade_band: null,
      value_text: lookup.status,
      value_numeric: null,
      status: "official",
      source_date: MOE_SOURCE_DATE,
      evidence_note: moeEvidenceNote(lookup),
    };

    const existingId = existing.data?.id;
    if (existingId) {
      await withRetry(`update ${school.name}`, async () => {
        const result = await supabase.from("claims").update(payload).eq("id", existingId);
        if (result.error) throw new Error(result.error.message);
        return result;
      });
    } else {
      await withRetry(`insert ${school.name}`, async () => {
        const result = await supabase.from("claims").insert(payload);
        if (result.error) throw new Error(result.error.message);
        return result;
      });
    }
    upserted += 1;
    console.log(
      `${school.name}: ${lookup.status} (${lookup.matches.length} listing match(es))`,
    );
  }

  console.log(`Updated moe_registration for ${upserted} school(s)`);
}

main().catch((err) => {
  console.error(formatError(err));
  if (err instanceof Error && err.stack) console.error(err.stack);
  console.error(
    "Node still cannot reach Supabase. Apply instead in the Supabase SQL editor:\n  scripts/apply-moe-registration.sql",
  );
  process.exit(1);
});
