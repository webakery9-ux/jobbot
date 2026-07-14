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

