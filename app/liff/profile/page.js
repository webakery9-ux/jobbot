"use client";

import { useEffect, useState } from "react";
import liff from "@line/liff";

export default function ProfilePage() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [lineUserId, setLineUserId] = useState("");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    vehicleType: "Sedan",
    vehicleModel: "",
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

    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineUserId, ...form }),
    });

    if (!res.ok) {
      setError("บันทึกไม่สำเร็จ กรุณาลองใหม่");
      return;
    }

    setSubmitted(true);
    setTimeout(() => liff.closeWindow(), 1500);
  }

  if (error) {
    return <main style={{ padding: 24, fontFamily: "sans-serif" }}>{error}</main>;
  }

  if (!ready) {
    return <main style={{ padding: 24, fontFamily: "sans-serif" }}>กำลังโหลด...</main>;
  }

  if (submitted) {
    return (
      <main style={{ padding: 24, fontFamily: "sans-serif" }}>
        บันทึกข้อมูลสำเร็จ ✅ กำลังปิดหน้าต่าง...
      </main>
    );
  }

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif", maxWidth: 480, margin: "0 auto" }}>
      <h2>กรอกข้อมูลส่วนตัว</h2>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label>
          ชื่อ
          <input
            required
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            style={{ width: "100%", padding: 8 }}
          />
        </label>
        <label>
          นามสกุล
          <input
            required
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            style={{ width: "100%", padding: 8 }}
          />
        </label>
        <label>
          เบอร์ติดต่อ
          <input
            required
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            style={{ width: "100%", padding: 8 }}
          />
        </label>
        <label>
          ประเภทรถ
          <select
            value={form.vehicleType}
            onChange={(e) => setForm({ ...form, vehicleType: e.target.value })}
            style={{ width: "100%", padding: 8 }}
          >
            <option value="Sedan">Sedan</option>
            <option value="SUV">SUV</option>
            <option value="VAN">VAN</option>
          </select>
        </label>
        <label>
          ยี่ห้อ/รุ่นรถ
          <input
            value={form.vehicleModel}
            onChange={(e) => setForm({ ...form, vehicleModel: e.target.value })}
            style={{ width: "100%", padding: 8 }}
          />
        </label>
        <button type="submit" style={{ padding: 12, marginTop: 8 }}>
          บันทึกข้อมูล
        </button>
      </form>
    </main>
  );
}
