-- คอลัมน์เพิ่มเติมสำหรับปิดงาน
ALTER TABLE job_claims ADD COLUMN IF NOT EXISTS delivery_note TEXT;

-- Storage bucket สำหรับรูปปิดงาน (public อ่านได้ ไม่ต้อง auth)
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-photos', 'job-photos', true)
ON CONFLICT (id) DO NOTHING;

-- claim_job: เพิ่มเงื่อนไขห้ามรับงานซ้อน (ต้องจบ/คืนงานเดิมก่อน)
CREATE OR REPLACE FUNCTION claim_job(
  p_job_id UUID,
  p_claimer_id UUID
) RETURNS job_claims AS $$
DECLARE
  v_wage NUMERIC;
  v_fee NUMERIC;
  v_claim job_claims;
  v_has_active BOOLEAN;
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

  RETURN v_claim;
END;
$$ LANGUAGE plpgsql;

-- คืนงาน: คืนเครดิต + เปิดงานกลับเป็น open
CREATE OR REPLACE FUNCTION return_job(
  p_job_id UUID,
  p_claimer_id UUID
) RETURNS job_claims AS $$
DECLARE
  v_claim job_claims;
  v_fee NUMERIC;
BEGIN
  SELECT * INTO v_claim FROM job_claims
    WHERE job_id = p_job_id AND claimed_by = p_claimer_id AND released_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CLAIM_NOT_FOUND';
  END IF;

  v_fee := v_claim.platform_fee;

  UPDATE job_claims SET released_at = now() WHERE id = v_claim.id;
  UPDATE jobs SET status = 'open' WHERE id = p_job_id;
  UPDATE users SET wallet_balance = wallet_balance + v_fee WHERE id = p_claimer_id;

  INSERT INTO transactions (user_id, type, amount, ref_job_id)
  VALUES (p_claimer_id, 'job_claim_refund', v_fee, p_job_id);

  RETURN v_claim;
END;
$$ LANGUAGE plpgsql;

-- ปิดงาน: บันทึกหมายเหตุ/รูป และตั้งสถานะเป็น done
CREATE OR REPLACE FUNCTION complete_job(
  p_job_id UUID,
  p_claimer_id UUID,
  p_note TEXT,
  p_photo_url TEXT
) RETURNS job_claims AS $$
DECLARE
  v_claim job_claims;
BEGIN
  SELECT * INTO v_claim FROM job_claims
    WHERE job_id = p_job_id AND claimed_by = p_claimer_id AND released_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CLAIM_NOT_FOUND';
  END IF;

  UPDATE job_claims
    SET delivery_at = now(), delivery_note = p_note, delivery_photo_url = p_photo_url
    WHERE id = v_claim.id
    RETURNING * INTO v_claim;

  UPDATE jobs SET status = 'done' WHERE id = p_job_id;

  RETURN v_claim;
END;
$$ LANGUAGE plpgsql;
