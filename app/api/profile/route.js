import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request) {
  const body = await request.json();
  const {
    lineUserId,
    displayName,
    firstName,
    lastName,
    phone,
    vehicleType,
    vehicleModel,
    vehiclePlate,
  } = body;

  if (
    !lineUserId ||
    !firstName ||
    !lastName ||
    !phone ||
    !vehicleType ||
    !vehicleModel ||
    !vehiclePlate
  ) {
    return NextResponse.json({ error: "missing required fields" }, { status: 400 });
  }

  if (!/^[0-9]{10}$/.test(phone)) {
    return NextResponse.json({ error: "invalid phone" }, { status: 400 });
  }

  const patch = {
    first_name: firstName,
    last_name: lastName,
    phone,
    vehicle_type: vehicleType,
    vehicle_model: vehicleModel,
    vehicle_plate: vehiclePlate,
    profile_completed: true,
  };

  // เก็บชื่อ LINE ไว้ด้วยถ้ายังว่าง (กันกรณีคนยังไม่แอดเพื่อน บอทดึงชื่อไม่ได้)
  const { data: current } = await supabase
    .from("users")
    .select("display_name")
    .eq("line_user_id", lineUserId)
    .maybeSingle();
  if (displayName && !current?.display_name) patch.display_name = displayName;

  const { error } = await supabase.from("users").update(patch).eq("line_user_id", lineUserId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
}
