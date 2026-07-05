import { NextResponse } from "next/server";
import { getUserByLineId } from "@/lib/dashboard";
import {
  returnJob,
  getActiveClaimForUser,
  getJobWithPoster,
  buildJobCardMessage,
  saveJobQuoteToken,
  displayNameOf,
} from "@/lib/jobs";
import { pushMessage } from "@/lib/line";

export async function POST(request) {
  const { lineUserId, jobId } = await request.json();
  if (!lineUserId || !jobId) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const user = await getUserByLineId(lineUserId);
  if (!user) return NextResponse.json({ error: "user not found" }, { status: 404 });

  const activeClaim = await getActiveClaimForUser(jobId, user.id);
  if (!activeClaim) {
    return NextResponse.json({ error: "claim not found" }, { status: 404 });
  }

  const returnedClaim = await returnJob({ jobId, claimerId: user.id });

  const job = await getJobWithPoster(jobId);

  // ไม่ส่ง DM หาผู้เปิดงานแล้ว ประกาศแค่ในกลุ่มพอ (การ์ดกลุ่มระบุคนคืน/เวลาคืนอยู่แล้ว)
  // โพสต์การ์ดงานกลับเข้ากลุ่มเดิมให้คนอื่นรับต่อได้ ระบุว่าใครคืนงานเมื่อไหร่
  if (job.group?.line_group_id) {
    const result = await pushMessage(job.group.line_group_id, [
      buildJobCardMessage(job, job.poster, {
        returnedBy: displayNameOf(user),
        returnedAt: returnedClaim.released_at,
      }),
    ]);
    const quoteToken = result?.body?.sentMessages?.[0]?.quoteToken;
    await saveJobQuoteToken(job.id, quoteToken);
  }

  const updated = await getUserByLineId(lineUserId);
  return NextResponse.json({ ok: true, balance: Number(updated.wallet_balance) });
}
