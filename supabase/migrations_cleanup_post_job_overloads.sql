-- ทำความสะอาด: post_job เคยถูกแก้เพิ่มพารามิเตอร์หลายรอบ (ด่วน, ประเภทรถ, รหัสงาน) แต่ละรอบ
-- CREATE OR REPLACE ด้วย signature ใหม่ที่ไม่ตรงกับของเดิมเป๊ะ ทำให้ Postgres มองเป็นฟังก์ชันคนละตัว
-- (overload) แทนที่จะแทนที่ของเดิม เหลือค้างอยู่ 3 เวอร์ชันเก่าที่ไม่มีใครเรียกใช้แล้ว
-- (แอปเรียกแบบส่งครบทุกพารามิเตอร์เสมอ ตรงกับเวอร์ชันล่าสุด 8 พารามิเตอร์เท่านั้น) ลบทิ้งให้เหลือตัวเดียว
DROP FUNCTION IF EXISTS public.post_job(uuid, uuid, text, numeric, text);
DROP FUNCTION IF EXISTS public.post_job(uuid, uuid, text, numeric, text, boolean);
DROP FUNCTION IF EXISTS public.post_job(uuid, uuid, text, numeric, text, boolean, text);
