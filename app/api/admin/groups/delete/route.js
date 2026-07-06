import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";

export async function POST(request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { groupId, force } = await request.json();
  if (!groupId) return NextResponse.json({ error: "missing groupId" }, { status: 400 });

  const { data, error } = await supabase.rpc("admin_delete_group", {
    p_group_id: groupId,
    p_force: !!force,
  });

  if (error) {
    const match = error.message?.match(/HAS_DEPENDENT_JOBS:(\d+)/);
    if (match) {
      return NextResponse.json(
        { error: "has_dependent_jobs", jobCount: Number(match[1]) },
        { status: 409 }
      );
    }
    throw error;
  }

  return NextResponse.json({ ok: true, deletedJobs: data });
}
