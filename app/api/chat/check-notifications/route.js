import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { pushMessage } from "@/lib/line";

const DEBOUNCE_MS = 10_000;

export async function POST(request) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - DEBOUNCE_MS).toISOString();

  const { data: pending, error } = await supabase
    .from("chat_messages")
    .select("id, job_id, sender_id, content, created_at")
    .is("notified_at", null)
    .lt("created_at", cutoff);

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

  const chatLiffId = process.env.NEXT_PUBLIC_CHAT_LIFF_ID;

  for (const [key, msgs] of groups) {
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

    const recipientId = job.poster_id === senderId ? claim?.claimed_by : job.poster_id;

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
        const chatUrl = chatLiffId ? `https://liff.line.me/${chatLiffId}/${jobId}` : null;
        await pushMessage(recipient.line_user_id, [
          {
            type: "text",
            text:
              `💬 ${sender?.display_name ?? "-"} ส่งข้อความถึงคุณ (${msgs.length} ข้อความ)\n` +
              `งาน: ${job.detail}` +
              (chatUrl ? `\n\nเปิดแชท: ${chatUrl}` : ""),
          },
        ]);
      }
    }

    const ids = msgs.map((m) => m.id);
    await supabase
      .from("chat_messages")
      .update({ notified_at: new Date().toISOString() })
      .in("id", ids);
  }

  return NextResponse.json({ processed: pending.length });
}
