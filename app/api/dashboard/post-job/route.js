import { NextResponse } from "next/server";
import { getUserByLineId } from "@/lib/dashboard";
import { pushMessage } from "@/lib/line";
import {
  postJob,
  buildJobCardMessage,
  getJobWithPoster,
  saveJobQuoteToken,
} from "@/lib/jobs";

export async function POST(request) {
  const body = await request.json();
  const { lineUserId, groupId, detail, wage, paymentMethod, isUrgent, vehicleType } =
    body;

  if (!lineUserId || !groupId || !detail || !wage || !paymentMethod) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const user = await getUserByLineId(lineUserId);
  if (!user) return NextResponse.json({ error: "user not found" }, { status: 404 });
  if (!user.profile_completed) {
    return NextResponse.json({ error: "profile required" }, { status: 403 });
  }

  const wageNum = parseFloat(wage);
  if (isNaN(wageNum) || wageNum <= 0) {
    return NextResponse.json({ error: "invalid wage" }, { status: 400 });
  }

  let job;
  try {
    job = await postJob({
      posterId: user.id,
      groupId,
      detail,
      wage: wageNum,
      paymentMethod,
      isUrgent: !!isUrgent,
      vehicleType: vehicleType || null,
    });
  } catch (err) {
    if (err.message?.includes("INSUFFICIENT_CREDIT")) {
      return NextResponse.json({ error: "insufficient credit" }, { status: 402 });
    }
    throw err;
  }

  const full = await getJobWithPoster(job.id);
  if (full.group?.line_group_id) {
    const result = await pushMessage(full.group.line_group_id, [
      buildJobCardMessage(full, full.poster),
    ]);
    const quoteToken = result?.body?.sentMessages?.[0]?.quoteToken;
    await saveJobQuoteToken(job.id, quoteToken);
  }

  const updated = await getUserByLineId(lineUserId);
  return NextResponse.json({ jobId: job.id, balance: Number(updated.wallet_balance) });
}
