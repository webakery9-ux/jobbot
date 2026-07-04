CREATE OR REPLACE FUNCTION claim_job(
  p_job_id UUID,
  p_claimer_id UUID
) RETURNS job_claims AS $$
DECLARE
  v_wage NUMERIC;
  v_fee NUMERIC;
  v_claim job_claims;
BEGIN
  SELECT wage INTO v_wage FROM jobs WHERE id = p_job_id AND status = 'open';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'JOB_NOT_AVAILABLE';
  END IF;

  v_fee := CEIL(v_wage / 100.0);

  -- unique index one_active_claim_per_job จะ error ทันทีถ้ามีคนรับไปแล้ว (กันชน)
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
