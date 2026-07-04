import { supabase } from "./supabase";
import { getProfile } from "./line";

async function getSetting(key, fallback) {
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return data ? Number(data.value) : fallback;
}

async function getSettingText(key, fallback) {
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return data ? data.value : fallback;
}

async function isVipName(displayName) {
  if (!displayName) return false;
  const raw = await getSettingText("vip_names", "");
  const names = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return names.includes(displayName.trim().toLowerCase());
}

// คืน user เดิมถ้ามีอยู่แล้ว หรือสร้างใหม่พร้อมแจกเครดิตฟรีถ้าเป็นคนแรกเข้ามา
export async function getOrCreateUser(lineUserId) {
  const { data: existing } = await supabase
    .from("users")
    .select("*")
    .eq("line_user_id", lineUserId)
    .maybeSingle();

  if (existing) return { user: existing, isNew: false };

  const profile = await getProfile(lineUserId);
  const vip = await isVipName(profile?.displayName);
  const freeCredit = vip
    ? await getSetting("vip_signup_credit", 100)
    : await getSetting("signup_free_credit", 0);

  const { data: created, error } = await supabase
    .from("users")
    .insert({
      line_user_id: lineUserId,
      display_name: profile?.displayName ?? null,
      wallet_balance: freeCredit,
    })
    .select()
    .single();

  if (error) throw error;
  return { user: created, isNew: true, freeCredit };
}

// เติมชื่อ LINE ให้ user ถ้ายังว่าง (ใช้ชื่อจาก liff.getProfile ที่ฝั่ง client ส่งมา)
// จำเป็นสำหรับคนที่ยังไม่แอดเพื่อน เพราะ getProfile ฝั่งบอทดึงชื่อไม่ได้
export async function ensureDisplayName(user, displayName) {
  if (!displayName || user.display_name) return user;
  const { data } = await supabase
    .from("users")
    .update({ display_name: displayName })
    .eq("id", user.id)
    .select()
    .single();
  return data ?? user;
}

export async function getUserBalance(userId) {
  const { data, error } = await supabase
    .from("users")
    .select("wallet_balance")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return Number(data.wallet_balance);
}

// เคยเปิด/รับงานมาก่อนหรือยัง ใช้ตัดสินว่ายังอยู่ในโควตา "ครั้งแรกฟรี" อยู่มั้ย
export async function hasPriorJobActivity(userId) {
  const { count, error } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("type", ["job_post_fee", "job_claim_fee"]);

  if (error) throw error;
  return (count ?? 0) > 0;
}

const PROFILE_REMINDER_COOLDOWN_MS = 5 * 60 * 1000; // 5 นาที

// เช็คว่าเพิ่งเตือนให้กรอกโปรไฟล์ไปหรือยัง ถ้ายังไม่เคยเตือนในช่วง cooldown จะเตือนแล้วอัปเดตเวลา
export async function shouldSendProfileReminder(userId, sentAt) {
  const cooldownOk =
    !sentAt || Date.now() - new Date(sentAt).getTime() > PROFILE_REMINDER_COOLDOWN_MS;
  if (!cooldownOk) return false;

  await supabase
    .from("users")
    .update({ profile_reminder_sent_at: new Date().toISOString() })
    .eq("id", userId);
  return true;
}
