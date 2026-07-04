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

  await returnJob({ jobId, claimerId: user.id });

  const job = await getJobWithPoster(jobId);

  // แจ้งผู้เปิดงานว่างานถูกคืน
  if (job.poster?.line_user_id) {
    await pushMessage(job.poster.line_user_id, [
      {
        type: "text",
        text: `↩️ ${displayNameOf(user)} คืนงาน "${job.detail}" กลับเข้ากลุ่มแล้วครับ`,
      },
    ]);
  }

  // โพสต์การ์ดงานกลับเข้ากลุ่มเดิมให้คนอื่นรับต่อได้
  if (job.group?.line_group_id) {
    const result = await pushMessage(job.group.line_group_id, [
      buildJobCardMessage(job, job.poster),
    ]);
    const quoteToken = result?.body?.sentMessages?.[0]?.quoteToken;
    await saveJobQuoteToken(job.id, quoteToken);
  }

  const updated = await getUserByLineId(lineUserId);
  return NextResponse.json({ ok: true, balance: Number(updated.wallet_balance) });
}
