-- รองรับการโพสต์งานหลายงานพร้อมกันเป็นชุด (batch) แต่ละงานมีรหัสอ้างอิงของตัวเอง เช่น "XJ1"
-- ค่าเป็น NULL สำหรับงานที่โพสต์แบบเดิม (คำสั่ง /job หรือฟอร์มโพสต์งานทีละงาน)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_code TEXT;

-- เหมือน post_job เดิมทุกอย่าง (คัดลอกจาก migrations_subscription_billing.sql) เพิ่มแค่พารามิเตอร์ p_job_code
CREATE OR REPLACE FUNCTION post_job(
  p_poster_id UUID,
  p_group_id UUID,
  p_detail TEXT,
  p_wage NUMERIC,
  p_payment_method TEXT,
  p_is_urgent BOOLEAN DEFAULT false,
  p_requested_vehicle_type TEXT DEFAULT NULL,
  p_job_code TEXT DEFAULT NULL
) RETURNS jobs AS $$
DECLARE
  v_fee NUMERIC;
  v_job jobs;
  v_today_count INT;
  v_subscribed BOOLEAN;
BEGIN
  v_subscribed := group_has_active_subscription(p_group_id);

  IF v_subscribed THEN
    v_fee := 0;
  ELSE
    v_fee := CEIL(p_wage / 100.0);
    UPDATE users SET wallet_balance = wallet_balance - v_fee
      WHERE id = p_poster_id AND wallet_balance >= v_fee;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'INSUFFICIENT_CREDIT';
    END IF;
  END IF;

  INSERT INTO jobs (group_id, poster_id, detail, wage, payment_method, platform_fee, status, is_urgent, requested_vehicle_type, job_code)
  VALUES (p_group_id, p_poster_id, p_detail, p_wage, p_payment_method, v_fee, 'open', p_is_urgent, p_requested_vehicle_type, p_job_code)
  RETURNING * INTO v_job;

  IF v_fee > 0 THEN
    INSERT INTO transactions (user_id, type, amount, ref_job_id)
    VALUES (p_poster_id, 'job_post_fee', v_fee, v_job.id);

    SELECT COUNT(*) INTO v_today_count FROM jobs
      WHERE poster_id = p_poster_id
        AND (created_at AT TIME ZONE 'Asia/Bangkok')::date = (now() AT TIME ZONE 'Asia/Bangkok')::date;

    IF v_today_count = 10 THEN
      UPDATE users SET wallet_balance = wallet_balance + 2 WHERE id = p_poster_id;
      INSERT INTO transactions (user_id, type, amount, ref_job_id)
      VALUES (p_poster_id, 'loyalty_rebate', 2, v_job.id);
    END IF;
  END IF;

  RETURN v_job;
END;
$$ LANGUAGE plpgsql;
