import { NextResponse } from "next/server";
import { getJobCloseDetails } from "@/lib/jobs";

export async function GET(request) {
  const jobId = new URL(request.url).searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "missing jobId" }, { status: 400 });

  const data = await getJobCloseDetails(jobId);
  return NextResponse.json(data);
}
