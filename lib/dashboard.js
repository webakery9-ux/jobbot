import { supabase } from "./supabase";

export async function getUserByLineId(lineUserId) {
  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("line_user_id", lineUserId)
    .maybeSingle();
  return data;
}

// งานที่ยังเปิดอยู่ เฉพาะกลุ่มที่ user สังกัดจริง (ไม่รวมงานที่ตัวเองโพสต์)
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
      "*, poster:poster_id(display_name, phone), group:group_id(id, group_name, line_group_id)"
    )
    .in("group_id", groupIds)
    .eq("status", "open")
    .neq("poster_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

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

const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;

// แปลงเวลาจริง (UTC) เป็นวันเวลาตามนาฬิกาเมืองไทย (สำหรับอ่านปี/เดือน/วัน/วันในสัปดาห์เท่านั้น)
function toBkkWallClock(date) {
  return new Date(date.getTime() + BKK_OFFSET_MS);
}

// หาจุดเริ่มต้นของวัน/สัปดาห์/เดือน/ปี ตามเวลาไทย แล้วแปลงกลับเป็นเวลาจริง (UTC) เพื่อเทียบกับ timestamp ในฐานข้อมูล
function bkkStartOf(unit, refDate) {
  const b = toBkkWallClock(refDate);
  let y = b.getUTCFullYear();
  let m = b.getUTCMonth();
  let d = b.getUTCDate();

  if (unit === "day") {
    // no-op, use y/m/d as-is
  } else if (unit === "week") {
    const dow = (b.getUTCDay() + 6) % 7; // จันทร์เป็นวันแรก
    d -= dow;
  } else if (unit === "month") {
    d = 1;
  } else if (unit === "year") {
    m = 0;
    d = 1;
  }

  const startBkkAsUtc = Date.UTC(y, m, d);
  return new Date(startBkkAsUtc - BKK_OFFSET_MS);
}

// สรุปรายได้จากงานที่รับ (นับ wage ของงานที่รับและยังไม่ปล่อยคืน) แยกช่วงเวลาตามเวลาไทย
export async function getIncomeSummary(userId) {
  const { data } = await supabase
    .from("job_claims")
    .select(
      "id, claimed_at, released_at, job:job_id(id, detail, wage, payment_method, group:group_id(group_name))"
    )
    .eq("claimed_by", userId)
    .is("released_at", null)
    .order("claimed_at", { ascending: false });

  const rows = (data ?? []).filter((r) => r.job);

  const now = new Date();
  const startOfDay = bkkStartOf("day", now);
  const startOfWeek = bkkStartOf("week", now);
  const startOfMonth = bkkStartOf("month", now);
  const startOfYear = bkkStartOf("year", now);

  const sum = { day: 0, week: 0, month: 0, year: 0, all: 0, count: 0, items: [] };
  for (const r of rows) {
    const wage = Number(r.job.wage) || 0;
    const t = new Date(r.claimed_at);
    const inDay = t >= startOfDay;
    const inWeek = t >= startOfWeek;
    const inMonth = t >= startOfMonth;
    const inYear = t >= startOfYear;

    sum.all += wage;
    sum.count += 1;
    if (inDay) sum.day += wage;
    if (inWeek) sum.week += wage;
    if (inMonth) sum.month += wage;
    if (inYear) sum.year += wage;

    sum.items.push({
      id: r.id,
      jobId: r.job.id,
      detail: r.job.detail,
      wage,
      paymentMethod: r.job.payment_method,
      groupName: r.job.group?.group_name || null,
      claimedAt: r.claimed_at,
      day: inDay,
      week: inWeek,
      month: inMonth,
      year: inYear,
    });
  }
  return sum;
}
