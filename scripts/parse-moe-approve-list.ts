/**
 * Parse MOE_Approve_List.xlsx into data/moe-approve-list.json.
 *
 * Usage (PowerShell, from the GitHub schoollens folder):
 *   npm run moe:parse
 *   $env:MOE_APPROVE_LIST_PATH="D:\path\MOE_Approve_List.xlsx"; npm run moe:parse
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { read, utils } from "xlsx";

const DEST = resolve(process.cwd(), "data/moe-approve-list.json");
const CANDIDATES = [
  process.env.MOE_APPROVE_LIST_PATH,
  "D:/SMT/Personal/myPKA-main/myPKA-main/Owner Inbox/App/School Data/MOE_Approve_List.xlsx",
  resolve(process.cwd(), "../School Data/MOE_Approve_List.xlsx"),
  resolve(process.cwd(), "../../School Data/MOE_Approve_List.xlsx"),
  resolve(process.cwd(), "MOE_Approve_List.xlsx"),
  resolve(process.cwd(), "data/MOE_Approve_List.xlsx"),
].filter((path): path is string => Boolean(path));

function clean(value: unknown): string {
  if (value == null) return "";
  return String(value).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function isHeaderRow(row: Array<string | number | null>): boolean {
  const joined = row.map(clean).join(" ");
  return joined.includes("ပုဂ္ဂလိကကျောင်းအမည်") || /school\s*name/i.test(joined);
}

const source = CANDIDATES.find((path) => existsSync(path));
if (!source) {
  console.error("Could not find MOE_Approve_List.xlsx. Tried:");
  for (const path of CANDIDATES) console.error(`  - ${path}`);
  process.exit(1);
}

const workbook = read(readFileSync(source), { type: "buffer" });
const sheet = workbook.Sheets[workbook.SheetNames[0] ?? ""];
if (!sheet) {
  console.error(`No sheet in ${source}`);
  process.exit(1);
}

const rows = utils.sheet_to_json<(string | number | null)[]>(sheet, {
  header: 1,
  raw: false,
  defval: "",
});

const headerIndex = rows.findIndex(isHeaderRow);
const start = headerIndex >= 0 ? headerIndex + 1 : 3;

const listings: Array<{
  seq: string;
  name: string;
  address: string;
  period: string;
}> = [];
let current: (typeof listings)[number] | null = null;

for (const raw of rows.slice(start)) {
  const row = Array.isArray(raw) ? raw : [];
  const seq = clean(row[0]);
  const name = clean(row[1]);
  const address = clean(row[2]);
  const period = clean(row[3]);

  if (name && seq) {
    if (current) listings.push(current);
    current = { seq, name, address, period };
  } else if (current && name && !seq) {
    current.name = `${current.name} ${name}`.trim();
    if (address) current.address = `${current.address} ${address}`.trim();
    if (period) current.period = period;
  } else if (current && address && !name) {
    current.address = `${current.address} ${address}`.trim();
  }
}
if (current) listings.push(current);

if (listings.length === 0) {
  console.error(`Parsed 0 listings from ${source}`);
  process.exit(1);
}

writeFileSync(
  DEST,
  `${JSON.stringify(
    {
      title:
        "MoE approved list of private schools teaching the international curriculum",
      source_file: "MOE_Approve_List.xlsx",
      source_path: source,
      source_date: new Date().toISOString().slice(0, 10),
      listings,
    },
    null,
    2,
  )}\n`,
  "utf8",
);
console.log(`Wrote ${listings.length} listings\n  ${source}\n→ ${DEST}`);
