import { NextRequest } from "next/server";
import { scoreSchool } from "@/lib/catalog";
import { searchSchoolsSafe } from "@/lib/live-search";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!query) {
    return Response.json({ schools: [] });
  }

  try {
    const schools = await searchSchoolsSafe(query);
    return Response.json({
      schools: schools.map((school) => ({
        ...school,
        fields: scoreSchool(school.id).map((row) => ({
          fieldName: row.fieldName,
          gradeBand: row.gradeBand,
          tier: row.result.tier,
        })),
      })),
    });
  } catch {
    return Response.json({ schools: [] });
  }
}
