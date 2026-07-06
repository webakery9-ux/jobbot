import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { getMessageQuota, getMessageConsumption } from "@/lib/line";

export async function GET(request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [quota, consumption] = await Promise.all([
    getMessageQuota(),
    getMessageConsumption(),
  ]);

  return NextResponse.json({
    lineOA: {
      quota: quota?.value ?? null,
      used: consumption?.totalUsage ?? null,
    },
    // ยังไม่ได้เชื่อม API ของ Vercel/Supabase/Slip2Go (ต้องมี access token แยกต่างหาก)
    // ให้ลิงก์ไปเช็คที่แดชบอร์ดจริงไปก่อน
    other: [
      { name: "Vercel", note: "เช็ค Bandwidth/Function usage ที่ vercel.com/dashboard", url: "https://vercel.com/dashboard" },
      { name: "Supabase", note: "เช็ค Database size/MAU ที่ supabase.com/dashboard", url: "https://supabase.com/dashboard" },
      { name: "Slip2Go", note: "ยังไม่ได้สมัครใช้งาน (พักไว้ก่อนจนกว่าจะเปิดรับเงินจริง)", url: "https://slip2go.com/pricing" },
    ],
  });
}
