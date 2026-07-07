const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

export async function replyMessage(replyToken, messages) {
  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  });
  return res.json().catch(() => null);
}

// คืน { ok, body } เพื่อให้ผู้เรียกเช็คได้ว่าส่งสำเร็จมั้ย (ส่ง DM ไม่ได้ถ้าอีกฝ่ายยังไม่แอดเพื่อน)
export async function pushMessage(to, messages) {
  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ to, messages }),
  });
  const body = await res.json().catch(() => null);
  return { ok: res.ok, body };
}

export async function getProfile(lineUserId) {
  const res = await fetch(`https://api.line.me/v2/bot/profile/${lineUserId}`, {
    headers: { Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}` },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function getGroupSummary(lineGroupId) {
  const res = await fetch(`https://api.line.me/v2/bot/group/${lineGroupId}/summary`, {
    headers: { Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}` },
  });
  if (!res.ok) return null;
  return res.json();
}

// รายชื่อ userId ของสมาชิกกลุ่ม (LINE คืนให้เฉพาะคนที่แอดเพื่อนบอทแล้วเท่านั้น เป็นข้อจำกัดของ LINE เอง)
export async function getGroupMemberIds(lineGroupId) {
  let ids = [];
  let start = null;
  do {
    const url = new URL(`https://api.line.me/v2/bot/group/${lineGroupId}/members/ids`);
    if (start) url.searchParams.set("start", start);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}` } });
    if (!res.ok) return ids;
    const body = await res.json();
    ids = ids.concat(body.memberIds ?? []);
    start = body.next ?? null;
  } while (start);
  return ids;
}

// โควต้าข้อความรวมของเดือนนี้ (ตามแพ็กเกจ LINE OA ที่ใช้อยู่)
export async function getMessageQuota() {
  const res = await fetch("https://api.line.me/v2/bot/message/quota", {
    headers: { Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}` },
  });
  if (!res.ok) return null;
  return res.json(); // { type: "limited"|"none", value: N }
}

// จำนวนข้อความที่ส่งไปแล้วในเดือนนี้
export async function getMessageConsumption() {
  const res = await fetch("https://api.line.me/v2/bot/message/quota/consumption", {
    headers: { Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}` },
  });
  if (!res.ok) return null;
  return res.json(); // { totalUsage: N }
}
