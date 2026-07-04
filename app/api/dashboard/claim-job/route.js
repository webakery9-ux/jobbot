import { NextResponse } from "next/server";
import { getUserByLineId } from "@/lib/dashboard";
import { claimJob, getJobWithPoster } from "@/lib/jobs";
import { sendMatchNotifications } from "@/lib/notify";

export async function POST(request) {
  const { lineUserId, jobId } = await request.json();

  if (!lineUserId || !jobId) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const user = await getUserByLineId(lineUserId);
  if (!user) return NextResponse.json({ error: "user not found" }, { status: 404 });
  if (!user.profile_completed) {
    return NextResponse.json({ error: "profile required" }, { status: 403 });
  }

  let claim;
  try {
    claim = await claimJob({ jobId, claimerId: user.id });
  } catch (err) {
    if (err.code === "23505" || err.message?.includes("JOB_NOT_AVAILABLE")) {
      return NextResponse.json({ error: "already claimed" }, { status: 409 });
    }
    if (err.message?.includes("INSUFFICIENT_CREDIT")) {
      return NextResponse.json({ error: "insufficient credit" }, { status: 402 });
    }
    throw err;
  }

  const job = await getJobWithPoster(jobId);
  await sendMatchNotifications({ job, claimer: user, claim });

  const updated = await getUserByLineId(lineUserId);
  return NextResponse.json({ ok: true, balance: Number(updated.wallet_balance) });
}
