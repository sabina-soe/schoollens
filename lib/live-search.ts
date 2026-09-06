import { searchSchools, type CatalogSchool } from "@/lib/catalog";
import { displaySchoolName } from "@/lib/fields";
import { createServerSupabase } from "@/lib/supabase/server";

type LiveSchoolRow = {
  id: number;
  name: string;
  aliases: string | null;
  city: string | null;
  curriculum_hint: string | null;
  is_synthetic: boolean | null;
  notes: string | null;
};

function sanitizeIlike(query: string): string {
  return query
    .replace(/[%_,()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function sameSchool(a: CatalogSchool, b: CatalogSchool): boolean {
  return (
    a.displayName.toLowerCase() === b.displayName.toLowerCase() ||
    a.name.toLowerCase() === b.name.toLowerCase()
  );
}

function fromLiveRow(row: LiveSchoolRow): CatalogSchool {
  const local = searchSchools(row.name);
  if (local[0]) return local[0];
  if (row.aliases) {
    const aliasHit = searchSchools(row.aliases.split(",")[0] ?? "");
    if (aliasHit[0]) return aliasHit[0];
  }
  return {
    id: row.id,
    name: row.name,
    displayName: displaySchoolName(row.name),
    aliases: row.aliases,
    city: row.city,
    address: null,
    curriculumHint: row.curriculum_hint,
    isSynthetic: Boolean(row.is_synthetic),
    notes: row.notes,
  };
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("search timed out")), ms);
    }),
  ]);
}

async function searchSupabaseSchools(query: string): Promise<CatalogSchool[]> {
  const supabase = createServerSupabase();
  if (!supabase) return [];

  const needle = sanitizeIlike(query);
  if (!needle) return [];

  const { data, error } = await withTimeout(
    Promise.resolve(
      supabase
        .from("schools")
        .select("id, name, aliases, city, curriculum_hint, is_synthetic, notes")
        .or(`name.ilike.%${needle}%,aliases.ilike.%${needle}%`)
        .limit(20),
    ),
    2500,
  );

  if (error || !data) return [];
  return (data as LiveSchoolRow[]).map(fromLiveRow);
}

/** Catalog first. Live Supabase is optional. Fetch failures never throw. */
export async function searchSchoolsSafe(
  query: string,
): Promise<CatalogSchool[]> {
  const local = searchSchools(query);
  try {
    const live = await searchSupabaseSchools(query);
    const merged = [...local];
    for (const school of live) {
      if (!merged.some((row) => sameSchool(row, school))) {
        merged.push(school);
      }
    }
    return merged;
  } catch {
    return local;
  }
}
