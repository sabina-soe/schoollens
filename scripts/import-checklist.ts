/**
 * Copy the local scraper export into data/school-profiles-checklist.json
 * so SchoolLens can use it as the school directory.
 *
 * Usage (PowerShell, from the School_Lens / schoollens folder):
 *   npx tsx scripts/import-checklist.ts
 */
import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const DEST = resolve(process.cwd(), "data/school-profiles-checklist.json");
const CANDIDATES = [
  process.env.SCHOOL_PROFILES_CHECKLIST_PATH,
  "D:/SMT/Personal/myPKA-main/myPKA-main/Owner Inbox/App/school-scraper/exports/school-profiles-checklist.json",
  resolve(
    process.cwd(),
    "../school-scraper/exports/school-profiles-checklist.json",
  ),
].filter((path): path is string => Boolean(path));

const source = CANDIDATES.find((path) => existsSync(path));
if (!source) {
  console.error("Could not find school-profiles-checklist.json. Tried:");
  for (const path of CANDIDATES) console.error(`  - ${path}`);
  process.exit(1);
}

copyFileSync(source, DEST);
console.log(`Copied\n  ${source}\n→ ${DEST}`);
