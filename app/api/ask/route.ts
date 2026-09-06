import { NextRequest } from "next/server";
import { answerWithClaude } from "@/lib/ask";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const schoolId =
    typeof body === "object" && body !== null && "schoolId" in body
      ? Number((body as { schoolId: unknown }).schoolId)
      : NaN;
  const question =
    typeof body === "object" && body !== null && "question" in body
      ? String((body as { question: unknown }).question ?? "")
      : "";

  if (!Number.isFinite(schoolId) || schoolId <= 0) {
    return Response.json({ error: "Missing school" }, { status: 400 });
  }
  if (question.trim().length === 0) {
    return Response.json({ error: "Missing question" }, { status: 400 });
  }
  if (question.length > 500) {
    return Response.json({ error: "Question is too long" }, { status: 400 });
  }

  const result = await answerWithClaude({ schoolId, question });
  return Response.json(result);
}
