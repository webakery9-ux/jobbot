import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { refreshGroupName } from "@/lib/groups";

export async function POST(request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { groupId } = await request.json();
  if (!groupId) return NextResponse.json({ error: "missing groupId" }, { status: 400 });

  try {
    const group = await refreshGroupName(groupId);
    return NextResponse.json({ ok: true, group });
  } catch (err) {
    if (err.message === "GROUP_NOT_FOUND") {
      return NextResponse.json({ error: "group not found" }, { status: 404 });
    }
    if (err.message === "LINE_SUMMARY_UNAVAILABLE") {
      return NextResponse.json(
        { error: "ดึงชื่อกลุ่มจาก LINE ไม่ได้ (บอทอาจถูกเชิญออกจากกลุ่มแล้ว)" },
        { status: 502 }
      );
    }
    throw err;
  }
}
