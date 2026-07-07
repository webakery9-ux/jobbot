import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";

const KEYS = ["signup_free_credit", "vip_signup_credit", "vip_names", "credit_module_enabled"];

export async function GET(request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase.from("settings").select("key, value").in("key", KEYS);
  if (error) throw error;

  const settings = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
  return NextResponse.json({
    signupFreeCredit: settings.signup_free_credit ?? "0",
    vipSignupCredit: settings.vip_signup_credit ?? "0",
    vipNames: settings.vip_names ?? "",
    creditModuleEnabled: settings.credit_module_enabled === "true",
  });
}

export async function POST(request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { signupFreeCredit, vipSignupCredit, vipNames, creditModuleEnabled } = await request.json();

  const rows = [
    { key: "signup_free_credit", value: String(signupFreeCredit ?? "0") },
    { key: "vip_signup_credit", value: String(vipSignupCredit ?? "0") },
    { key: "vip_names", value: String(vipNames ?? "") },
    { key: "credit_module_enabled", value: creditModuleEnabled ? "true" : "false" },
  ];

  const { error } = await supabase.from("settings").upsert(rows, { onConflict: "key" });
  if (error) throw error;

  return NextResponse.json({ ok: true });
}
