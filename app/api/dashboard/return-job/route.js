import { NextResponse } from "next/server";
import { getUserByLineId } from "@/lib/dashboard";
import { returnJob, getActiveClaimForUser } from "@/lib/jobs";

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

  // คืนเครดิต+ปล่อยงานกลับเป็น open ในฐานข้อมูล แต่ยังไม่ประกาศเข้ากลุ่ม (พักฟีเจอร์นี้ไว้ก่อนตามที่ตกลง)
  await returnJob({ jobId, claimerId: user.id });

  const updated = await getUserByLineId(lineUserId);
  return NextResponse.json({ ok: true, balance: Number(updated.wallet_balance) });
}
