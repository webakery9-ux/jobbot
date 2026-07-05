import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { pushMessage } from "@/lib/line";
import { buildChatNotifyMessage, chatUrl } from "@/lib/jobs";

const DEBOUNCE_MS = 10_000;

export async function POST(request) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: pending, error } = await supabase
    .from("chat_messages")
    .select("id, job_id, sender_id, content, created_at")
    .is("notified_at", null);

  if (error) throw error;
  if (!pending || pending.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  const groups = new Map();
  for (const msg of pending) {
    const key = `${msg.job_id}:${msg.sender_id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(msg);
  }

  const now = Date.now();
  let processed = 0;

  for (const [key, msgs] of groups) {
    // ยังพิมพ์ต่ออยู่ (ข้อความล่าสุดยังไม่นิ่งครบ 10 วิ) รอรอบถัดไปค่อยรวมส่ง
    const latestCreatedAt = Math.max(...msgs.map((m) => new Date(m.created_at).getTime()));
    if (now - latestCreatedAt < DEBOUNCE_MS) continue;

    const [jobId, senderId] = key.split(":");

    const { data: job } = await supabase
      .from("jobs")
      .select("id, detail, poster_id")
      .eq("id", jobId)
      .single();
    if (!job) continue;

    const { data: claim } = await supabase
      .from("job_claims")
      .select("claimed_by")
      .eq("job_id", jobId)
      .is("released_at", null)
      .maybeSingle();

    const isSenderPoster = job.poster_id === senderId;
    const recipientId = isSenderPoster ? claim?.claimed_by : job.poster_id;
    const counterpartLabel = isSenderPoster ? "เจ้าของงาน" : "ผู้รับงาน";

    if (recipientId) {
      const { data: recipient } = await supabase
        .from("users")
        .select("line_user_id")
        .eq("id", recipientId)
        .single();
      const { data: sender } = await supabase
        .from("users")
        .select("display_name")
        .eq("id", senderId)
        .single();

      if (recipient?.line_user_id) {
        const uri = chatUrl(jobId);
        if (uri) {
          await pushMessage(recipient.line_user_id, [
            buildChatNotifyMessage({
              counterpartLabel,
              senderName: sender?.display_name ?? "-",
              jobDetail: job.detail,
              chatUri: uri,
            }),
          ]);
        }
      }
    }

    const ids = msgs.map((m) => m.id);
    await supabase
      .from("chat_messages")
      .update({ notified_at: new Date().toISOString() })
      .in("id", ids);
    processed += msgs.length;
  }

  return NextResponse.json({ processed });
}
