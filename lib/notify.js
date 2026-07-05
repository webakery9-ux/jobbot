import { supabase } from "./supabase";
import { pushMessage } from "./line";
import { buildGroupClaimedMessage, buildClaimedCard } from "./jobs";

async function balanceOf(userId) {
  const { data } = await supabase
    .from("users")
    .select("wallet_balance")
    .eq("id", userId)
    .single();
  return Number(data?.wallet_balance ?? 0);
}

// ส่งแจ้งเตือนเมื่อจับคู่งานสำเร็จ: DM หาผู้รับงาน + ประกาศในกลุ่ม
// ไม่ส่ง DM หาผู้เปิดงานแล้ว (ให้เข้าไปดูในระบบ/ประวัติงานเอง ประหยัดโควตาข้อความ)
export async function sendMatchNotifications({ job, claimer, claim }) {
  const poster = job.poster;

  const claimerBalance = await balanceOf(claimer.id);

  const tasks = [
    pushMessage(claimer.line_user_id, [
      buildClaimedCard(job, poster, claim, claimerBalance),
    ]),
  ];

  if (job.group?.line_group_id) {
    const groupMessage = buildGroupClaimedMessage(claimer, poster, job.line_quote_token);
    tasks.push(pushMessage(job.group.line_group_id, [groupMessage]));
  }

  await Promise.all(tasks);
}
