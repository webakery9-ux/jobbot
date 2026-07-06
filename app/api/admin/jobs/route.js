import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";

export async function GET(request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const q = new URL(request.url).searchParams.get("q")?.trim();

  let query = supabase
    .from("jobs")
    .select(
      "id, detail, wage, payment_method, status, created_at, poster:poster_id(display_name, phone), group:group_id(group_name)"
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (q) query = query.ilike("detail", `%${q}%`);

  const { data, error } = await query;
  if (error) throw error;
  return NextResponse.json({ jobs: data ?? [] });
}

export async function POST(request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { jobId } = await request.json();
  if (!jobId) return NextResponse.json({ error: "missing jobId" }, { status: 400 });

  const { data, error } = await supabase.rpc("admin_remove_job", { p_job_id: jobId });
  if (error) {
    if (error.message?.includes("JOB_NOT_REMOVABLE")) {
      return NextResponse.json({ error: "job already claimed/done, cannot remove" }, { status: 400 });
    }
    if (error.message?.includes("JOB_NOT_FOUND")) {
      return NextResponse.json({ error: "job not found" }, { status: 404 });
    }
    throw error;
  }

  return NextResponse.json({ ok: true, job: data });
}
