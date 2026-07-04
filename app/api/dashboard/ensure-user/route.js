import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/users";

export async function POST(request) {
  const { lineUserId } = await request.json();
  if (!lineUserId) {
    return NextResponse.json({ error: "missing lineUserId" }, { status: 400 });
  }

  const { user } = await getOrCreateUser(lineUserId);

  const basicId = process.env.LINE_BASIC_ID;
  const addFriendUrl = basicId
    ? `https://line.me/R/ti/p/%40${basicId.replace(/^@/, "")}`
    : null;

  return NextResponse.json({
    profileCompleted: user.profile_completed,
    addFriendUrl,
  });
}
