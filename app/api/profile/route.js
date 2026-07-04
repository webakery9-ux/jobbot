import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request) {
  const body = await request.json();
  const { lineUserId, firstName, lastName, phone, vehicleType, vehicleModel } = body;

  if (!lineUserId || !firstName || !lastName || !phone || !vehicleType) {
    return NextResponse.json({ error: "missing required fields" }, { status: 400 });
  }

  const { error } = await supabase
    .from("users")
    .update({
      first_name: firstName,
      last_name: lastName,
      phone,
      vehicle_type: vehicleType,
      vehicle_model: vehicleModel ?? null,
      profile_completed: true,
    })
    .eq("line_user_id", lineUserId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
}
