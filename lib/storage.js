import { supabase } from "./supabase";

async function uploadToBucket(bucket, path, base64) {
  const matches = base64.match(/^data:(image\/\w+);base64,(.+)$/);
  const contentType = matches ? matches[1] : "image/jpeg";
  const raw = matches ? matches[2] : base64;
  const buffer = Buffer.from(raw, "base64");

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, buffer, { contentType, upsert: false });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

// รับ base64 (มีหรือไม่มี data URL prefix ก็ได้) อัปโหลดขึ้น bucket job-photos คืน public URL
export async function uploadJobPhoto(jobId, base64) {
  const ext = (base64.match(/^data:image\/(\w+);base64,/) || [])[1] || "jpg";
  return uploadToBucket("job-photos", `${jobId}/${Date.now()}.${ext}`, base64);
}

// สลิปโอนเงินตอนเติมเครดิต ใช้ bucket เดียวกับรูปงาน แยกโฟลเดอร์ด้วย prefix topups/
export async function uploadTopupSlip(userId, base64) {
  const ext = (base64.match(/^data:image\/(\w+);base64,/) || [])[1] || "jpg";
  return uploadToBucket("job-photos", `topups/${userId}/${Date.now()}.${ext}`, base64);
}
