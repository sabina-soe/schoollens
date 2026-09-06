/**
 * Copy the local doris.school export into data/doris-myanmar-schools.json
 * so SchoolLens can use it as one catalog source (alongside the checklist,
 * seed research, and the MoE list).
 *
 * Usage (PowerShell, from the School_Lens / schoollens folder):
 *   npx tsx scripts/import-doris.ts
 */
import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const DEST = resolve(process.cwd(), "data/doris-myanmar-schools.json");
const CANDIDATES = [
  process.env.DORIS_MYANMAR_SCHOOLS_PATH,
  "D:/SMT/Personal/myPKA-main/myPKA-main/Owner Inbox/App/school-scraper/exports/doris-myanmar-schools.json",
  resolve(
    process.cwd(),
    "../school-scraper/exports/doris-myanmar-schools.json",
  ),
  resolve(process.cwd(), "doris-myanmar-schools.json"),
].filter((path): path is string => Boolean(path));

const source = CANDIDATES.find((path) => existsSync(path));
if (!source) {
  console.error("Could not find doris-myanmar-schools.json. Tried:");
  for (const path of CANDIDATES) console.error(`  - ${path}`);
  process.exit(1);
}

copyFileSync(source, DEST);
console.log(`Copied\n  ${source}\n→ ${DEST}`);
