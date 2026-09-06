/**
 * Print catalog place + MoE status for a few known schools.
 * Usage: npm run catalog:verify
 */
import { claimsForSchool, listSchools, searchSchools } from "../lib/catalog";
import { locationsFromCsv, lookupLocation } from "../lib/locations";
import { lookupMoeRegistration } from "../lib/moe-list";

const queries = ["MISY", "ISY", "ILBC", "YAIS"];
let failed = 0;

function claim(schoolId: number, field: string) {
  return claimsForSchool(schoolId).find((row) => row.field_name === field);
}

console.log("Catalog places");
for (const school of listSchools()) {
  const moe = claim(school.id, "moe_registration");
  console.log(
    `- ${school.displayName} | city=${school.city ?? "—"} | address=${school.address ?? "—"} | moe=${moe?.value_text ?? "—"}`,
  );
}

console.log("\nSearch checks");
for (const query of queries) {
  const hits = searchSchools(query);
  console.log(
    `${query}: ${hits.map((school) => `${school.displayName} (${school.city ?? "—"})`).join(" · ") || "(none)"}`,
  );
}

const misy = listSchools().find((school) =>
  school.displayName.includes("Myanmar International School Yangon"),
);
if (!misy) {
  console.error("FAIL: MISY missing from catalog");
  failed += 1;
} else {
  const moe = claim(misy.id, "moe_registration");
  if (moe?.value_text !== "Registered") {
    console.error("FAIL: MISY should be MoE Registered");
    failed += 1;
  }
  if (!misy.address?.includes("ဆည်မြောင်းလမ်း") && !misy.address?.includes("ရန်ကင်း")) {
    console.error("FAIL: MISY Yangon should use the Yankin MoE address");
    failed += 1;
  }
  if (misy.city !== "Yangon") {
    console.error("FAIL: MISY city should stay Yangon");
    failed += 1;
  }
}

const isy = listSchools().find((school) =>
  school.displayName.includes("The International School Yangon"),
);
if (!isy) {
  console.error("FAIL: ISY missing from catalog");
  failed += 1;
} else if (lookupMoeRegistration({
  name: isy.displayName,
  aliases: isy.aliases,
  city: isy.city,
}).status !== "Registered") {
  console.error("FAIL: ISY should be MoE Registered");
  failed += 1;
}

for (const campus of ["Mandalay", "Taunggyi"]) {
  const school = listSchools().find((row) =>
    row.displayName.includes(`ILBC International School ${campus}`),
  );
  if (!school) {
    console.error(`FAIL: ILBC ${campus} missing`);
    failed += 1;
    continue;
  }
  if (school.address?.includes("မြစ်ကြီးနား") || school.address?.includes("မြိတ်")) {
    console.error(`FAIL: ILBC ${campus} inherited another campus address`);
    failed += 1;
  }
}

const csv = `name,city,address,township
Myanmar International School Yangon,Yangon,"No. 24, Canal Road, Yankin",Yankin
`;
const fromCsv = locationsFromCsv(csv);
const hit = lookupLocation(fromCsv, {
  name: "EXAMPLE: Myanmar International School Yangon",
  aliases: "MISY",
});
if (hit?.address !== "No. 24, Canal Road, Yankin") {
  console.error("FAIL: locations CSV parser did not keep the sample address");
  failed += 1;
}

const yais = lookupMoeRegistration({
  name: "Yangon Academy International School",
  aliases: "YAIS",
  city: "Yangon",
});
if (yais.status !== "Not listed") {
  console.error("FAIL: YAIS should remain Not listed");
  failed += 1;
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nCatalog checks passed");
