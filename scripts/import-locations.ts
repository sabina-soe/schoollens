/**
 * Copy school-locations.csv into data/school-locations.json.
 *
 * Usage (PowerShell, from the GitHub schoollens folder):
 *   npm run locations:import
 *   $env:SCHOOL_LOCATIONS_PATH="D:\path\school-locations.csv"; npm run locations:import
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { locationsFromCsv } from "../lib/locations";

const DEST = resolve(process.cwd(), "data/school-locations.json");
const CANDIDATES = [
  process.env.SCHOOL_LOCATIONS_PATH,
  "D:/SMT/Personal/myPKA-main/myPKA-main/Owner Inbox/App/School Data/school-locations.csv",
  resolve(process.cwd(), "../School Data/school-locations.csv"),
  resolve(process.cwd(), "../../School Data/school-locations.csv"),
  resolve(process.cwd(), "../school-scraper/exports/school-locations.csv"),
  resolve(process.cwd(), "../../school-scraper/exports/school-locations.csv"),
  resolve(process.cwd(), "school-locations.csv"),
  resolve(process.cwd(), "data/school-locations.csv"),
].filter((path): path is string => Boolean(path));

const source = CANDIDATES.find((path) => existsSync(path));
if (!source) {
  console.error("Could not find school-locations.csv. Tried:");
  for (const path of CANDIDATES) console.error(`  - ${path}`);
  process.exit(1);
}

const schools = locationsFromCsv(readFileSync(source, "utf8"));
if (schools.length === 0) {
  console.error(
    `Found ${source} but parsed 0 schools. Expected headers such as name, city, address.`,
  );
  process.exit(1);
}

writeFileSync(
  DEST,
  `${JSON.stringify(
    {
      source,
      source_date: new Date().toISOString().slice(0, 10),
      schools,
    },
    null,
    2,
  )}\n`,
  "utf8",
);
console.log(`Imported ${schools.length} location(s)\n  ${source}\n→ ${DEST}`);
