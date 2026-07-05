import { NextResponse } from "next/server";
import { getJobCloseDetails } from "@/lib/jobs";
import { getUserByLineId } from "@/lib/dashboard";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");
  const lineUserId = searchParams.get("lineUserId");
  if (!jobId) return NextResponse.json({ error: "missing jobId" }, { status: 400 });

  const viewer = lineUserId ? await getUserByLineId(lineUserId) : null;
  const data = await getJobCloseDetails(jobId, viewer?.id ?? null);
  return NextResponse.json(data);
}
