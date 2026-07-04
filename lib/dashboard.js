import { supabase } from "./supabase";

export async function getUserByLineId(lineUserId) {
  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("line_user_id", lineUserId)
    .maybeSingle();
  return data;
}

// งานที่ยังเปิดอยู่ในกลุ่มที่ user สังกัด (ไม่รวมงานที่ตัวเองโพสต์ และไม่รวมงานที่ตัวเองถูกบล็อก)
export async function getOpenJobsForUser(userId) {
  const { data: memberships } = await supabase
    .from("user_groups")
    .select("group_id")
    .eq("user_id", userId);

  const groupIds = (memberships ?? []).map((m) => m.group_id);
  if (groupIds.length === 0) return [];

  const { data, error } = await supabase
    .from("jobs")
    .select(
      "*, poster:poster_id(display_name, phone), group:group_id(group_name, line_group_id)"
    )
    .in("group_id", groupIds)
    .eq("status", "open")
    .neq("poster_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return data;
}

// ประวัติงานที่โพสต์ + งานที่รับ
export async function getUserHistory(userId) {
  const { data: posted } = await supabase
    .from("jobs")
    .select("*, group:group_id(group_name)")
    .eq("poster_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  const { data: claims } = await supabase
    .from("job_claims")
    .select(
      "id, claimed_at, released_at, job:job_id(id, detail, wage, payment_method, status, created_at, poster:poster_id(display_name), group:group_id(group_name))"
    )
    .eq("claimed_by", userId)
    .order("claimed_at", { ascending: false })
    .limit(100);

  return { posted: posted ?? [], claimed: claims ?? [] };
}

// สรุปรายได้จากงานที่รับ (นับ wage ของงานที่รับและยังไม่ปล่อยคืน) แยกช่วงเวลา
export async function getIncomeSummary(userId) {
  const { data } = await supabase
    .from("job_claims")
    .select("claimed_at, released_at, job:job_id(wage)")
    .eq("claimed_by", userId)
    .is("released_at", null);

  const rows = (data ?? []).filter((r) => r.job);

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfDay.getDate() - ((startOfDay.getDay() + 6) % 7)); // จันทร์เป็นวันแรก
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const sum = { day: 0, week: 0, month: 0, year: 0, all: 0, count: 0 };
  for (const r of rows) {
    const wage = Number(r.job.wage) || 0;
    const t = new Date(r.claimed_at);
    sum.all += wage;
    sum.count += 1;
    if (t >= startOfDay) sum.day += wage;
    if (t >= startOfWeek) sum.week += wage;
    if (t >= startOfMonth) sum.month += wage;
    if (t >= startOfYear) sum.year += wage;
  }
  return sum;
}
