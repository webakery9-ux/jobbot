import { supabase } from "./supabase";
import { uploadTopupSlip } from "./storage";

export const CREDIT_PACKAGES = [
  { thb: 20, credits: 20 },
  { thb: 50, credits: 52 },
  { thb: 100, credits: 105 },
  { thb: 200, credits: 215 },
  { thb: 300, credits: 325 },
  { thb: 500, credits: 550 },
];

function findPackage(thb) {
  return CREDIT_PACKAGES.find((p) => p.thb === Number(thb));
}

// เตรียมโครงไว้ล่วงหน้าสำหรับ Slip2Go Verify Slip API
// ยังไม่ผูก endpoint จริง (รอ SLIP2GO_API_KEY + เอกสาร API) ตอนนี้ทุกคำขอจะเข้าคิวรอแอดมินตรวจเองก่อน
async function verifySlipWithSlip2Go(_slipBase64, _expectedAmountThb) {
  if (!process.env.SLIP2GO_API_KEY) return { verified: false, reason: "not_configured" };
  // TODO: เรียก Slip2Go Verify Slip API จริงตอนมี API key + เอกสาร endpoint แล้ว
  return { verified: false, reason: "not_implemented" };
}

// สร้างคำขอเติมเครดิต: อัปโหลดสลิป, ลองตรวจผ่าน Slip2Go อัตโนมัติ (ถ้าตั้งค่าไว้), ไม่งั้นเข้าคิวรอแอดมิน
export async function requestCreditTopup({ userId, packageThb, slipBase64 }) {
  const pkg = findPackage(packageThb);
  if (!pkg) throw new Error("INVALID_PACKAGE");

  const slipUrl = await uploadTopupSlip(userId, slipBase64);

  const { data: topup, error } = await supabase
    .from("credit_topups")
    .insert({
      user_id: userId,
      package_thb: pkg.thb,
      package_credits: pkg.credits,
      slip_photo_url: slipUrl,
      status: "pending",
    })
    .select()
    .single();
  if (error) throw error;

  const check = await verifySlipWithSlip2Go(slipBase64, pkg.thb);
  if (check.verified) {
    const { data: approved, error: approveErr } = await supabase.rpc("approve_credit_topup", {
      p_topup_id: topup.id,
    });
    if (approveErr) throw approveErr;
    return { ...topup, status: "verified", autoVerified: true };
  }

  return { ...topup, autoVerified: false };
}

export async function getPendingTopupsForUser(userId) {
  const { data, error } = await supabase
    .from("credit_topups")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  return data ?? [];
}
