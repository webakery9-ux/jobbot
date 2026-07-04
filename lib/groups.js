import { supabase } from "./supabase";
import { getGroupSummary } from "./line";

export async function getOrCreateGroup(lineGroupId) {
  const { data: existing } = await supabase
    .from("groups")
    .select("*")
    .eq("line_group_id", lineGroupId)
    .maybeSingle();

  if (existing) return existing;

  const summary = await getGroupSummary(lineGroupId);

  const { data: created, error } = await supabase
    .from("groups")
    .insert({ line_group_id: lineGroupId, group_name: summary?.groupName ?? null })
    .select()
    .single();

  if (error) throw error;
  return created;
}

// ผูก user เข้ากับกลุ่ม (idempotent) ใช้ตอนโพสต์งาน/รับงาน เพื่อให้หน้าจัดการรู้ว่าอยู่กลุ่มไหนบ้าง
export async function linkUserToGroup(userId, groupId, role = "member") {
  await supabase
    .from("user_groups")
    .upsert(
      { user_id: userId, group_id: groupId, role },
      { onConflict: "user_id,group_id", ignoreDuplicates: true }
    );
}

// กลุ่มทั้งหมดที่ user เคยมีปฏิสัมพันธ์ (สำหรับ dropdown เลือกกลุ่มตอนโพสต์งาน)
export async function getUserGroups(userId) {
  const { data, error } = await supabase
    .from("user_groups")
    .select("group:group_id(id, line_group_id, group_name)")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((r) => r.group).filter(Boolean);
}
