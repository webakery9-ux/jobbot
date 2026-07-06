-- ลบกลุ่มออกจากระบบ (ใช้เมื่อบอทถูกเชิญออกจากกลุ่มแล้ว หรือเป็นกลุ่มทดสอบที่ไม่ใช้แล้ว)
-- ถ้ามีงานผูกอยู่กับกลุ่มนี้ ต้องส่ง p_force = true ถึงจะลบงาน/แชท/ธุรกรรมที่เกี่ยวข้องทั้งหมดไปด้วย
CREATE OR REPLACE FUNCTION admin_delete_group(p_group_id UUID, p_force BOOLEAN DEFAULT false)
RETURNS INT AS $$
DECLARE
  v_job_count INT;
BEGIN
  SELECT COUNT(*) INTO v_job_count FROM jobs WHERE group_id = p_group_id;

  IF v_job_count > 0 AND NOT p_force THEN
    RAISE EXCEPTION 'HAS_DEPENDENT_JOBS:%', v_job_count;
  END IF;

  DELETE FROM chat_messages WHERE job_id IN (SELECT id FROM jobs WHERE group_id = p_group_id);
  DELETE FROM job_claims WHERE job_id IN (SELECT id FROM jobs WHERE group_id = p_group_id);
  DELETE FROM transactions WHERE ref_job_id IN (SELECT id FROM jobs WHERE group_id = p_group_id);
  DELETE FROM jobs WHERE group_id = p_group_id;
  DELETE FROM user_groups WHERE group_id = p_group_id;
  DELETE FROM groups WHERE id = p_group_id;

  RETURN v_job_count;
END;
$$ LANGUAGE plpgsql;
