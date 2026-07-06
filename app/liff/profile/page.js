"use client";

import { useEffect, useState } from "react";
import liff from "@line/liff";

const ACCENT = "#06C755";

export default function ProfilePage() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [lineUserId, setLineUserId] = useState("");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    vehicleType: "Sedan",
    vehicleModel: "",
    vehiclePlate: "",
  });

  useEffect(() => {
    async function init() {
      try {
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID });
        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }
        const profile = await liff.getProfile();
        setLineUserId(profile.userId);
        setReady(true);
      } catch (err) {
        setError("เปิดหน้านี้ผ่านแอป LINE เท่านั้นครับ");
      }
    }
    init();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineUserId, ...form }),
    });

    setSubmitting(false);

    if (!res.ok) {
      setError("บันทึกไม่สำเร็จ กรุณาลองใหม่");
      return;
    }

    setSubmitted(true);
    setTimeout(() => liff.closeWindow(), 1500);
  }

  if (error) {
    return (
      <div className="page center">
        <div className="icon-circle error">!</div>
        <p className="message">{error}</p>
        <style jsx>{styles}</style>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="page center">
        <div className="spinner" />
        <p className="message muted">กำลังโหลด...</p>
        <style jsx>{styles}</style>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="page center">
        <div className="icon-circle success">✓</div>
        <p className="message">บันทึกข้อมูลสำเร็จ</p>
        <p className="message muted small">กำลังปิดหน้าต่าง...</p>
        <style jsx>{styles}</style>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="header">
        <p className="header-title">กรอกข้อมูลส่วนตัว</p>
        <p className="header-subtitle">ใช้เพื่อติดต่อระหว่างคู่งาน กรอกครั้งเดียวจบ</p>
      </div>

      <form onSubmit={handleSubmit} className="card">
        <label className="field">
          <span className="field-label">ชื่อ</span>
          <input
            required
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
          />
        </label>

        <label className="field">
          <span className="field-label">นามสกุล</span>
          <input
            required
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
          />
        </label>

        <label className="field">
          <span className="field-label">เบอร์ติดต่อ</span>
          <input
            required
            type="tel"
            placeholder="08X-XXX-XXXX"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </label>

        <label className="field">
          <span className="field-label">ประเภทรถ</span>
          <select
            value={form.vehicleType}
            onChange={(e) => setForm({ ...form, vehicleType: e.target.value })}
          >
            <option value="Sedan">Sedan</option>
            <option value="SUV">SUV</option>
            <option value="VAN">VAN</option>
            <option value="EV-Sedan">EV-Sedan</option>
            <option value="EV-SUV">EV-SUV</option>
            <option value="EV-VAN">EV-VAN</option>
          </select>
        </label>

        <label className="field">
          <span className="field-label">ยี่ห้อ/รุ่นรถ</span>
          <input
            required
            placeholder="เช่น Toyota Vios"
            value={form.vehicleModel}
            onChange={(e) => setForm({ ...form, vehicleModel: e.target.value })}
          />
        </label>

        <label className="field">
          <span className="field-label">ทะเบียนรถ</span>
          <input
            required
            placeholder="เช่น กข 1234"
            value={form.vehiclePlate}
            onChange={(e) => setForm({ ...form, vehiclePlate: e.target.value })}
          />
        </label>

        <button type="submit" disabled={submitting}>
          {submitting ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
        </button>
      </form>

      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `
  .page {
    min-height: 100vh;
    background: #F5F6F7;
    font-family: -apple-system, "Segoe UI", Tahoma, Arial, sans-serif;
    padding-bottom: 2rem;
  }
  .center {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 24px;
    text-align: center;
  }
  .header {
    background: ${ACCENT};
    padding: 32px 24px 40px;
    color: #fff;
  }
  .header-title {
    font-size: 20px;
    font-weight: 700;
    margin: 0 0 6px;
  }
  .header-subtitle {
    font-size: 13px;
    margin: 0;
    opacity: 0.9;
  }
  .card {
    background: #fff;
    border-radius: 16px;
    margin: -24px 16px 0;
    padding: 20px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.06);
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .field-label {
    font-size: 13px;
    color: #666;
    font-weight: 600;
  }
  input, select {
    width: 100%;
    padding: 12px 14px;
    font-size: 15px;
    border: 1px solid #DDD;
    border-radius: 10px;
    background: #FAFAFA;
    box-sizing: border-box;
    outline: none;
  }
  input:focus, select:focus {
    border-color: ${ACCENT};
    background: #fff;
  }
  button {
    margin-top: 8px;
    padding: 14px;
    font-size: 16px;
    font-weight: 700;
    color: #fff;
    background: ${ACCENT};
    border: none;
    border-radius: 12px;
  }
  button:disabled {
    opacity: 0.6;
  }
  .icon-circle {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    font-weight: 700;
    color: #fff;
    margin-bottom: 16px;
  }
  .icon-circle.success {
    background: ${ACCENT};
  }
  .icon-circle.error {
    background: #E24B4A;
  }
  .message {
    font-size: 16px;
    color: #222;
    margin: 0;
  }
  .message.muted {
    color: #888;
  }
  .message.small {
    font-size: 13px;
    margin-top: 6px;
  }
  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #E5E5E5;
    border-top-color: ${ACCENT};
    border-radius: 50%;
    margin-bottom: 16px;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;
