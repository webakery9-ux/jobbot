import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";
import { getGroupSummary } from "@/lib/line";

export async function GET(request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("groups")
    .select("id, line_group_id, group_name, billing_mode, subscription_valid_until, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;

  // เช็คสดว่าบอทยังอยู่ในแต่ละกลุ่มไหม (LINE จะดึง summary ไม่ได้ถ้าบอทถูกเชิญออกไปแล้ว)
  const groups = await Promise.all(
    (data ?? []).map(async (g) => ({
      ...g,
      botInGroup: (await getGroupSummary(g.line_group_id)) != null,
    }))
  );

  return NextResponse.json({ groups });
}

export async function POST(request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { groupId, billingMode, subscriptionValidUntil } = await request.json();
  if (!groupId || !["credit", "subscription"].includes(billingMode)) {
    return NextResponse.json({ error: "missing or invalid fields" }, { status: 400 });
  }
  if (billingMode === "subscription" && !subscriptionValidUntil) {
    return NextResponse.json({ error: "subscription needs a valid-until date" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("groups")
    .update({
      billing_mode: billingMode,
      subscription_valid_until: billingMode === "subscription" ? subscriptionValidUntil : null,
    })
    .eq("id", groupId)
    .select()
    .single();
  if (error) throw error;

  return NextResponse.json({ ok: true, group: data });
}
