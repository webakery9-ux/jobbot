import { createClient } from "@supabase/supabase-js";

// ใช้ service_role key เพราะโค้ดนี้รันฝั่งเซิร์ฟเวอร์เท่านั้น ต้องผ่าน RLS ได้
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
