import { NextResponse } from "next/server";
import { getUserByLineId } from "@/lib/dashboard";
import { completeJob, getActiveClaimForUser } from "@/lib/jobs";
import { uploadJobPhoto } from "@/lib/storage";

const DEFAULT_NOTE = "ส่งลูกค้าเรียบร้อย";

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

  await completeJob({
    jobId,
    claimerId: user.id,
    note: note?.trim() || DEFAULT_NOTE,
    photoUrl,
  });

  // ไม่ส่งแจ้งเตือนใดๆ แล้ว ผู้เปิดงานเข้าไปดูในหน้าประวัติงาน/รายละเอียดปิดงานเอาเองแทน (ประหยัดโควตาข้อความ)
  return NextResponse.json({ ok: true });
}
