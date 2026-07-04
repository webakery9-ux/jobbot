ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN DEFAULT false;

CREATE OR REPLACE FUNCTION post_job(
  p_poster_id UUID,
  p_group_id UUID,
  p_detail TEXT,
  p_wage NUMERIC,
  p_payment_method TEXT,
  p_is_urgent BOOLEAN DEFAULT false
) RETURNS jobs AS $$
DECLARE
  v_fee NUMERIC;
  v_job jobs;
BEGIN
  v_fee := CEIL(p_wage / 100.0);

  UPDATE users SET wallet_balance = wallet_balance - v_fee
    WHERE id = p_poster_id AND wallet_balance >= v_fee;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDIT';
  END IF;

  INSERT INTO jobs (group_id, poster_id, detail, wage, payment_method, platform_fee, status, is_urgent)
  VALUES (p_group_id, p_poster_id, p_detail, p_wage, p_payment_method, v_fee, 'open', p_is_urgent)
  RETURNING * INTO v_job;

  INSERT INTO transactions (user_id, type, amount, ref_job_id)
  VALUES (p_poster_id, 'job_post_fee', v_fee, v_job.id);

  RETURN v_job;
END;
$$ LANGUAGE plpgsql;
