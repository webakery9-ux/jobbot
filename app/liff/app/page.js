"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import liff from "@line/liff";

const ACCENT = "#06C755";
const VEHICLE_OPTIONS = ["", "เก๋ง", "SUV", "VAN"];

export default function DashboardApp() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [lineUserId, setLineUserId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [tab, setTab] = useState("home");
  const [jobParam, setJobParam] = useState("");
  const [tabStack, setTabStack] = useState([]);

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
        setDisplayName(profile.displayName || "");
        const params = new URLSearchParams(window.location.search);
        const t = params.get("tab");
        if (t) setTab(t);
        setJobParam(params.get("job") || "");
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

  // ไปหน้าใหม่ พร้อมจำหน้าเดิมไว้ใน stack เพื่อให้ปุ่ม "กลับ" ย้อนถูกที่
  function navigate(nextTab, jobId) {
    setTabStack((s) => [...s, tab]);
    setJobParam(jobId || "");
    setTab(nextTab);
  }

  function goBack() {
    setTabStack((s) => {
      if (s.length === 0) {
        setTab("home");
        return s;
      }
      const copy = [...s];
      const prevTab = copy.pop();
      setTab(prevTab);
      return copy;
    });
  }

  return (
    <div className="wrap">
      <div className="topbar">
        {tab !== "home" && (
          <button className="back" onClick={goBack}>
            ‹ กลับ
          </button>
        )}
        <span className="topbar-title">{tabTitle(tab)}</span>
      </div>

      {tab === "home" && <Home setTab={navigate} lineUserId={lineUserId} />}
      {tab === "post" && <PostJob lineUserId={lineUserId} setTab={navigate} />}
      {tab === "jobs" && <OpenJobs lineUserId={lineUserId} setTab={navigate} />}
      {tab === "claim" && (
        <Claim lineUserId={lineUserId} displayName={displayName} jobId={jobParam} />
      )}
      {tab === "complete" && <CompleteJob lineUserId={lineUserId} jobId={jobParam} />}
      {tab === "return" && <ReturnJob lineUserId={lineUserId} jobId={jobParam} />}
      {tab === "job-detail" && <JobDetail jobId={jobParam} />}
      {tab === "history" && <History lineUserId={lineUserId} goTo={navigate} />}
      {tab === "income" && <Income lineUserId={lineUserId} />}
      {tab === "profile" && (
        <Profile lineUserId={lineUserId} displayName={displayName} setTab={navigate} />
      )}
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
      claim: "รับงาน",
      complete: "จบงาน",
      return: "คืนงาน",
      "job-detail": "รายละเอียดปิดงาน",
      history: "ประวัติงาน",
      income: "สรุปรายได้",
      profile: "ข้อมูลส่วนตัว",
      credit: "เติมเครดิต",
    }[tab] ?? "JobBotTH"
  );
}

// เก็บผลลัพธ์ล่าสุดของแต่ละแท็บไว้ในหน่วยความจำ (อยู่ได้ตลอดที่หน้า LIFF ยังเปิดอยู่)
// พอกลับมาแท็บเดิมจะโชว์ข้อมูลเก่าทันที ไม่กระพริบจอโหลด แล้วค่อยรีเฟรชเงียบๆ เบื้องหลัง
const dashboardCache = new Map();

function useDashboard(lineUserId, section) {
  const cacheKey = `${lineUserId}:${section}`;
  const [data, setData] = useState(() => dashboardCache.get(cacheKey) ?? null);
  const [loading, setLoading] = useState(!dashboardCache.has(cacheKey));

  const reload = useCallback(async () => {
    if (!dashboardCache.has(cacheKey)) setLoading(true);
    const res = await fetch(
      `/api/dashboard?lineUserId=${lineUserId}&section=${section}`
    );
    if (res.ok) {
      const json = await res.json();
      dashboardCache.set(cacheKey, json);
      setData(json);
    }
    setLoading(false);
  }, [lineUserId, section, cacheKey]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, reload };
}

const LOW_CREDIT_THRESHOLD = 20;

function formatThaiDateTimeClient(dateInput) {
  const d = new Date(dateInput);
  const dateStr = d.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });
  const timeStr = d.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  });
  return `${dateStr} ${timeStr} น.`;
}

function Home({ setTab, lineUserId }) {
  const { data } = useDashboard(lineUserId, "home");
  const items = [
    { key: "post", label: "โพสต์งาน", icon: "＋" },
    { key: "jobs", label: "รับงาน", icon: "💼" },
    { key: "history", label: "ประวัติงาน", icon: "📋" },
    { key: "income", label: "สรุปรายได้", icon: "📊" },
    { key: "credit", label: "เติมเครดิต", icon: "👛" },
    { key: "profile", label: "ข้อมูลส่วนตัว", icon: "👤" },
  ];
  const isLow = data && data.balance <= LOW_CREDIT_THRESHOLD;
  return (
    <div className="section">
      <div className={`balance-card ${isLow ? "low" : ""}`}>
        <div className="balance-top">
          <span className="balance-label">เครดิตคงเหลือ</span>
          {isLow && <span className="balance-alert">⚠️</span>}
        </div>
        <span className="balance-value">{data ? data.balance : "-"}</span>
        {data && !isLow && <span className="balance-ok">✓ เพียงพอสำหรับใช้งาน</span>}
        {isLow && (
          <button className="balance-warning" onClick={() => setTab("credit")}>
            เครดิตใกล้หมด แตะเพื่อเติมเครดิต
          </button>
        )}
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
  if (data && !data.profileCompleted) return <NeedProfile setTab={setTab} />;
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

function OpenJobs({ lineUserId, setTab }) {
  const { data, loading, reload } = useDashboard(lineUserId, "jobs");
  const [claiming, setClaiming] = useState("");
  const [note, setNote] = useState("");
  const [activeGroup, setActiveGroup] = useState("all");
  // ซ่อนงานออกจากลิสต์ทันทีตอนกด (optimistic) ไม่ต้องรอ server ตอบก่อนถึงจะรู้สึกไว
  const [hiddenIds, setHiddenIds] = useState(() => new Set());

  if (loading) return <Loading />;
  if (data && !data.profileCompleted) return <NeedProfile setTab={setTab} />;

  function unhide(jobId) {
    setHiddenIds((s) => {
      const next = new Set(s);
      next.delete(jobId);
      return next;
    });
  }

  async function claim(jobId) {
    setHiddenIds((s) => new Set(s).add(jobId));
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
      const d = await res.json().catch(() => ({}));
      if (d.error === "has active job") {
        // งานนี้ยังว่างอยู่ แค่เรารับเองไม่ได้ เอากลับเข้าลิสต์
        unhide(jobId);
        setNote("คุณมีงานที่ยังไม่เสร็จอยู่ ต้องจบหรือคืนงานเดิมก่อนถึงจะรับงานใหม่ได้");
      } else {
        setNote("งานนี้ถูกรับไปแล้ว");
        reload();
      }
    } else if (res.status === 402) {
      unhide(jobId);
      setNote("เครดิตของคุณไม่พอ");
    } else {
      unhide(jobId);
      setNote("รับงานไม่สำเร็จ ลองใหม่");
    }
  }

  const allJobs = data?.jobs ?? [];

  const groups = [];
  const seen = new Set();
  for (const job of allJobs) {
    const gid = job.group?.id;
    if (gid && !seen.has(gid)) {
      seen.add(gid);
      groups.push({ id: gid, name: job.group?.group_name || "กลุ่ม LINE" });
    }
  }

  const jobs = (activeGroup === "all"
    ? allJobs
    : allJobs.filter((j) => j.group?.id === activeGroup)
  ).filter((j) => !hiddenIds.has(j.id));

  return (
    <div className="section">
      {groups.length > 1 && (
        <div className="tabs">
          <button
            className={`tab ${activeGroup === "all" ? "active" : ""}`}
            onClick={() => setActiveGroup("all")}
          >
            ทั้งหมด
          </button>
          {groups.map((g) => (
            <button
              key={g.id}
              className={`tab ${activeGroup === g.id ? "active" : ""}`}
              onClick={() => setActiveGroup(g.id)}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}
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

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function filterByDateRange(items, getDate, range, customFrom, customTo) {
  if (range === "all") return items;
  const today = startOfDay(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  return items.filter((item) => {
    const t = new Date(getDate(item));
    if (range === "today") return startOfDay(t).getTime() === today.getTime();
    if (range === "yesterday") return startOfDay(t).getTime() === yesterday.getTime();
    if (range === "older") return startOfDay(t).getTime() < yesterday.getTime();
    if (range === "custom") {
      if (customFrom && t < new Date(customFrom + "T00:00:00")) return false;
      if (customTo && t > new Date(customTo + "T23:59:59")) return false;
      return true;
    }
    return true;
  });
}

function History({ lineUserId, goTo }) {
  const { data, loading } = useDashboard(lineUserId, "history");
  const [role, setRole] = useState("posted");
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  if (loading) return <Loading />;
  const posted = data?.posted ?? [];
  const claimed = data?.claimed ?? [];
  const claimedActive = claimed.filter((c) => !c.released_at);
  const returned = claimed.filter((c) => c.released_at);

  const q = search.trim().toLowerCase();
  const postedFiltered = filterByDateRange(
    q ? posted.filter((j) => j.detail?.toLowerCase().includes(q)) : posted,
    (j) => j.created_at,
    dateRange,
    customFrom,
    customTo
  );
  const claimedFiltered = filterByDateRange(
    q ? claimedActive.filter((c) => c.job?.detail?.toLowerCase().includes(q)) : claimedActive,
    (c) => c.claimed_at,
    dateRange,
    customFrom,
    customTo
  );
  const returnedFiltered = filterByDateRange(
    q ? returned.filter((c) => c.job?.detail?.toLowerCase().includes(q)) : returned,
    (c) => c.released_at,
    dateRange,
    customFrom,
    customTo
  );

  const roleTabs = [
    { key: "posted", label: `จ่ายงาน (${postedFiltered.length})` },
    { key: "claimed", label: `รับงาน (${claimedFiltered.length})` },
    { key: "returned", label: `คืนงาน (${returnedFiltered.length})` },
  ];

  const dateTabs = [
    { key: "all", label: "ทั้งหมด" },
    { key: "today", label: "วันนี้" },
    { key: "yesterday", label: "เมื่อวาน" },
    { key: "older", label: "วันก่อน" },
    { key: "custom", label: "📅 กำหนดเอง" },
  ];

  return (
    <div className="section">
      <div className="tabs">
        {roleTabs.map((t) => (
          <button
            key={t.key}
            className={`tab ${role === t.key ? "active" : ""}`}
            onClick={() => setRole(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <input
        className="hist-search"
        type="text"
        placeholder="🔍 ค้นหางาน..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="tabs">
        {dateTabs.map((t) => (
          <button
            key={t.key}
            className={`tab ${dateRange === t.key ? "active" : ""}`}
            onClick={() => setDateRange(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {dateRange === "custom" && (
        <div className="date-range-picker">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
          />
          <span>ถึง</span>
          <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
        </div>
      )}

      {role === "posted" && (
        <>
          {postedFiltered.length === 0 && <p className="empty small">ยังไม่มี</p>}
          {postedFiltered.map((j) => (
            <div key={j.id} className="hist-row">
              <p className="hist-detail">{j.detail}</p>
              <p className="hist-meta">
                {j.wage} บาท · {j.payment_method} · {statusLabel(j.status)} ·{" "}
                {j.group?.group_name || "-"}
              </p>
              <p className="hist-date">{formatThaiDateTimeClient(j.created_at)}</p>
              {j.status === "done" && (
                <button className="hist-btn" onClick={() => goTo("job-detail", j.id)}>
                  📋 ดูรายละเอียดการปิดงาน
                </button>
              )}
            </div>
          ))}
        </>
      )}

      {role === "claimed" && (
        <>
          {claimedFiltered.length === 0 && <p className="empty small">ยังไม่มี</p>}
          {claimedFiltered.map((c) => {
            const isActive = !c.released_at && c.job?.status === "claimed";
            return (
              <div key={c.id} className="hist-row">
                <p className="hist-detail">{c.job?.detail || "-"}</p>
                <p className="hist-meta">
                  {c.job?.wage} บาท · {c.job?.payment_method} · จาก{" "}
                  {c.job?.poster?.display_name || "-"}
                  {c.job?.status === "done" ? " · จบงานแล้ว" : ""}
                </p>
                <p className="hist-date">{formatThaiDateTimeClient(c.claimed_at)}</p>
                {isActive && (
                  <div className="hist-actions">
                    <button className="hist-btn primary" onClick={() => goTo("complete", c.job.id)}>
                      ✅ จบงาน
                    </button>
                    <button className="hist-btn" onClick={() => goTo("return", c.job.id)}>
                      ↩️ คืนงาน
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {role === "returned" && (
        <>
          {returnedFiltered.length === 0 && <p className="empty small">ยังไม่มี</p>}
          {returnedFiltered.map((c) => (
            <div key={c.id} className="hist-row">
              <p className="hist-detail">{c.job?.detail || "-"}</p>
              <p className="hist-meta">
                {c.job?.wage} บาท · {c.job?.payment_method} · จาก{" "}
                {c.job?.poster?.display_name || "-"} · คืนงานแล้ว
              </p>
              <p className="hist-date">{formatThaiDateTimeClient(c.released_at)}</p>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function Income({ lineUserId }) {
  const { data, loading } = useDashboard(lineUserId, "income");
  const [period, setPeriod] = useState(null);
  if (loading) return <Loading />;
  const inc = data?.income ?? { day: 0, week: 0, month: 0, year: 0, all: 0, count: 0, items: [] };
  const items = inc.items ?? [];
  const cards = [
    { key: "day", label: "วันนี้", value: inc.day },
    { key: "week", label: "สัปดาห์นี้", value: inc.week },
    { key: "month", label: "เดือนนี้", value: inc.month },
    { key: "year", label: "ปีนี้", value: inc.year },
  ];

  const shownItems =
    period === "all" ? items : period ? items.filter((it) => it[period]) : [];
  const periodLabel =
    period === "all"
      ? "รายได้รวมทั้งหมด"
      : cards.find((c) => c.key === period)?.label;

  return (
    <div className="section">
      <div className="metric-grid">
        {cards.map((c) => (
          <button
            key={c.key}
            className={`metric ${period === c.key ? "active" : ""}`}
            onClick={() => setPeriod(period === c.key ? null : c.key)}
          >
            <span className="metric-label">{c.label}</span>
            <span className="metric-value">{c.value.toLocaleString()}</span>
            <span className="metric-unit">บาท</span>
          </button>
        ))}
      </div>
      <button
        className={`total-card ${period === "all" ? "active" : ""}`}
        onClick={() => setPeriod(period === "all" ? null : "all")}
      >
        <span>รายได้รวมทั้งหมด</span>
        <strong>
          {inc.all.toLocaleString()} บาท ({inc.count} งาน)
        </strong>
      </button>

      {period && (
        <>
          <p className="subhead" style={{ marginTop: 20 }}>
            รายการงาน{periodLabel} ({shownItems.length})
          </p>
          {shownItems.length === 0 && <p className="empty small">ยังไม่มี</p>}
          {shownItems.map((it) => (
            <div key={it.id} className="hist-row">
              <p className="hist-detail">{it.detail}</p>
              <p className="hist-meta">
                {it.wage} บาท · {it.paymentMethod} · {it.groupName || "-"}
              </p>
              <p className="hist-date">{formatThaiDateTimeClient(it.claimedAt)}</p>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function Profile({ lineUserId, displayName, setTab, onSaved }) {
  const { data, loading } = useDashboard(lineUserId, "profile");
  const [form, setForm] = useState(null);
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);

  useEffect(() => {
    if (data?.profile) {
      setForm(data.profile);
      if (data.profileCompleted) setSaved(data.profile);
    }
  }, [data]);

  if (loading || !form) return <Loading />;

  async function save(e) {
    e.preventDefault();
    if (!/^[0-9]{10}$/.test(form.phone)) {
      setStatus({ ok: false, text: "กรุณากรอกเบอร์ติดต่อเป็นตัวเลข 10 หลัก" });
      return;
    }
    setSaving(true);
    setStatus(null);
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineUserId, displayName, ...form }),
    });
    setSaving(false);
    if (res.ok) {
      setStatus({ ok: true, text: "บันทึกข้อมูลสำเร็จ" });
      setSaved({ ...form });
      if (onSaved) onSaved();
    } else {
      setStatus({ ok: false, text: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" });
    }
  }

  return (
    <form className="section" onSubmit={save}>
      {saved ? (
        <div className="profile-summary">
          <p className="summary-head">ข้อมูลปัจจุบันของคุณ</p>
          <div className="summary-row">
            <span>ชื่อ-นามสกุล</span>
            <strong>{saved.firstName} {saved.lastName}</strong>
          </div>
          <div className="summary-row">
            <span>เบอร์ติดต่อ</span>
            <strong>{saved.phone}</strong>
          </div>
          <div className="summary-row">
            <span>ประเภทรถ</span>
            <strong>{saved.vehicleType}{saved.vehicleModel ? ` · ${saved.vehicleModel}` : ""}</strong>
          </div>
        </div>
      ) : (
        <div className="status err">
          ⚠️ ยังไม่มีข้อมูลส่วนตัว จำเป็นต้องกรอกข้อมูลก่อนรับงานและจ่ายงานครับ
        </div>
      )}
      <p className="subhead">{saved ? "แก้ไขข้อมูล" : "กรอกข้อมูล"}</p>
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
          inputMode="numeric"
          pattern="[0-9]{10}"
          maxLength={10}
          placeholder="0812345678"
          value={form.phone}
          onChange={(e) =>
            setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })
          }
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
        </select>
      </label>
      <label className="field">
        <span className="field-label">ยี่ห้อ/รุ่นรถ (ถ้ามี)</span>
        <input
          placeholder="เช่น Toyota Vios"
          value={form.vehicleModel}
          onChange={(e) => setForm({ ...form, vehicleModel: e.target.value })}
        />
      </label>
      {status && (
        <p className={status.ok ? "status ok" : "status err"}>{status.text}</p>
      )}
      <button type="submit" disabled={saving}>
        {saving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
      </button>
    </form>
  );
}

function Claim({ lineUserId, displayName, jobId }) {
  // phase: init | friend | profile | claiming | done
  const [phase, setPhase] = useState("init");
  const [addFriendUrl, setAddFriendUrl] = useState("#");
  const [result, setResult] = useState(null);

  const doClaim = useCallback(async () => {
    setPhase("claiming");
    const res = await fetch("/api/dashboard/claim-job", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineUserId, jobId, displayName }),
    });
    if (res.ok) {
      const d = await res.json();
      setResult({
        type: "success",
        text: `รับงานสำเร็จ! ระบบส่งข้อมูลติดต่อให้ในแชท JobBotTH แล้ว\nเครดิตคงเหลือ ${d.balance}`,
      });
      setPhase("done");
    } else if (res.status === 403) {
      // ยังไม่กรอกข้อมูล - เด้งหน้ากรอกในตัว กรอกเสร็จรับงานต่อทันที
      setPhase("profile");
    } else if (res.status === 409) {
      const d = await res.json().catch(() => ({}));
      setResult({
        type: "taken",
        text:
          d.error === "has active job"
            ? "คุณมีงานที่ยังไม่เสร็จอยู่\nต้องจบหรือคืนงานเดิมก่อนถึงจะรับงานใหม่ได้ครับ"
            : "งานนี้ถูกท่านอื่นรับไปแล้วครับ",
      });
      setPhase("done");
    } else if (res.status === 402) {
      setResult({ type: "credit", text: "เครดิตของคุณไม่พอสำหรับรับงานนี้" });
      setPhase("done");
    } else {
      setResult({ type: "error", text: "เกิดข้อผิดพลาด กรุณาลองใหม่" });
      setPhase("done");
    }
  }, [lineUserId, jobId, displayName]);

  // เผื่อไว้ใช้โชว์ปุ่มเพิ่มเพื่อนบนหน้าสำเร็จ (ไม่บล็อกการรับงาน ยิงคู่ขนานไปเลย)
  useEffect(() => {
    if (!lineUserId) return;
    fetch("/api/dashboard/ensure-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineUserId, displayName }),
    })
      .then((r) => r.json())
      .then((info) => setAddFriendUrl(info.addFriendUrl || "#"))
      .catch(() => {});
  }, [lineUserId, displayName]);

  useEffect(() => {
    if (jobId && lineUserId) doClaim();
  }, [jobId, lineUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  function close() {
    try {
      liff.closeWindow();
    } catch (e) {}
  }

  if (!jobId) {
    return (
      <div className="section center-pad">
        <p className="empty">ไม่พบงานที่ต้องการรับ</p>
      </div>
    );
  }

  if (phase === "init" || phase === "claiming") {
    return (
      <div className="section center-pad">
        <div className="spinner" />
        <p className="empty">{phase === "claiming" ? "กำลังรับงาน..." : "กำลังตรวจสอบ..."}</p>
      </div>
    );
  }

  if (phase === "profile") {
    return (
      <div>
        <p className="claim-note">กรอกข้อมูลเพื่อรับงานต่อได้เลยครับ</p>
        <Profile lineUserId={lineUserId} displayName={displayName} onSaved={doClaim} />
      </div>
    );
  }

  // phase === "done"
  return (
    <div className="section center-pad">
      <div className={`icon-big ${result.type === "success" ? "ok" : "warn"}`}>
        {result.type === "success" ? "✓" : "!"}
      </div>
      <p className="result-text">{result.text}</p>
      {result.type === "success" && addFriendUrl !== "#" && (
        <a className="ghost-btn" href={addFriendUrl}>
          เพิ่มเพื่อน JobBotTH (รับการแจ้งเตือนในอนาคต)
        </a>
      )}
      <button className="link-btn" onClick={close}>
        ปิดหน้านี้
      </button>
    </div>
  );
}

// ย่อรูปก่อนอัปโหลด กันไฟล์ใหญ่เกิน (กล้องมือถือหลาย MB)
function resizeImageFile(file, maxWidth = 1024, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function CompleteJob({ lineUserId, jobId }) {
  const [phase, setPhase] = useState("form");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  async function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageFile(file);
      setPhoto(dataUrl);
    } catch (err) {
      setError("อ่านรูปไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
  }

  function removePhoto() {
    setPhoto(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function submit() {
    setPhase("submitting");
    const res = await fetch("/api/dashboard/complete-job", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineUserId, jobId, note, photoBase64: photo }),
    });
    if (res.ok) {
      setPhase("done");
    } else {
      setError("ปิดงานไม่สำเร็จ ลองใหม่อีกครั้ง");
      setPhase("confirm");
    }
  }

  function close() {
    try {
      liff.closeWindow();
    } catch (e) {}
  }

  if (phase === "form") {
    return (
      <div className="section">
        <label className="field">
          <span className="field-label">ส่งลูกค้าเรียบร้อย (หมายเหตุ)</span>
          <textarea
            rows={3}
            placeholder="เช่น ส่งของถึงมือลูกค้าแล้ว"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">ถ่ายรูปยืนยัน (ถ้ามี)</span>
          {!photo ? (
            <button
              type="button"
              className="photo-upload"
              onClick={() => fileInputRef.current?.click()}
            >
              <span className="photo-upload-icon">📷</span>
              <span>แตะเพื่อถ่ายรูปหรือเลือกรูป</span>
            </button>
          ) : (
            <div className="photo-preview-wrap">
              <img src={photo} alt="preview" className="photo-preview" />
              <button type="button" className="photo-remove" onClick={removePhoto}>
                ✕ ลบรูป
              </button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhoto}
            style={{ display: "none" }}
          />
        </label>
        {error && <p className="status err">{error}</p>}
        <button className="claim-btn" onClick={() => setPhase("confirm")}>
          ต่อไป
        </button>
      </div>
    );
  }

  if (phase === "confirm") {
    return (
      <div className="section center-pad">
        <p className="claim-note">ยืนยันปิดงานนี้ใช่ไหมครับ?</p>
        {note && <p className="empty small">หมายเหตุ: {note}</p>}
        {photo && <img src={photo} alt="preview" className="photo-preview" />}
        {error && <p className="status err">{error}</p>}
        <button className="claim-btn" onClick={submit}>
          ยืนยันปิดงาน
        </button>
        <button className="ghost-btn" onClick={() => setPhase("form")}>
          แก้ไข
        </button>
      </div>
    );
  }

  if (phase === "submitting") {
    return (
      <div className="section center-pad">
        <div className="spinner" />
        <p className="empty">กำลังปิดงาน...</p>
      </div>
    );
  }

  return (
    <div className="section center-pad">
      <div className="icon-big ok">✓</div>
      <p className="result-text">ปิดงานสำเร็จ! แจ้งผู้เปิดงานเรียบร้อยแล้ว</p>
      <button className="link-btn" onClick={close}>
        ปิดหน้านี้
      </button>
    </div>
  );
}

function ReturnJob({ lineUserId, jobId }) {
  const [phase, setPhase] = useState("confirm");
  const [error, setError] = useState("");

  async function submit() {
    setPhase("submitting");
    const res = await fetch("/api/dashboard/return-job", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineUserId, jobId }),
    });
    if (res.ok) {
      setPhase("done");
    } else {
      setError("คืนงานไม่สำเร็จ ลองใหม่อีกครั้ง");
      setPhase("confirm");
    }
  }

  function close() {
    try {
      liff.closeWindow();
    } catch (e) {}
  }

  if (phase === "confirm") {
    return (
      <div className="section center-pad">
        <p className="claim-note">
          ยืนยันคืนงานนี้ใช่ไหมครับ?
          <br />
          เครดิตที่จ่ายไปจะได้คืนทันที และงานจะกลับเข้ากลุ่มให้คนอื่นรับต่อ
        </p>
        {error && <p className="status err">{error}</p>}
        <button className="danger-btn" onClick={submit}>
          ยืนยันคืนงาน
        </button>
        <button className="ghost-btn" onClick={close}>
          ยกเลิก
        </button>
      </div>
    );
  }

  if (phase === "submitting") {
    return (
      <div className="section center-pad">
        <div className="spinner" />
        <p className="empty">กำลังคืนงาน...</p>
      </div>
    );
  }

  return (
    <div className="section center-pad">
      <div className="icon-big ok">✓</div>
      <p className="result-text">คืนงานสำเร็จ! เครดิตคืนให้แล้วครับ</p>
      <button className="link-btn" onClick={close}>
        ปิดหน้านี้
      </button>
    </div>
  );
}

function JobDetail({ jobId }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!jobId) return;
    fetch(`/api/dashboard/job-detail?jobId=${jobId}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ error: true }));
  }, [jobId]);

  if (!data) return <Loading />;
  if (data.error) return <div className="section center-pad"><p className="empty">ไม่พบข้อมูล</p></div>;

  const claim = data.claim;
  return (
    <div className="section">
      <div className="profile-summary">
        <p className="summary-head">{data.detail}</p>
        <div className="summary-row">
          <span>ค่าจ้าง</span>
          <strong>{data.wage} บาท</strong>
        </div>
        <div className="summary-row">
          <span>ผู้รับงาน</span>
          <strong>{claim?.claimer?.display_name ?? "-"}</strong>
        </div>
        {claim?.claimer?.phone && (
          <div className="summary-row">
            <span>เบอร์ติดต่อ</span>
            <a className="phone-link" href={`tel:${claim.claimer.phone}`}>
              📞 {claim.claimer.phone}
            </a>
          </div>
        )}
        {claim?.claimed_at && (
          <div className="summary-row">
            <span>รับงานเมื่อ</span>
            <strong>{formatThaiDateTimeClient(claim.claimed_at)}</strong>
          </div>
        )}
        {claim?.delivery_at && (
          <div className="summary-row">
            <span>ปิดงานเมื่อ</span>
            <strong>{formatThaiDateTimeClient(claim.delivery_at)}</strong>
          </div>
        )}
        {claim?.delivery_note && (
          <div className="summary-row">
            <span>หมายเหตุ</span>
            <strong>{claim.delivery_note}</strong>
          </div>
        )}
      </div>
      {claim?.delivery_photo_url && (
        <img src={claim.delivery_photo_url} alt="delivery" className="photo-preview" />
      )}
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

function NeedProfile({ setTab }) {
  return (
    <div className="section center-pad">
      <p className="empty">กรุณากรอกข้อมูลส่วนตัวก่อนใช้งานครับ</p>
      <button className="link-btn" onClick={() => setTab("profile")}>
        กรอกข้อมูลส่วนตัว
      </button>
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
  .balance-card { background: ${ACCENT}; color: #fff; border-radius: 16px; padding: 20px; display: flex; flex-direction: column; gap: 4px; transition: background 0.2s; }
  .balance-card.low { background: #E24B4A; }
  .balance-top { display: flex; align-items: center; justify-content: space-between; }
  .balance-label { font-size: 13px; opacity: 0.9; }
  .balance-alert { font-size: 22px; }
  .balance-value { font-size: 34px; font-weight: 700; }
  .balance-ok { font-size: 12px; opacity: 0.9; margin-top: 2px; }
  .balance-warning { margin-top: 10px; background: rgba(255,255,255,0.22); border: none; color: #fff; padding: 10px 14px; border-radius: 10px; font-size: 13px; font-weight: 700; text-align: left; }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .grid-item { background: #fff; border: none; border-radius: 14px; padding: 22px 12px; display: flex; flex-direction: column; align-items: center; gap: 8px; box-shadow: 0 1px 6px rgba(0,0,0,0.05); }
  .grid-icon { font-size: 30px; }
  .grid-label { font-size: 15px; font-weight: 600; color: #333; }
  .field { display: flex; flex-direction: column; gap: 6px; }
  .field-label { font-size: 13px; color: #666; font-weight: 600; }
  input, select, textarea { width: 100%; padding: 12px 14px; font-size: 15px; border: 1px solid #DDD; border-radius: 10px; background: #fff; box-sizing: border-box; outline: none; font-family: inherit; }
  input:focus, select:focus, textarea:focus { border-color: ${ACCENT}; }
  .photo-preview { width: 100%; border-radius: 10px; margin-top: 8px; display: block; }
  .photo-upload { width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 28px 16px; border: 2px dashed #CFCFCF; border-radius: 12px; background: #FAFAFA; color: #888; font-size: 13px; }
  .photo-upload:active { background: #F0F0F0; }
  .photo-upload-icon { font-size: 28px; }
  .photo-preview-wrap { position: relative; }
  .photo-remove { position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.6); color: #fff; border: none; border-radius: 8px; padding: 6px 12px; font-size: 12px; font-weight: 700; }
  .checkbox { display: flex; align-items: center; gap: 8px; font-size: 15px; }
  .checkbox input { width: auto; }
  button[type="submit"], .claim-btn { padding: 14px; font-size: 16px; font-weight: 700; color: #fff; background: ${ACCENT}; border: none; border-radius: 12px; }
  button:disabled { opacity: 0.6; }
  .status { font-size: 14px; padding: 10px 12px; border-radius: 8px; margin: 0; }
  .status.ok { background: #E1F5EE; color: #0F6E56; }
  .status.err { background: #FCEBEB; color: #A32D2D; }
  .tabs { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; }
  .tab { flex-shrink: 0; padding: 8px 16px; border-radius: 20px; border: 1px solid #DDD; background: #fff; font-size: 13px; color: #555; white-space: nowrap; }
  .tab.active { background: ${ACCENT}; border-color: ${ACCENT}; color: #fff; font-weight: 700; }
  .job-card { background: #fff; border-radius: 14px; padding: 16px; position: relative; box-shadow: 0 1px 6px rgba(0,0,0,0.05); }
  .badge { position: absolute; top: 14px; right: 14px; background: #E24B4A; color: #fff; font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 20px; }
  .job-detail { font-size: 17px; font-weight: 700; margin: 0 0 6px; color: #222; }
  .job-meta { font-size: 14px; color: #444; margin: 0 0 4px; }
  .job-sub { font-size: 13px; color: #888; margin: 0 0 12px; }
  .claim-btn { width: 100%; }
  .subhead { font-size: 15px; font-weight: 700; color: #333; margin: 0; }
  .profile-summary { background: #fff; border-radius: 14px; padding: 16px; box-shadow: 0 1px 6px rgba(0,0,0,0.05); display: flex; flex-direction: column; gap: 10px; }
  .summary-head { font-size: 14px; font-weight: 700; color: ${ACCENT}; margin: 0 0 2px; }
  .summary-row { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; font-size: 14px; }
  .summary-row span { color: #888; flex-shrink: 0; }
  .summary-row strong { color: #222; font-weight: 600; text-align: right; }
  .phone-link { color: ${ACCENT}; font-weight: 700; text-decoration: none; }
  .hist-row { background: #fff; border-radius: 10px; padding: 12px 14px; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
  .hist-detail { font-size: 15px; font-weight: 600; margin: 0 0 4px; color: #222; }
  .hist-meta { font-size: 13px; color: #777; margin: 0; }
  .hist-date { font-size: 12px; color: #aaa; margin: 4px 0 0; }
  .hist-search { margin-bottom: 4px; }
  .date-range-picker { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #666; margin-top: -4px; }
  .date-range-picker input { flex: 1; padding: 8px 10px; font-size: 13px; }
  .hist-actions { display: flex; gap: 8px; margin-top: 10px; }
  .hist-btn { flex: 1; padding: 9px; font-size: 13px; font-weight: 700; border-radius: 8px; border: 1px solid ${ACCENT}; background: #fff; color: ${ACCENT}; }
  .hist-btn.primary { background: ${ACCENT}; color: #fff; border: none; }
  .metric-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .metric { background: #fff; border-radius: 14px; padding: 18px; display: flex; flex-direction: column; gap: 2px; box-shadow: 0 1px 6px rgba(0,0,0,0.05); border: 2px solid transparent; text-align: left; width: 100%; cursor: pointer; }
  .metric.active { border-color: ${ACCENT}; }
  .metric-label { font-size: 13px; color: #888; }
  .metric-value { font-size: 26px; font-weight: 700; color: ${ACCENT}; }
  .metric-unit { font-size: 12px; color: #aaa; }
  .total-card { background: #fff; border-radius: 14px; padding: 18px; display: flex; flex-direction: column; gap: 6px; box-shadow: 0 1px 6px rgba(0,0,0,0.05); font-size: 15px; color: #555; border: 2px solid transparent; text-align: left; width: 100%; cursor: pointer; }
  .total-card.active { border-color: ${ACCENT}; }
  .total-card strong { font-size: 20px; color: #222; }
  .empty { text-align: center; color: #999; font-size: 15px; padding: 12px; }
  .empty.small { padding: 4px; font-size: 14px; }
  .link-btn { background: ${ACCENT}; color: #fff; text-decoration: none; padding: 12px 20px; border-radius: 10px; font-weight: 700; border: none; font-size: 15px; }
  .msg { font-size: 16px; color: #444; }
  .ghost-btn { background: transparent; color: ${ACCENT}; border: 1px solid ${ACCENT}; border-radius: 10px; padding: 12px 20px; font-weight: 700; font-size: 15px; }
  .danger-btn { background: #E24B4A; color: #fff; border: none; border-radius: 12px; padding: 14px; font-weight: 700; font-size: 16px; width: 100%; }
  .claim-note { text-align: center; color: #555; font-size: 14px; padding: 14px 16px 0; margin: 0; }
  .icon-big { width: 72px; height: 72px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 34px; font-weight: 700; color: #fff; }
  .icon-big.ok { background: ${ACCENT}; }
  .icon-big.warn { background: #E24B4A; }
  .result-text { text-align: center; font-size: 16px; color: #333; white-space: pre-wrap; margin: 0; }
  .spinner { width: 32px; height: 32px; border: 3px solid #E5E5E5; border-top-color: ${ACCENT}; border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;
