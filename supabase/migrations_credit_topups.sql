-- คำขอเติมเครดิต (แนบสลิปโอนเงิน รอตรวจสอบก่อนเติมเข้ากระเป๋าจริง)
CREATE TABLE IF NOT EXISTS credit_topups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  package_thb NUMERIC NOT NULL,
  package_credits NUMERIC NOT NULL,
  slip_photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | verified | rejected
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_topups_user ON credit_topups(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_topups_status ON credit_topups(status) WHERE status = 'pending';

-- อนุมัติคำขอเติมเครดิต: เติมเครดิตเข้ากระเป๋า + บันทึกธุรกรรม + ปิดสถานะคำขอ (ใช้ทั้งจาก Slip2Go อัตโนมัติ และแอดมินตรวจเอง)
CREATE OR REPLACE FUNCTION approve_credit_topup(p_topup_id UUID) RETURNS credit_topups AS $$
DECLARE
  v_topup credit_topups;
BEGIN
  SELECT * INTO v_topup FROM credit_topups WHERE id = p_topup_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOPUP_NOT_FOUND_OR_ALREADY_PROCESSED';
  END IF;

  UPDATE users SET wallet_balance = wallet_balance + v_topup.package_credits WHERE id = v_topup.user_id;

  INSERT INTO transactions (user_id, type, amount)
  VALUES (v_topup.user_id, 'credit_topup', v_topup.package_credits);

  UPDATE credit_topups SET status = 'verified', verified_at = now()
    WHERE id = p_topup_id
    RETURNING * INTO v_topup;

  RETURN v_topup;
END;
$$ LANGUAGE plpgsql;
