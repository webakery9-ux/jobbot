import { NextResponse } from "next/server";
import { getUserByLineId } from "@/lib/dashboard";
import {
  completeJob,
  getActiveClaimForUser,
  getJobWithPoster,
  displayNameOf,
} from "@/lib/jobs";
import { uploadJobPhoto } from "@/lib/storage";
import { pushMessage } from "@/lib/line";

function detailUrl(jobId) {
  const mgmt = process.env.NEXT_PUBLIC_MGMT_LIFF_ID;
  return mgmt ? `https://liff.line.me/${mgmt}?tab=job-detail&job=${jobId}` : null;
}

export async function POST(request) {
  const { lineUserId, jobId, note, photoBase64 } = await request.json();
  if (!lineUserId || !jobId) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const user = await getUserByLineId(lineUserId);
  if (!user) return NextResponse.json({ error: "user not found" }, { status: 404 });

  const activeClaim = await getActiveClaimForUser(jobId, user.id);
  if (!activeClaim) {
    return NextResponse.json({ error: "claim not found" }, { status: 404 });
  }

  let photoUrl = null;
  if (photoBase64) {
    try {
      photoUrl = await uploadJobPhoto(jobId, photoBase64);
    } catch (err) {
      return NextResponse.json({ error: "photo upload failed" }, { status: 500 });
    }
  }

  await completeJob({ jobId, claimerId: user.id, note, photoUrl });

  const job = await getJobWithPoster(jobId);
  const link = detailUrl(jobId);
  if (job.poster?.line_user_id) {
    const messages = [
      {
        type: "text",
        text:
          `📦 งาน "${job.detail}" ปิดงานเรียบร้อยแล้ว\n` +
          `ผู้รับงาน: ${displayNameOf(user)}` +
          (note ? `\nหมายเหตุ: ${note}` : ""),
      },
    ];
    if (link) {
      messages.push({
        type: "text",
        text: `📋 ดูรายละเอียดการปิดงาน: ${link}`,
      });
    }
    await pushMessage(job.poster.line_user_id, messages);
  }

  return NextResponse.json({ ok: true });
}
