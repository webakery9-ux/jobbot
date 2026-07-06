import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";

export async function GET(request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ users: [] });

  const { data, error } = await supabase
    .from("users")
    .select("id, display_name, first_name, last_name, phone, line_user_id, wallet_balance")
    .or(
      `display_name.ilike.%${q}%,phone.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%,line_user_id.ilike.%${q}%`
    )
    .limit(20);

  if (error) throw error;
  return NextResponse.json({ users: data ?? [] });
}

export async function POST(request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { userId, amount, reason } = await request.json();
  const delta = Number(amount);
  if (!userId || !delta || Number.isNaN(delta)) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const { data: updated, error } = await supabase.rpc("admin_adjust_credit", {
    p_user_id: userId,
    p_amount: delta,
    p_note: reason || null,
  });
  if (error) {
    if (error.message?.includes("USER_NOT_FOUND_OR_NEGATIVE_BALANCE")) {
      return NextResponse.json({ error: "user not found or balance would go negative" }, { status: 400 });
    }
    throw error;
  }

  return NextResponse.json({ ok: true, balance: Number(updated.wallet_balance) });
}
