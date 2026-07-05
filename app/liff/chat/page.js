"use client";

import { useEffect, useRef, useState } from "react";
import liff from "@line/liff";

export default function ChatPage() {
  const [jobId, setJobId] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [lineUserId, setLineUserId] = useState("");
  const [job, setJob] = useState(null);
  const [myUserId, setMyUserId] = useState("");
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setJobId(params.get("job") || "");

    async function init() {
      try {
        await liff.init({ liffId: process.env.NEXT_PUBLIC_CHAT_LIFF_ID });
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

  useEffect(() => {
    if (!ready || !jobId) return;
    let cancelled = false;

    async function poll() {
      const res = await fetch(`/api/chat/${jobId}?lineUserId=${lineUserId}`);
      if (!res.ok) {
        if (!cancelled) setError("ไม่สามารถเปิดแชทนี้ได้ (ไม่ใช่คู่สัญญาของงานนี้)");
        return;
      }
      const data = await res.json();
      if (!cancelled) {
        setJob(data.job);
        setMyUserId(data.myUserId);
        setMessages(data.messages);
      }
    }

    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [ready, jobId, lineUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e) {
    e.preventDefault();
    if (!text.trim()) return;

    const res = await fetch(`/api/chat/${jobId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineUserId, content: text.trim() }),
    });

    if (res.ok) {
      setText("");
      const data = await res.json();
      setMessages((prev) => [...prev, data.message]);
    }
  }

  if (error) {
    return <main style={{ padding: 24, fontFamily: "sans-serif" }}>{error}</main>;
  }

  if (!ready) {
    return <main style={{ padding: 24, fontFamily: "sans-serif" }}>กำลังโหลด...</main>;
  }

  if (!jobId) {
    return <main style={{ padding: 24, fontFamily: "sans-serif" }}>ไม่พบงานที่ต้องการแชท</main>;
  }

  if (!job) {
    return <main style={{ padding: 24, fontFamily: "sans-serif" }}>กำลังโหลด...</main>;
  }

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ padding: 12, borderBottom: "1px solid #eee", fontWeight: 600 }}>
        {job.detail}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              display: "flex",
              justifyContent: m.sender_id === myUserId ? "flex-end" : "flex-start",
              marginBottom: 8,
            }}
          >
            <div
              style={{
                background: m.sender_id === myUserId ? "#06C755" : "#f0f0f0",
                color: m.sender_id === myUserId ? "#fff" : "#000",
                padding: "8px 12px",
                borderRadius: 12,
                maxWidth: "75%",
                whiteSpace: "pre-wrap",
              }}
            >
              {m.content}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSend}
        style={{ display: "flex", padding: 12, borderTop: "1px solid #eee", gap: 8 }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="พิมพ์ข้อความ..."
          style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
        />
        <button type="submit" style={{ padding: "10px 16px" }}>
          ส่ง
        </button>
      </form>
    </main>
  );
}
