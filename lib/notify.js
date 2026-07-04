import { supabase } from "./supabase";
import { pushMessage } from "./line";
import { formatThaiDateTime, displayNameOf, buildGroupClaimedMessage } from "./jobs";

function personLine(user) {
  const name = displayNameOf(user);
  return user?.phone ? `${name}\nโทร ${user.phone}` : name;
}

function chatUrl(jobId) {
  const liffId = process.env.NEXT_PUBLIC_CHAT_LIFF_ID;
  return liffId ? `https://liff.line.me/${liffId}/${jobId}` : null;
}

async function balanceOf(userId) {
  const { data } = await supabase
    .from("users")
    .select("wallet_balance")
    .eq("id", userId)
    .single();
  return Number(data?.wallet_balance ?? 0);
}

// ส่งแจ้งเตือนเมื่อจับคู่งานสำเร็จ: DM ทั้งสองฝั่ง + quote reply ในกลุ่ม
// ยิงพร้อมกันทั้งหมด (ไม่รอทีละอัน) เพื่อลดเวลารอของฝั่งที่เรียก API นี้
// job ต้องมี poster (display_name, line_user_id, phone) และ group (line_group_id)
export async function sendMatchNotifications({ job, claimer, claim }) {
  const poster = job.poster;
  const link = chatUrl(job.id);

  const [claimerBalance, posterBalance] = await Promise.all([
    balanceOf(claimer.id),
    poster?.id ? balanceOf(poster.id) : Promise.resolve(0),
  ]);

  const tasks = [
    pushMessage(claimer.line_user_id, [
      {
        type: "text",
        text:
          `✅ คุณได้รับงานนี้แล้ว!\n` +
          `งาน: ${job.detail}\n${formatThaiDateTime(job.created_at)}\n\n` +
          `ผู้จ้างงาน: ${personLine(poster)}\n${formatThaiDateTime(claim.claimed_at)}` +
          (link ? `\n\n💬 เปิดแชทคุยกับผู้จ้างงาน: ${link}` : "") +
          `\n\nเครดิตคงเหลือของคุณ: ${claimerBalance}`,
      },
    ]),
  ];

  if (poster?.line_user_id) {
    tasks.push(
      pushMessage(poster.line_user_id, [
        {
          type: "text",
          text:
            `🎉 มีคนรับงานแล้ว!\n` +
            `งาน: ${job.detail}\n${formatThaiDateTime(job.created_at)}\n\n` +
            `ผู้รับงาน: ${personLine(claimer)}\n${formatThaiDateTime(claim.claimed_at)}` +
            (link ? `\n\n💬 เปิดแชทคุยกับผู้รับงาน: ${link}` : "") +
            `\n\nเครดิตคงเหลือของคุณ: ${posterBalance}`,
        },
      ])
    );
  }

  if (job.group?.line_group_id) {
    const groupMessage = buildGroupClaimedMessage(claimer, poster, job.line_quote_token);
    tasks.push(pushMessage(job.group.line_group_id, [groupMessage]));
  }

  await Promise.all(tasks);
}
