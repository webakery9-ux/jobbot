import { supabase } from "./supabase";

// รับ base64 (มีหรือไม่มี data URL prefix ก็ได้) อัปโหลดขึ้น bucket job-photos คืน public URL
export async function uploadJobPhoto(jobId, base64) {
  const matches = base64.match(/^data:(image\/\w+);base64,(.+)$/);
  const contentType = matches ? matches[1] : "image/jpeg";
  const raw = matches ? matches[2] : base64;
  const buffer = Buffer.from(raw, "base64");
  const ext = contentType.split("/")[1] || "jpg";
  const path = `${jobId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("job-photos")
    .upload(path, buffer, { contentType, upsert: false });
  if (error) throw error;

  const { data } = supabase.storage.from("job-photos").getPublicUrl(path);
  return data.publicUrl;
}
