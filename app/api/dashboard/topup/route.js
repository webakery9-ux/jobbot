import { NextResponse } from "next/server";
import { getUserByLineId } from "@/lib/dashboard";
import { requestCreditTopup, CREDIT_PACKAGES } from "@/lib/credit";

export async function POST(request) {
  const { lineUserId, packageThb, slipBase64 } = await request.json();
  if (!lineUserId || !packageThb || !slipBase64) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const user = await getUserByLineId(lineUserId);
  if (!user) return NextResponse.json({ error: "user not found" }, { status: 404 });

  if (!CREDIT_PACKAGES.some((p) => p.thb === Number(packageThb))) {
    return NextResponse.json({ error: "invalid package" }, { status: 400 });
  }

  try {
    const topup = await requestCreditTopup({ userId: user.id, packageThb, slipBase64 });
    return NextResponse.json({ ok: true, topup });
  } catch (err) {
    return NextResponse.json({ error: "topup request failed" }, { status: 500 });
  }
}
