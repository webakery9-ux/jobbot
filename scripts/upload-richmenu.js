const fs = require("fs");
const path = require("path");

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
if (!TOKEN) {
  console.error("Missing LINE_CHANNEL_ACCESS_TOKEN env var");
  process.exit(1);
}

const mgmt = process.env.NEXT_PUBLIC_MGMT_LIFF_ID;
const liffBase = `https://liff.line.me/${mgmt}`;

const richMenuDef = {
  size: { width: 2500, height: 920 },
  selected: true,
  name: "JobBot main menu v8",
  chatBarText: "เมนู",
  areas: [
    { bounds: { x: 0, y: 0, width: 834, height: 460 }, action: { type: "uri", label: "รับงาน", uri: `${liffBase}?tab=jobs` } },
    { bounds: { x: 834, y: 0, width: 833, height: 460 }, action: { type: "uri", label: "โพสต์งาน", uri: `${liffBase}?tab=post` } },
    { bounds: { x: 1667, y: 0, width: 833, height: 460 }, action: { type: "uri", label: "ประวัติงาน", uri: `${liffBase}?tab=history` } },
    { bounds: { x: 0, y: 460, width: 834, height: 460 }, action: { type: "uri", label: "สรุปรายได้", uri: `${liffBase}?tab=income` } },
    { bounds: { x: 834, y: 460, width: 833, height: 460 }, action: { type: "uri", label: "เติมเครดิต", uri: `${liffBase}?tab=credit` } },
    { bounds: { x: 1667, y: 460, width: 833, height: 460 }, action: { type: "uri", label: "ข้อมูลส่วนตัว", uri: `${liffBase}?tab=profile` } },
  ],
};

async function api(pathname, options = {}, host = "https://api.line.me") {
  const res = await fetch(`${host}${pathname}`, {
    ...options,
    headers: { Authorization: `Bearer ${TOKEN}`, ...(options.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${options.method || "GET"} ${pathname} -> ${res.status}: ${text}`);
  }
  return res;
}

async function main() {
  const oldListRes = await api("/v2/bot/richmenu/list");
  const oldList = (await oldListRes.json()).richmenus;

  console.log("creating new rich menu...");
  const createRes = await api("/v2/bot/richmenu", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(richMenuDef),
  });
  const { richMenuId } = await createRes.json();
  console.log("created:", richMenuId);

  console.log("uploading image...");
  const imageBuffer = fs.readFileSync(path.join(__dirname, "richmenu.png"));
  await api(
    `/v2/bot/richmenu/${richMenuId}/content`,
    {
      method: "POST",
      headers: { "Content-Type": "image/png" },
      body: imageBuffer,
    },
    "https://api-data.line.me"
  );

  console.log("setting as default...");
  await api(`/v2/bot/user/all/richmenu/${richMenuId}`, { method: "POST" });

  for (const rm of oldList) {
    console.log("deleting old rich menu:", rm.richMenuId, rm.name);
    await api(`/v2/bot/richmenu/${rm.richMenuId}`, { method: "DELETE" });
  }

  console.log("done. new default rich menu:", richMenuId);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
