"use client";

import { useEffect, useState, useCallback } from "react";
import liff from "@line/liff";

const ACCENT = "#06C755";
const VEHICLE_OPTIONS = ["", "เก๋ง", "SUV", "VAN", "รถตู้"];

export default function DashboardApp() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [lineUserId, setLineUserId] = useState("");
  const [tab, setTab] = useState("home");

  useEffect(() => {
    async function init() {
      try {
        await liff.init({ liffId: process.env.NEXT_PUBLIC_MGMT_LIFF_ID });
        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }
        const profile = await liff.getProfile();
        setLineUserId(profile.userId);
        const params = new URLSearchParams(window.location.search);
        const t = params.get("tab");
        if (t) setTab(t);
        setReady(true);
      } catch (err) {
        setError("เปิดหน้านี้ผ่านแอป LINE เท่านั้นครับ");
      }
    }
    init();
  }, []);

  if (error) {
    return (
      <div className="wrap center">
        <p className="msg">{error}</p>
        <style jsx>{styles}</style>
      </div>
    );
  }
  if (!ready) {
    return (
      <div className="wrap center">
        <div className="spinner" />
        <style jsx>{styles}</style>
      </div>
    );
  }

  return (
    <div className="wrap">
      <div className="topbar">
        {tab !== "home" && (
          <button className="back" onClick={() => setTab("home")}>
            ‹ กลับ
          </button>
        )}
        <span className="topbar-title">{tabTitle(tab)}</span>
      </div>

      {tab === "home" && <Home setTab={setTab} lineUserId={lineUserId} />}
      {tab === "post" && <PostJob lineUserId={lineUserId} />}
      {tab === "jobs" && <OpenJobs lineUserId={lineUserId} />}
      {tab === "history" && <History lineUserId={lineUserId} />}
      {tab === "income" && <Income lineUserId={lineUserId} />}
      {tab === "credit" && <ComingSoon title="เติมเครดิต" />}

      <style jsx>{styles}</style>
    </div>
  );
}

function tabTitle(tab) {
  return (
    {
      home: "JobBotTH",
      post: "โพสต์งาน",
      jobs: "รับงาน",
      history: "ประวัติงาน",
      income: "สรุปรายได้",
      credit: "เติมเครดิต",
    }[tab] ?? "JobBotTH"
  );
}

function useDashboard(lineUserId, section) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    const res = await fetch(
      `/api/dashboard?lineUserId=${lineUserId}&section=${section}`
    );
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [lineUserId, section]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, loading, reload };
}

function Home({ setTab, lineUserId }) {
  const { data } = useDashboard(lineUserId, "home");
  const items = [
    { key: "post", label: "โพสต์งาน", icon: "＋" },
    { key: "jobs", label: "รับงาน", icon: "💼" },
    { key: "history", label: "ประวัติงาน", icon: "📋" },
    { key: "income", label: "สรุปรายได้", icon: "📊" },
    { key: "credit", label: "เติมเครดิต", icon: "👛" },
  ];
  return (
    <div className="section">
      <div className="balance-card">
        <span className="balance-label">เครดิตคงเหลือ</span>
        <span className="balance-value">{data ? data.balance : "-"}</span>
      </div>
      <div className="grid">
        {items.map((it) => (
          <button key={it.key} className="grid-item" onClick={() => setTab(it.key)}>
            <span className="grid-icon">{it.icon}</span>
            <span className="grid-label">{it.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function PostJob({ lineUserId }) {
  const { data, loading } = useDashboard(lineUserId, "post");
  const [form, setForm] = useState({
    groupId: "",
    detail: "",
    wage: "",
    paymentMethod: "โอนทันที",
    isUrgent: false,
    vehicleType: "",
  });
  const [status, setStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (data?.groups?.length && !form.groupId) {
      setForm((f) => ({ ...f, groupId: data.groups[0].id }));
    }
  }, [data]);

  if (loading) return <Loading />;
  if (data && !data.profileCompleted) return <NeedProfile />;
  if (data && (!data.groups || data.groups.length === 0)) {
    return (
      <div className="section">
        <p className="empty">
          ยังไม่พบกลุ่มที่คุณสังกัด ลองพิมพ์ /job ในกลุ่มที่มีบอทอย่างน้อย 1 ครั้งก่อนนะครับ
        </p>
      </div>
    );
  }

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    setStatus(null);
    const res = await fetch("/api/dashboard/post-job", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineUserId, ...form }),
    });
    setSubmitting(false);
    if (res.ok) {
      const d = await res.json();
      setStatus({ ok: true, text: `โพสต์งานสำเร็จ! เครดิตคงเหลือ ${d.balance}` });
      setForm((f) => ({ ...f, detail: "", wage: "", isUrgent: false, vehicleType: "" }));
    } else if (res.status === 402) {
      setStatus({ ok: false, text: "เครดิตไม่พอสำหรับเปิดงานนี้" });
    } else {
      setStatus({ ok: false, text: "โพสต์งานไม่สำเร็จ ลองใหม่อีกครั้ง" });
    }
  }

  return (
    <form className="section" onSubmit={submit}>
      <label className="field">
        <span className="field-label">เลือกกลุ่มที่จะส่งงาน</span>
        <select
          value={form.groupId}
          onChange={(e) => setForm({ ...form, groupId: e.target.value })}
        >
          {data.groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.group_name || "กลุ่ม LINE"}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field-label">รายละเอียดงาน</span>
        <input
          required
          value={form.detail}
          placeholder="เช่น แอร์สุ-สุขุมวิท"
          onChange={(e) => setForm({ ...form, detail: e.target.value })}
        />
      </label>
      <label className="field">
        <span className="field-label">ราคา (บาท)</span>
        <input
          required
          type="number"
          value={form.wage}
          placeholder="400"
          onChange={(e) => setForm({ ...form, wage: e.target.value })}
        />
      </label>
      <label className="field">
        <span className="field-label">วิธีจ่ายเงิน</span>
        <input
          required
          value={form.paymentMethod}
          onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
        />
      </label>
      <label className="field">
        <span className="field-label">ประเภทรถ (ถ้ามี)</span>
        <select
          value={form.vehicleType}
          onChange={(e) => setForm({ ...form, vehicleType: e.target.value })}
        >
          {VEHICLE_OPTIONS.map((v) => (
            <option key={v} value={v}>
              {v || "ไม่ระบุ"}
            </option>
          ))}
        </select>
      </label>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={form.isUrgent}
          onChange={(e) => setForm({ ...form, isUrgent: e.target.checked })}
        />
        <span>งานด่วน 🔥</span>
      </label>

      {status && (
        <p className={status.ok ? "status ok" : "status err"}>{status.text}</p>
      )}
      <button type="submit" disabled={submitting}>
        {submitting ? "กำลังโพสต์..." : "โพสต์งานเข้ากลุ่ม"}
      </button>
    </form>
  );
}

function OpenJobs({ lineUserId }) {
  const { data, loading, reload } = useDashboard(lineUserId, "jobs");
  const [claiming, setClaiming] = useState("");
  const [note, setNote] = useState("");

  if (loading) return <Loading />;
  if (data && !data.profileCompleted) return <NeedProfile />;

  async function claim(jobId) {
    setClaiming(jobId);
    setNote("");
    const res = await fetch("/api/dashboard/claim-job", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineUserId, jobId }),
    });
    setClaiming("");
    if (res.ok) {
      setNote("รับงานสำเร็จ! ดูรายละเอียดในแชท JobBotTH");
      reload();
    } else if (res.status === 409) {
      setNote("งานนี้ถูกรับไปแล้ว");
      reload();
    } else if (res.status === 402) {
      setNote("เครดิตของคุณไม่พอ");
    } else {
      setNote("รับงานไม่สำเร็จ ลองใหม่");
    }
  }

  const jobs = data?.jobs ?? [];
  return (
    <div className="section">
      {note && <p className="status ok">{note}</p>}
      {jobs.length === 0 && <p className="empty">ยังไม่มีงานเปิดอยู่ในกลุ่มของคุณ</p>}
      {jobs.map((job) => (
        <div key={job.id} className="job-card">
          {job.is_urgent && <span className="badge">ด่วน</span>}
          <p className="job-detail">{job.detail}</p>
          <p className="job-meta">
            ค่าจ้าง {job.wage} บาท · {job.payment_method}
            {job.requested_vehicle_type ? ` · ${job.requested_vehicle_type}` : ""}
          </p>
          <p className="job-sub">
            {job.group?.group_name || "กลุ่ม LINE"} · โดย {job.poster?.display_name || "-"}
          </p>
          <button
            className="claim-btn"
            disabled={claiming === job.id}
            onClick={() => claim(job.id)}
          >
            {claiming === job.id ? "กำลังรับงาน..." : "กดรับงาน"}
          </button>
        </div>
      ))}
    </div>
  );
}

function History({ lineUserId }) {
  const { data, loading } = useDashboard(lineUserId, "history");
  if (loading) return <Loading />;
  const posted = data?.posted ?? [];
  const claimed = data?.claimed ?? [];
  return (
    <div className="section">
      <p className="subhead">งานที่ฉันจ่าย ({posted.length})</p>
      {posted.length === 0 && <p className="empty small">ยังไม่มี</p>}
      {posted.map((j) => (
        <div key={j.id} className="hist-row">
          <p className="hist-detail">{j.detail}</p>
          <p className="hist-meta">
            {j.wage} บาท · {statusLabel(j.status)} · {j.group?.group_name || "-"}
          </p>
        </div>
      ))}
      <p className="subhead" style={{ marginTop: 20 }}>
        งานที่ฉันรับ ({claimed.length})
      </p>
      {claimed.length === 0 && <p className="empty small">ยังไม่มี</p>}
      {claimed.map((c) => (
        <div key={c.id} className="hist-row">
          <p className="hist-detail">{c.job?.detail || "-"}</p>
          <p className="hist-meta">
            {c.job?.wage} บาท · จาก {c.job?.poster?.display_name || "-"}
            {c.released_at ? " · คืนงานแล้ว" : ""}
          </p>
        </div>
      ))}
    </div>
  );
}

function Income({ lineUserId }) {
  const { data, loading } = useDashboard(lineUserId, "income");
  if (loading) return <Loading />;
  const inc = data?.income ?? { day: 0, week: 0, month: 0, year: 0, all: 0, count: 0 };
  const cards = [
    { label: "วันนี้", value: inc.day },
    { label: "สัปดาห์นี้", value: inc.week },
    { label: "เดือนนี้", value: inc.month },
    { label: "ปีนี้", value: inc.year },
  ];
  return (
    <div className="section">
      <div className="metric-grid">
        {cards.map((c) => (
          <div key={c.label} className="metric">
            <span className="metric-label">{c.label}</span>
            <span className="metric-value">{c.value.toLocaleString()}</span>
            <span className="metric-unit">บาท</span>
          </div>
        ))}
      </div>
      <div className="total-card">
        <span>รายได้รวมทั้งหมด</span>
        <strong>
          {inc.all.toLocaleString()} บาท ({inc.count} งาน)
        </strong>
      </div>
    </div>
  );
}

function ComingSoon({ title }) {
  return (
    <div className="section center-pad">
      <p className="empty">ฟีเจอร์ {title} กำลังพัฒนาอยู่ครับ 🙏</p>
    </div>
  );
}

function Loading() {
  return (
    <div className="section center-pad">
      <div className="spinner" />
    </div>
  );
}

function NeedProfile() {
  const url = process.env.NEXT_PUBLIC_LIFF_ID
    ? `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}`
    : "#";
  return (
    <div className="section center-pad">
      <p className="empty">กรุณากรอกข้อมูลส่วนตัวก่อนใช้งานครับ</p>
      <a className="link-btn" href={url}>
        กรอกข้อมูลส่วนตัว
      </a>
    </div>
  );
}

function statusLabel(s) {
  return (
    { open: "เปิดอยู่", claimed: "มีคนรับแล้ว", done: "เสร็จแล้ว", expired: "หมดอายุ" }[
      s
    ] ?? s
  );
}

const styles = `
  .wrap { min-height: 100vh; background: #F5F6F7; font-family: -apple-system, "Segoe UI", Tahoma, Arial, sans-serif; }
  .center { display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  .center-pad { display: flex; flex-direction: column; align-items: center; padding-top: 48px; gap: 16px; }
  .topbar { background: ${ACCENT}; color: #fff; padding: 14px 16px; display: flex; align-items: center; gap: 10px; position: sticky; top: 0; z-index: 10; }
  .topbar-title { font-size: 17px; font-weight: 700; }
  .back { background: rgba(255,255,255,0.2); color: #fff; border: none; border-radius: 8px; padding: 6px 12px; font-size: 14px; }
  .section { padding: 16px; display: flex; flex-direction: column; gap: 14px; }
  .balance-card { background: ${ACCENT}; color: #fff; border-radius: 16px; padding: 20px; display: flex; flex-direction: column; gap: 4px; }
  .balance-label { font-size: 13px; opacity: 0.9; }
  .balance-value { font-size: 34px; font-weight: 700; }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .grid-item { background: #fff; border: none; border-radius: 14px; padding: 22px 12px; display: flex; flex-direction: column; align-items: center; gap: 8px; box-shadow: 0 1px 6px rgba(0,0,0,0.05); }
  .grid-icon { font-size: 30px; }
  .grid-label { font-size: 15px; font-weight: 600; color: #333; }
  .field { display: flex; flex-direction: column; gap: 6px; }
  .field-label { font-size: 13px; color: #666; font-weight: 600; }
  input, select { width: 100%; padding: 12px 14px; font-size: 15px; border: 1px solid #DDD; border-radius: 10px; background: #fff; box-sizing: border-box; outline: none; }
  input:focus, select:focus { border-color: ${ACCENT}; }
  .checkbox { display: flex; align-items: center; gap: 8px; font-size: 15px; }
  .checkbox input { width: auto; }
  button[type="submit"], .claim-btn { padding: 14px; font-size: 16px; font-weight: 700; color: #fff; background: ${ACCENT}; border: none; border-radius: 12px; }
  button:disabled { opacity: 0.6; }
  .status { font-size: 14px; padding: 10px 12px; border-radius: 8px; margin: 0; }
  .status.ok { background: #E1F5EE; color: #0F6E56; }
  .status.err { background: #FCEBEB; color: #A32D2D; }
  .job-card { background: #fff; border-radius: 14px; padding: 16px; position: relative; box-shadow: 0 1px 6px rgba(0,0,0,0.05); }
  .badge { position: absolute; top: 14px; right: 14px; background: #E24B4A; color: #fff; font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 20px; }
  .job-detail { font-size: 17px; font-weight: 700; margin: 0 0 6px; color: #222; }
  .job-meta { font-size: 14px; color: #444; margin: 0 0 4px; }
  .job-sub { font-size: 13px; color: #888; margin: 0 0 12px; }
  .claim-btn { width: 100%; }
  .subhead { font-size: 15px; font-weight: 700; color: #333; margin: 0; }
  .hist-row { background: #fff; border-radius: 10px; padding: 12px 14px; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
  .hist-detail { font-size: 15px; font-weight: 600; margin: 0 0 4px; color: #222; }
  .hist-meta { font-size: 13px; color: #777; margin: 0; }
  .metric-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .metric { background: #fff; border-radius: 14px; padding: 18px; display: flex; flex-direction: column; gap: 2px; box-shadow: 0 1px 6px rgba(0,0,0,0.05); }
  .metric-label { font-size: 13px; color: #888; }
  .metric-value { font-size: 26px; font-weight: 700; color: ${ACCENT}; }
  .metric-unit { font-size: 12px; color: #aaa; }
  .total-card { background: #fff; border-radius: 14px; padding: 18px; display: flex; flex-direction: column; gap: 6px; box-shadow: 0 1px 6px rgba(0,0,0,0.05); font-size: 15px; color: #555; }
  .total-card strong { font-size: 20px; color: #222; }
  .empty { text-align: center; color: #999; font-size: 15px; padding: 12px; }
  .empty.small { padding: 4px; font-size: 14px; }
  .link-btn { background: ${ACCENT}; color: #fff; text-decoration: none; padding: 12px 20px; border-radius: 10px; font-weight: 700; }
  .msg { font-size: 16px; color: #444; }
  .spinner { width: 32px; height: 32px; border: 3px solid #E5E5E5; border-top-color: ${ACCENT}; border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;
