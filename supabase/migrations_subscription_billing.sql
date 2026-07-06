-- รองรับกลุ่มที่เหมาจ่ายรายเดือน (ไม่หักเครดิตต่องาน) แยกต่างหากจากกลุ่มที่ใช้ระบบเครดิตปกติ
ALTER TABLE groups ADD COLUMN IF NOT EXISTS billing_mode TEXT NOT NULL DEFAULT 'credit'; -- 'credit' | 'subscription'
ALTER TABLE groups ADD COLUMN IF NOT EXISTS subscription_valid_until DATE;

-- เปิด/ต่ออายุการเหมาจ่ายให้กลุ่ม (เรียกเองผ่าน Supabase SQL Editor ตอนนี้ ยังไม่มีหน้าแอดมิน)
CREATE OR REPLACE FUNCTION set_group_subscription(p_group_id UUID, p_valid_until DATE) RETURNS groups AS $$
DECLARE
  v_group groups;
BEGIN
  UPDATE groups SET billing_mode = 'subscription', subscription_valid_until = p_valid_until
    WHERE id = p_group_id
    RETURNING * INTO v_group;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GROUP_NOT_FOUND';
  END IF;
  RETURN v_group;
END;
$$ LANGUAGE plpgsql;

-- ยกเลิกการเหมาจ่าย กลับไปหักเครดิตต่องานตามปกติ
CREATE OR REPLACE FUNCTION revert_group_to_credit(p_group_id UUID) RETURNS groups AS $$
DECLARE
  v_group groups;
BEGIN
  UPDATE groups SET billing_mode = 'credit', subscription_valid_until = NULL
    WHERE id = p_group_id
    RETURNING * INTO v_group;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GROUP_NOT_FOUND';
  END IF;
  RETURN v_group;
END;
$$ LANGUAGE plpgsql;

-- ฟังก์ชันช่วยเช็คว่ากลุ่มนี้อยู่ในช่วงเหมาจ่ายที่ยังไม่หมดอายุหรือไม่
CREATE OR REPLACE FUNCTION group_has_active_subscription(p_group_id UUID) RETURNS BOOLEAN AS $$
DECLARE
  v_mode TEXT;
  v_until DATE;
BEGIN
  SELECT billing_mode, subscription_valid_until INTO v_mode, v_until FROM groups WHERE id = p_group_id;
  RETURN v_mode = 'subscription' AND v_until IS NOT NULL AND v_until >= (now() AT TIME ZONE 'Asia/Bangkok')::date;
END;
$$ LANGUAGE plpgsql;

-- post_job: ข้ามการหักเครดิต (และข้าม loyalty rebate) ถ้ากลุ่มเหมาจ่ายอยู่
CREATE OR REPLACE FUNCTION post_job(
  p_poster_id UUID,
  p_group_id UUID,
  p_detail TEXT,
  p_wage NUMERIC,
  p_payment_method TEXT,
  p_is_urgent BOOLEAN DEFAULT false,
  p_requested_vehicle_type TEXT DEFAULT NULL
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

  INSERT INTO jobs (group_id, poster_id, detail, wage, payment_method, platform_fee, status, is_urgent, requested_vehicle_type)
  VALUES (p_group_id, p_poster_id, p_detail, p_wage, p_payment_method, v_fee, 'open', p_is_urgent, p_requested_vehicle_type)
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

-- claim_job: ข้ามการหักเครดิต (และข้าม loyalty rebate) ถ้ากลุ่มของงานนี้เหมาจ่ายอยู่
CREATE OR REPLACE FUNCTION claim_job(
  p_job_id UUID,
  p_claimer_id UUID
) RETURNS job_claims AS $$
DECLARE
  v_wage NUMERIC;
  v_group_id UUID;
  v_fee NUMERIC;
  v_claim job_claims;
  v_has_active BOOLEAN;
  v_today_count INT;
  v_subscribed BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM job_claims jc
    JOIN jobs j ON j.id = jc.job_id
    WHERE jc.claimed_by = p_claimer_id
      AND jc.released_at IS NULL
      AND j.status = 'claimed'
  ) INTO v_has_active;

  IF v_has_active THEN
    RAISE EXCEPTION 'HAS_ACTIVE_JOB';
  END IF;

  SELECT wage, group_id INTO v_wage, v_group_id FROM jobs WHERE id = p_job_id AND status = 'open';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'JOB_NOT_AVAILABLE';
  END IF;

  v_subscribed := group_has_active_subscription(v_group_id);
  v_fee := CASE WHEN v_subscribed THEN 0 ELSE CEIL(v_wage / 100.0) END;

  INSERT INTO job_claims (job_id, claimed_by, platform_fee)
  VALUES (p_job_id, p_claimer_id, v_fee)
  RETURNING * INTO v_claim;

  IF v_fee > 0 THEN
    UPDATE users SET wallet_balance = wallet_balance - v_fee
      WHERE id = p_claimer_id AND wallet_balance >= v_fee;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'INSUFFICIENT_CREDIT';
    END IF;
    INSERT INTO transactions (user_id, type, amount, ref_job_id)
    VALUES (p_claimer_id, 'job_claim_fee', v_fee, p_job_id);
  END IF;

  UPDATE jobs SET status = 'claimed' WHERE id = p_job_id;

  IF v_fee > 0 THEN
    SELECT COUNT(*) INTO v_today_count FROM job_claims
      WHERE claimed_by = p_claimer_id
        AND (claimed_at AT TIME ZONE 'Asia/Bangkok')::date = (now() AT TIME ZONE 'Asia/Bangkok')::date;

    IF v_today_count = 10 THEN
      UPDATE users SET wallet_balance = wallet_balance + 2 WHERE id = p_claimer_id;
      INSERT INTO transactions (user_id, type, amount, ref_job_id)
      VALUES (p_claimer_id, 'loyalty_rebate', 2, p_job_id);
    END IF;
  END IF;

  RETURN v_claim;
END;
$$ LANGUAGE plpgsql;
