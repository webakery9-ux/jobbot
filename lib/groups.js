import { supabase } from "./supabase";
import { getGroupSummary } from "./line";

const NAME_REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 วัน

export async function getOrCreateGroup(lineGroupId) {
  const { data: existing } = await supabase
    .from("groups")
    .select("*")
    .eq("line_group_id", lineGroupId)
    .maybeSingle();

  if (existing) {
    // ไม่มีชื่อเลย (สร้างก่อนมีฟีเจอร์นี้/ดึงไม่สำเร็จตอนนั้น) หรือดึงมานานเกิน 7 วันแล้ว (เผื่อมีคนเปลี่ยนชื่อกลุ่มใน LINE) ลองดึงซ้ำ
    const lastSynced = existing.group_name_synced_at
      ? new Date(existing.group_name_synced_at).getTime()
      : 0;
    const isStale = Date.now() - lastSynced > NAME_REFRESH_INTERVAL_MS;

    if (!existing.group_name || isStale) {
      const summary = await getGroupSummary(lineGroupId);
      if (summary?.groupName) {
        const { data: updated } = await supabase
          .from("groups")
          .update({ group_name: summary.groupName, group_name_synced_at: new Date().toISOString() })
          .eq("id", existing.id)
          .select()
          .single();
        if (updated) return updated;
      }
    }
    return existing;
  }

  const summary = await getGroupSummary(lineGroupId);

  const { data: created, error } = await supabase
    .from("groups")
    .insert({
      line_group_id: lineGroupId,
      group_name: summary?.groupName ?? null,
      group_name_synced_at: summary?.groupName ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) throw error;
  return created;
}

// บังคับดึงชื่อกลุ่มจาก LINE ใหม่ทันที ไม่รอครบ 7 วัน (ใช้จากหน้าแอดมิน)
export async function refreshGroupName(groupId) {
  const { data: group } = await supabase.from("groups").select("*").eq("id", groupId).maybeSingle();
  if (!group) throw new Error("GROUP_NOT_FOUND");

  const summary = await getGroupSummary(group.line_group_id);
  if (!summary?.groupName) throw new Error("LINE_SUMMARY_UNAVAILABLE");

  const { data: updated, error } = await supabase
    .from("groups")
    .update({ group_name: summary.groupName, group_name_synced_at: new Date().toISOString() })
    .eq("id", groupId)
    .select()
    .single();
  if (error) throw error;
  return updated;
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
