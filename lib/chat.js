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
