/**
 * Upsert moe_registration claims from the official MoE approved list.
 * Does not wipe other claims. Creates the official source if missing.
 *
 * Windows/Node often fails with a bare "TypeError: fetch failed" when
 * IPv6 is tried first. This script forces IPv4 and prints the real cause.
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

dns.setDefaultResultOrder("ipv4first");

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const undici = require("undici") as {
    Agent: new (opts: { connect: { family: number } }) => unknown;
    setGlobalDispatcher: (agent: unknown) => void;
  };
  undici.setGlobalDispatcher(new undici.Agent({ connect: { family: 4 } }));
} catch {
  // undici ships with Node 18+; ignore if the require path differs
}

function loadEnv(filename: string) {
  try {
    const raw = readFileSync(resolve(process.cwd(), filename), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
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

function formatError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const parts = [err.message];
  let current: unknown = (err as Error & { cause?: unknown }).cause;
  while (current instanceof Error && parts.length < 5) {
    parts.push(current.message);
    current = (current as Error & { cause?: unknown }).cause;
  }
  return parts.join(" → ");
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

  console.log(`Connecting to ${new URL(url).origin} (IPv4 first)…`);
  await probeHost(url);

  const supabase: SupabaseClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
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

    if (existing.data?.id) {
      await withRetry(`update ${school.name}`, async () => {
        const result = await supabase.from("claims").update(payload).eq("id", existing.data.id);
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
  console.error(
    "If this is still 'fetch failed', from PowerShell run:\n  $env:NODE_OPTIONS='--dns-result-order=ipv4first'\n  npx tsx scripts/apply-moe-registration.ts",
  );
  process.exit(1);
});
