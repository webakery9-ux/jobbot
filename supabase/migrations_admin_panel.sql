-- เก็บเหตุผลของการปรับเครดิตด้วยมือจากหน้าแอดมิน (add/remove credit ให้ user)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS note TEXT;

-- ปรับเครดิตให้ user จากหน้าแอดมิน แบบ atomic (หัก/เติมยอด + บันทึกธุรกรรมในทีเดียว กันกรณี insert log พลาดแล้วยอดเงี้ยนไม่ตรงกับ log)
CREATE OR REPLACE FUNCTION admin_adjust_credit(p_user_id UUID, p_amount NUMERIC, p_note TEXT) RETURNS users AS $$
DECLARE
  v_user users;
BEGIN
  UPDATE users SET wallet_balance = wallet_balance + p_amount
    WHERE id = p_user_id AND wallet_balance + p_amount >= 0
    RETURNING * INTO v_user;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND_OR_NEGATIVE_BALANCE';
  END IF;

  INSERT INTO transactions (user_id, type, amount, note)
  VALUES (p_user_id, 'admin_adjustment', p_amount, p_note);

  RETURN v_user;
END;
$$ LANGUAGE plpgsql;
