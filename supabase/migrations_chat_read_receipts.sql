-- เก็บว่าแต่ละคนอ่านแชทของงานไหนล่าสุดเมื่อไหร่ ใช้คำนวณว่ามีข้อความยังไม่อ่านไหม (โชว์เป็นจุดแดงที่การ์ดงาน)
CREATE TABLE IF NOT EXISTS chat_reads (
  job_id UUID NOT NULL REFERENCES jobs(id),
  user_id UUID NOT NULL REFERENCES users(id),
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (job_id, user_id)
);
