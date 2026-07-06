"use client";

import { useEffect, useState } from "react";
import "./admin.css";

export default function AdminPage() {
  const [authed, setAuthed] = useState(null);

  useEffect(() => {
    fetch("/api/admin/groups")
      .then((r) => setAuthed(r.ok))
      .catch(() => setAuthed(false));
  }, []);

  if (authed === null) return <div className="wrap">กำลังตรวจสอบสิทธิ์...</div>;
  if (!authed) return <LoginForm onSuccess={() => setAuthed(true)} />;
  return <Dashboard onLogout={() => setAuthed(false)} />;
}

function LoginForm({ onSuccess }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (res.ok) onSuccess();
    else setError("รหัสผ่านไม่ถูกต้อง");
  }

  return (
    <div className="wrap">
      <form className="login-box" onSubmit={submit}>
        <h2>เข้าสู่แผงควบคุมระบบ</h2>
        {error && <p className="err">{error}</p>}
        <input
          type="password"
          placeholder="รหัสผ่านแอดมิน"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        <button type="submit" disabled={loading} style={{ width: "100%" }}>
          {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </button>
      </form>
    </div>
  );
}

function Dashboard({ onLogout }) {
  const [tab, setTab] = useState("usage");

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    onLogout();
  }

  return (
    <div className="wrap">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>แผงควบคุมระบบ</h1>
        <button className="btn secondary" onClick={logout}>
          ออกจากระบบ
        </button>
      </div>

      <div className="tabs">
        <button className={tab === "usage" ? "active" : ""} onClick={() => setTab("usage")}>
          การใช้งาน/โควต้า
        </button>
        <button className={tab === "credits" ? "active" : ""} onClick={() => setTab("credits")}>
          จัดการเครดิต
        </button>
        <button className={tab === "groups" ? "active" : ""} onClick={() => setTab("groups")}>
          จัดการกลุ่ม
        </button>
      </div>

      {tab === "usage" && <UsageTab />}
      {tab === "credits" && <CreditsTab />}
      {tab === "groups" && <GroupsTab />}
    </div>
  );
}

function barClass(ratio) {
  if (ratio >= 0.9) return "bar-fill danger";
  if (ratio >= 0.7) return "bar-fill warn";
  return "bar-fill";
}

function UsageTab() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch("/api/admin/usage")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) return <p>กำลังโหลด...</p>;

  const { lineOA, other } = data;
  const ratio = lineOA.quota ? Math.min(1, lineOA.used / lineOA.quota) : 0;

  return (
    <>
      <div className="card">
        <p className="user-name">LINE OA</p>
        <p className="user-meta">
          ใช้ไป {lineOA.used ?? "-"} / {lineOA.quota ?? "-"} ข้อความ ({(ratio * 100).toFixed(0)}%)
        </p>
        <div className="bar-track">
          <div className={barClass(ratio)} style={{ width: `${ratio * 100}%` }} />
        </div>
        {ratio >= 0.9 && (
          <p style={{ color: "#A32D2D", fontSize: 13, marginTop: 8 }}>
            ⚠️ ใกล้เต็มโควต้าแล้ว ควรพิจารณาอัปเกรดแพ็กเกจ
          </p>
        )}
      </div>

      {other.map((svc) => (
        <div className="card" key={svc.name}>
          <p className="user-name">{svc.name}</p>
          <p className="user-meta">{svc.note}</p>
          <a className="btn secondary" href={svc.url} target="_blank" rel="noreferrer">
            เปิดแดชบอร์ด
          </a>
        </div>
      ))}
    </>
  );
}

function CreditsTab() {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  async function search(e) {
    e?.preventDefault();
    setLoading(true);
    const res = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setUsers(data.users ?? []);
    setLoading(false);
  }

  return (
    <div className="card">
      <form className="search-row" onSubmit={search}>
        <input
          placeholder="ค้นหาด้วยชื่อ/เบอร์โทร/LINE user ID"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="btn" type="submit" disabled={loading}>
          ค้นหา
        </button>
      </form>
      {users.length === 0 && <p className="user-meta">ไม่มีผลลัพธ์</p>}
      {users.map((u) => (
        <UserRow key={u.id} user={u} onUpdated={(bal) => {
          setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, wallet_balance: bal } : x)));
        }} />
      ))}
    </div>
  );
}

function UserRow({ user, onUpdated }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  async function adjust() {
    const delta = Number(amount);
    if (!delta) return;
    setSaving(true);
    setStatus("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, amount: delta, reason }),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      onUpdated(data.balance);
      setAmount("");
      setReason("");
      setStatus(`สำเร็จ ยอดคงเหลือ: ${data.balance} เครดิต`);
    } else {
      const data = await res.json().catch(() => ({}));
      setStatus(`ผิดพลาด: ${data.error || "unknown"}`);
    }
  }

  return (
    <div className="user-row">
      <p className="user-name">{user.display_name || `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || "-"}</p>
      <p className="user-meta">
        เบอร์: {user.phone || "-"} · ยอดเครดิต: {Number(user.wallet_balance).toLocaleString()}
      </p>
      <div className="adjust-row">
        <input
          type="number"
          placeholder="+10 / -10"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <input
          type="text"
          placeholder="เหตุผล (ไม่บังคับ)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <button className="btn" onClick={adjust} disabled={saving || !amount}>
          บันทึก
        </button>
      </div>
      {status && <p className="status-ok">{status}</p>}
    </div>
  );
}

function GroupsTab() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/groups")
      .then((r) => r.json())
      .then((d) => {
        setGroups(d.groups ?? []);
        setLoading(false);
      });
  }, []);

  if (loading) return <p>กำลังโหลด...</p>;

  return (
    <div className="card">
      {groups.length === 0 && <p className="user-meta">ยังไม่มีกลุ่มในระบบ</p>}
      {groups.map((g) => (
        <GroupRow
          key={g.id}
          group={g}
          onUpdated={(updated) =>
            setGroups((prev) => prev.map((x) => (x.id === g.id ? updated : x)))
          }
        />
      ))}
    </div>
  );
}

function GroupRow({ group, onUpdated }) {
  const [mode, setMode] = useState(group.billing_mode);
  const [validUntil, setValidUntil] = useState(group.subscription_valid_until ?? "");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  async function save() {
    setSaving(true);
    setStatus("");
    const res = await fetch("/api/admin/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groupId: group.id,
        billingMode: mode,
        subscriptionValidUntil: mode === "subscription" ? validUntil : null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      onUpdated(data.group);
      setStatus("บันทึกแล้ว");
    } else {
      const data = await res.json().catch(() => ({}));
      setStatus(`ผิดพลาด: ${data.error || "unknown"}`);
    }
  }

  return (
    <div className="group-row">
      <p className="group-name">
        {group.group_name || "(ยังไม่มีชื่อ)"}{" "}
        <span className={`badge ${group.billing_mode}`}>
          {group.billing_mode === "subscription" ? "เหมาจ่าย" : "เครดิต"}
        </span>
      </p>
      <p className="group-meta">
        LINE Group ID: {group.line_group_id}
        {group.billing_mode === "subscription" && group.subscription_valid_until
          ? ` · หมดอายุ: ${group.subscription_valid_until}`
          : ""}
      </p>
      <div className="group-controls">
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="credit">เครดิต (หักต่องาน)</option>
          <option value="subscription">เหมาจ่ายรายเดือน</option>
        </select>
        {mode === "subscription" && (
          <input
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
          />
        )}
        <button className="btn" onClick={save} disabled={saving}>
          บันทึก
        </button>
        {status && <span className="status-ok">{status}</span>}
      </div>
    </div>
  );
}
