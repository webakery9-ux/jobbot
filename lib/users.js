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

// คืน user เดิมถ้ามีอยู่แล้ว หรือสร้างใหม่พร้อมแจกเครดิตฟรีถ้าเป็นคนแรกเข้ามา
export async function getOrCreateUser(lineUserId) {
  const { data: existing } = await supabase
    .from("users")
    .select("*")
    .eq("line_user_id", lineUserId)
    .maybeSingle();

  if (existing) return { user: existing, isNew: false };

  const freeCredit = await getSetting("signup_free_credit", 0);
  const profile = await getProfile(lineUserId);

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

export async function getUserBalance(userId) {
  const { data, error } = await supabase
    .from("users")
    .select("wallet_balance")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return Number(data.wallet_balance);
}
