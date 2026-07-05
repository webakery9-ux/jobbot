-- แก้บั๊ก: return_job คืนค่า released_at เป็น NULL (ทำให้แสดงวันที่ผิดเป็น 1 ม.ค. 2513)
-- เพราะดึงข้อมูล v_claim ก่อน UPDATE แล้วไม่ได้อัปเดตค่ากลับมา
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

  UPDATE job_claims SET released_at = now() WHERE id = v_claim.id
    RETURNING * INTO v_claim;
  UPDATE jobs SET status = 'open' WHERE id = p_job_id;
  UPDATE users SET wallet_balance = wallet_balance + v_fee WHERE id = p_claimer_id;

  INSERT INTO transactions (user_id, type, amount, ref_job_id)
  VALUES (p_claimer_id, 'job_claim_refund', v_fee, p_job_id);

  RETURN v_claim;
END;
$$ LANGUAGE plpgsql;
