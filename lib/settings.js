import { supabase } from "./supabase";

async function getSettingValue(key) {
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return data?.value ?? null;
}

// สวิตช์เปิด/ปิดการแสดงผลโมดูลเครดิตทั้งระบบ ปรับได้จากหน้าแอดมิน > ตั้งค่า
export async function isCreditModuleEnabled() {
  const value = await getSettingValue("credit_module_enabled");
  return value === "true";
}
