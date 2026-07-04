import { NextResponse } from "next/server";
import { getOrCreateUser, ensureDisplayName } from "@/lib/users";

export async function POST(request) {
  const { lineUserId, displayName } = await request.json();
  if (!lineUserId) {
    return NextResponse.json({ error: "missing lineUserId" }, { status: 400 });
  }

  const { user } = await getOrCreateUser(lineUserId);
  await ensureDisplayName(user, displayName);

  const basicId = process.env.LINE_BASIC_ID;
  const addFriendUrl = basicId
    ? `https://line.me/R/ti/p/%40${basicId.replace(/^@/, "")}`
    : null;

  return NextResponse.json({
    profileCompleted: user.profile_completed,
    addFriendUrl,
  });
}
