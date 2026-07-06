-- เก็บเวลาที่ดึงชื่อกลุ่มจาก LINE ล่าสุด เพื่อให้รู้ว่าควรดึงซ้ำเมื่อไหร่ (กันชื่อกลุ่มเก่าค้างถ้ามีคนเปลี่ยนชื่อกลุ่มใน LINE)
ALTER TABLE groups ADD COLUMN IF NOT EXISTS group_name_synced_at TIMESTAMPTZ;
