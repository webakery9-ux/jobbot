-- คืนเครดิต 2 เครดิต ให้ทั้งฝั่งเปิดงานและรับงาน เมื่อทำครบ 10 งานในวันเดียวกัน (นับตามเวลาไทย)
-- ทำงานโดยนับจำนวนงานของวันนี้หลังจาก insert แถวใหม่แล้ว ถ้าเท่ากับ 10 พอดี (ครั้งที่ 10) จะคืนเครดิตครั้งเดียวในวันนั้น

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
BEGIN
  v_fee := CEIL(p_wage / 100.0);

  UPDATE users SET wallet_balance = wallet_balance - v_fee
    WHERE id = p_poster_id AND wallet_balance >= v_fee;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDIT';
  END IF;

  INSERT INTO jobs (group_id, poster_id, detail, wage, payment_method, platform_fee, status, is_urgent, requested_vehicle_type)
  VALUES (p_group_id, p_poster_id, p_detail, p_wage, p_payment_method, v_fee, 'open', p_is_urgent, p_requested_vehicle_type)
  RETURNING * INTO v_job;

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

  RETURN v_job;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION claim_job(
  p_job_id UUID,
  p_claimer_id UUID
) RETURNS job_claims AS $$
DECLARE
  v_wage NUMERIC;
  v_fee NUMERIC;
  v_claim job_claims;
  v_has_active BOOLEAN;
  v_today_count INT;
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

  SELECT wage INTO v_wage FROM jobs WHERE id = p_job_id AND status = 'open';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'JOB_NOT_AVAILABLE';
  END IF;

  v_fee := CEIL(v_wage / 100.0);

  INSERT INTO job_claims (job_id, claimed_by, platform_fee)
  VALUES (p_job_id, p_claimer_id, v_fee)
  RETURNING * INTO v_claim;

  UPDATE users SET wallet_balance = wallet_balance - v_fee
    WHERE id = p_claimer_id AND wallet_balance >= v_fee;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDIT';
  END IF;

  UPDATE jobs SET status = 'claimed' WHERE id = p_job_id;

  INSERT INTO transactions (user_id, type, amount, ref_job_id)
  VALUES (p_claimer_id, 'job_claim_fee', v_fee, p_job_id);

  SELECT COUNT(*) INTO v_today_count FROM job_claims
    WHERE claimed_by = p_claimer_id
      AND (claimed_at AT TIME ZONE 'Asia/Bangkok')::date = (now() AT TIME ZONE 'Asia/Bangkok')::date;

  IF v_today_count = 10 THEN
    UPDATE users SET wallet_balance = wallet_balance + 2 WHERE id = p_claimer_id;
    INSERT INTO transactions (user_id, type, amount, ref_job_id)
    VALUES (p_claimer_id, 'loyalty_rebate', 2, p_job_id);
  END IF;

  RETURN v_claim;
END;
$$ LANGUAGE plpgsql;
