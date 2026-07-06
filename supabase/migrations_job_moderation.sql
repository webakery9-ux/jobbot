-- ลบงานที่ไม่เหมาะสม (สแปม) จากหน้าแอดมิน อนุญาตเฉพาะงานที่ยังไม่มีคนรับ (status = 'open')
-- คืนค่าธรรมเนียมให้ผู้เปิดงานถ้าเคยถูกหักไป (กรณีกลุ่มนั้นใช้ระบบเครดิต)
CREATE OR REPLACE FUNCTION admin_remove_job(p_job_id UUID) RETURNS jobs AS $$
DECLARE
  v_job jobs;
BEGIN
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'JOB_NOT_FOUND';
  END IF;
  IF v_job.status != 'open' THEN
    RAISE EXCEPTION 'JOB_NOT_REMOVABLE';
  END IF;

  UPDATE jobs SET status = 'removed' WHERE id = p_job_id;

  IF v_job.platform_fee > 0 THEN
    UPDATE users SET wallet_balance = wallet_balance + v_job.platform_fee WHERE id = v_job.poster_id;
    INSERT INTO transactions (user_id, type, amount, ref_job_id)
    VALUES (v_job.poster_id, 'admin_job_removed_refund', v_job.platform_fee, p_job_id);
  END IF;

  SELECT * INTO v_job FROM jobs WHERE id = p_job_id;
  RETURN v_job;
END;
$$ LANGUAGE plpgsql;
