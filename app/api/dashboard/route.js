import { NextResponse } from "next/server";
import {
  getUserByLineId,
  getOpenJobsForUser,
  getUserHistory,
  getIncomeSummary,
} from "@/lib/dashboard";
import { getUserGroups, userHasCreditGroup } from "@/lib/groups";

export async function GET(request) {
  const url = new URL(request.url);
  const lineUserId = url.searchParams.get("lineUserId");
  const section = url.searchParams.get("section") ?? "home";

  if (!lineUserId) {
    return NextResponse.json({ error: "missing lineUserId" }, { status: 400 });
  }

  const user = await getUserByLineId(lineUserId);
  if (!user) {
    return NextResponse.json({ error: "user not found" }, { status: 404 });
  }

  const base = {
    profileCompleted: user.profile_completed,
    balance: Number(user.wallet_balance),
    displayName: user.display_name,
    creditModuleEnabled: await userHasCreditGroup(user.id),
  };

  if (section === "post") {
    const groups = await getUserGroups(user.id);
    return NextResponse.json({ ...base, groups });
  }
  if (section === "jobs") {
    const jobs = await getOpenJobsForUser(user.id);
    return NextResponse.json({ ...base, jobs });
  }
  if (section === "history") {
    const history = await getUserHistory(user.id);
    return NextResponse.json({ ...base, ...history });
  }
  if (section === "income") {
    const income = await getIncomeSummary(user.id);
    return NextResponse.json({ ...base, income });
  }
  if (section === "profile") {
    return NextResponse.json({
      ...base,
      profile: {
        firstName: user.first_name ?? "",
        lastName: user.last_name ?? "",
        phone: user.phone ?? "",
        vehicleType: user.vehicle_type ?? "Sedan",
        vehicleModel: user.vehicle_model ?? "",
        vehiclePlate: user.vehicle_plate ?? "",
      },
    });
  }

  return NextResponse.json(base);
}
