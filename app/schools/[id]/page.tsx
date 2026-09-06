import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SchoolProfile } from "@/components/SchoolProfile";
import { SiteHeader } from "@/components/SiteHeader";
import { getSchool } from "@/lib/catalog";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

function parseSchoolId(id: string): number | null {
  const schoolId = Number(id);
  if (!Number.isFinite(schoolId) || schoolId <= 0) return null;
  return schoolId;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const schoolId = parseSchoolId(id);
  const school = schoolId ? getSchool(schoolId) : null;
  if (!school) {
    return { title: "School not found · SchoolLens" };
  }
  return {
    title: `${school.displayName} · SchoolLens`,
    description: `Evidence-backed facts about ${school.displayName}${
      school.city ? ` in ${school.city}` : ""
    }. Confidence on every claim — Supported, Uncertain, or Unknown.`,
  };
}

export default async function SchoolDetailPage({ params }: PageProps) {
  const { id } = await params;
  const schoolId = parseSchoolId(id);
  if (schoolId == null) {
    notFound();
  }

  const school = getSchool(schoolId);
  if (!school) {
    notFound();
  }

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader compactSearch />
      <SchoolProfile school={school} />
    </div>
  );
}
