import { NextResponse } from "next/server";
import { getUserByLineId } from "@/lib/dashboard";
import { getUserGroups } from "@/lib/groups";
import { pushMessage } from "@/lib/line";
import { postJob, buildBatchSummaryMessage } from "@/lib/jobs";

// งานที่โพสต์เป็นชุดไม่ติดตามวิธีจ่ายเงินผ่านระบบ (ผู้เกี่ยวข้องไปตกลงกันเอง) ใส่ค่าคงที่ไว้แค่ให้ field ที่มีอยู่แสดงผลได้
const BATCH_PAYMENT_METHOD_PLACEHOLDER = "ตามตกลง";

export async function POST(request) {
  const body = await request.json();
  const { lineUserId, groupId, batchLabelDate, jobs } = body;

  if (!lineUserId || !groupId || !Array.isArray(jobs) || jobs.length === 0) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const user = await getUserByLineId(lineUserId);
  if (!user) return NextResponse.json({ error: "user not found" }, { status: 404 });
  if (!user.profile_completed) {
    return NextResponse.json({ error: "profile required" }, { status: 403 });
  }

  const groups = await getUserGroups(user.id);
  const group = groups.find((g) => g.id === groupId);
  if (!group) return NextResponse.json({ error: "group not found" }, { status: 404 });

  // โพสต์ทีละงานตามลำดับ (ไม่ Promise.all) กันงานหนึ่งพังแล้วดึงอีก 29 งานไปด้วย
  const results = [];
  for (const j of jobs) {
    const wageNum = parseFloat(j.wage);
    if (!j.detail || isNaN(wageNum) || wageNum <= 0 || !j.vehicleType) {
      results.push({ jobCode: j.jobCode, ok: false, error: "invalid_job" });
      continue;
    }
    try {
      const job = await postJob({
        posterId: user.id,
        groupId,
        detail: j.detail,
        wage: wageNum,
        paymentMethod: BATCH_PAYMENT_METHOD_PLACEHOLDER,
        isUrgent: false,
        vehicleType: j.vehicleType,
        jobCode: j.jobCode,
      });
      results.push({ jobCode: j.jobCode, ok: true, jobId: job.id, previewLine: j.previewLine });
    } catch (err) {
      if (err.message?.includes("INSUFFICIENT_CREDIT")) {
        results.push({ jobCode: j.jobCode, ok: false, error: "insufficient_credit" });
      } else {
        results.push({ jobCode: j.jobCode, ok: false, error: "post_failed" });
      }
    }
  }

  const succeeded = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);

  // ข้อความรวมเดียวเข้ากลุ่ม แทนการ์ดแยกทีละงาน
  if (succeeded.length > 0 && group.line_group_id) {
    const mgmt = process.env.NEXT_PUBLIC_MGMT_LIFF_ID;
    const jobsTabUri = mgmt ? `https://liff.line.me/${mgmt}?tab=jobs` : "#";
    const summaryMessage = buildBatchSummaryMessage(succeeded, batchLabelDate, jobsTabUri);
    await pushMessage(group.line_group_id, [summaryMessage]);
  }

  // ไม่ส่ง DM แจ้งผู้โพสต์แล้ว (ฝั่งแอปโชว์ popup สรุปผลจาก response นี้แทน)
  const updated = await getUserByLineId(lineUserId);
  return NextResponse.json({
    postedCount: succeeded.length,
    failedCount: failed.length,
    failed,
    balance: Number(updated.wallet_balance),
  });
}
