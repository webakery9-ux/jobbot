import { supabase } from "./supabase";

export async function getJobParticipants(jobId) {
  const { data: job, error } = await supabase
    .from("jobs")
    .select("id, detail, poster_id")
    .eq("id", jobId)
    .single();
  if (error) throw error;

  const { data: claim } = await supabase
    .from("job_claims")
    .select("claimed_by")
    .eq("job_id", jobId)
    .is("released_at", null)
    .maybeSingle();

  return { job, posterId: job.poster_id, claimerId: claim?.claimed_by ?? null };
}

export async function getChatMessages(jobId) {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, sender_id, content, created_at")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function sendChatMessage({ jobId, senderId, content }) {
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({ job_id: jobId, sender_id: senderId, content })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function resolveUserByLineId(lineUserId) {
  const { data } = await supabase
    .from("users")
    .select("id, display_name")
    .eq("line_user_id", lineUserId)
    .maybeSingle();
  return data;
}

// บันทึกว่า user คนนี้อ่านแชทของงานนี้แล้ว ณ ตอนนี้ (เรียกทุกครั้งที่เปิดหน้าแชท/ดึงข้อความ)
export async function markChatRead(jobId, userId) {
  await supabase
    .from("chat_reads")
    .upsert(
      { job_id: jobId, user_id: userId, last_read_at: new Date().toISOString() },
      { onConflict: "job_id,user_id" }
    );
}

// หาว่างานไหนใน jobIds ที่มีข้อความใหม่จากอีกฝ่ายที่ user ยังไม่ได้อ่าน
export async function getUnreadJobIds(userId, jobIds) {
  const ids = [...new Set(jobIds.filter(Boolean))];
  if (ids.length === 0) return [];

  const { data: messages } = await supabase
    .from("chat_messages")
    .select("job_id, sender_id, created_at")
    .in("job_id", ids)
    .neq("sender_id", userId)
    .order("created_at", { ascending: false });

  const { data: reads } = await supabase
    .from("chat_reads")
    .select("job_id, last_read_at")
    .eq("user_id", userId)
    .in("job_id", ids);

  const lastReadByJob = new Map((reads ?? []).map((r) => [r.job_id, new Date(r.last_read_at).getTime()]));
  const latestMessageByJob = new Map();
  for (const m of messages ?? []) {
    if (!latestMessageByJob.has(m.job_id)) latestMessageByJob.set(m.job_id, new Date(m.created_at).getTime());
  }

  const unread = [];
  for (const [jobId, latestAt] of latestMessageByJob) {
    const readAt = lastReadByJob.get(jobId) ?? 0;
    if (latestAt > readAt) unread.push(jobId);
  }
  return unread;
}
