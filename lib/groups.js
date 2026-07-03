import { supabase } from "./supabase";

export async function getOrCreateGroup(lineGroupId) {
  const { data: existing } = await supabase
    .from("groups")
    .select("*")
    .eq("line_group_id", lineGroupId)
    .maybeSingle();

  if (existing) return existing;

  const { data: created, error } = await supabase
    .from("groups")
    .insert({ line_group_id: lineGroupId })
    .select()
    .single();

  if (error) throw error;
  return created;
}
