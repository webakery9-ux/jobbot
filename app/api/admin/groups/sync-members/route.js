import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";
import { syncGroupMembers } from "@/lib/groups";

export async function POST(request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { groupId } = await request.json();
  if (!groupId) return NextResponse.json({ error: "missing groupId" }, { status: 400 });

  const { data: group } = await supabase.from("groups").select("*").eq("id", groupId).maybeSingle();
  if (!group) return NextResponse.json({ error: "group not found" }, { status: 404 });

  const memberCount = await syncGroupMembers(group);
  return NextResponse.json({ ok: true, memberCount });
}
