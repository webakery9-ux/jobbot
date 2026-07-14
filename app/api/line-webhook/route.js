import crypto from "crypto";
import { NextResponse } from "next/server";
import { replyMessage, pushMessage } from "@/lib/line";
import { getOrCreateUser } from "@/lib/users";
import {
  getOrCreateGroup,
  linkUserToGroup,
  userHasCreditGroup,
  syncGroupMembers,
  linkUserToAllGroupsIfMember,
} from "@/lib/groups";
import { buildWelcomeMessage } from "@/lib/jobs";

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;

function isValidSignature(rawBody, signature) {
  const hash = crypto
    .createHmac("SHA256", CHANNEL_SECRET)
    .update(rawBody)
    .digest("base64");
  return hash === signature;
}

function profileFormUrl() {
  const mgmtId = process.env.NEXT_PUBLIC_MGMT_LIFF_ID;
  if (mgmtId) return `https://liff.line.me/${mgmtId}?tab=profile`;
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  return liffId ? `https://liff.line.me/${liffId}` : null;
}

function postFormUrl() {
  const mgmtId = process.env.NEXT_PUBLIC_MGMT_LIFF_ID;
  if (mgmtId) return `https://liff.line.me/${mgmtId}?tab=post`;
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  return liffId ? `https://liff.line.me/${liffId}` : null;
}

async function handleDirectMessage(event) {
  const { user, isNew, freeCredit } = await getOrCreateUser(event.source.userId);

  if (!(await userHasCreditGroup(user.id))) {
    await replyMessage(event.replyToken, [
      { type: "text", text: "เปิดเมนูด้านล่างเพื่อโพสต์งาน/รับงาน หรือใช้เมนูอื่นๆ ได้เลยครับ" },
    ]);
    return;
  }

  if (isNew) {
    await replyMessage(event.replyToken, [
      {
        type: "text",
        text: `ยินดีต้อนรับครับ! เราแจกเครดิตฟรีให้ ${freeCredit} เครดิตเพื่อลองใช้งาน\nเครดิตคงเหลือของคุณ: ${user.wallet_balance}`,
      },
    ]);
    return;
  }

  await replyMessage(event.replyToken, [
    { type: "text", text: `เครดิตคงเหลือของคุณ: ${user.wallet_balance}` },
  ]);
}

async function handleGroupMessage(event) {
  const text = event.message.text.trim();
  if (!event.source.userId) return; // ไม่มี ID มาจริงๆ ทำอะไรไม่ได้ ปล่อยผ่าน

  // ผูก user เข้ากับกลุ่มจากข้อความอะไรก็ได้ (ไม่ใช่แค่ /job) เพราะ LINE ไม่ให้ดึงรายชื่อสมาชิกกลุ่ม
  // จากการแอดเพื่อนอย่างเดียวสำหรับบัญชีที่ยัง verified ไม่ได้ นี่เลยเป็นทางเดียวที่รู้ว่าใครอยู่กลุ่มไหนบ้าง
  const { user: poster } = await getOrCreateUser(event.source.userId);
  const group = await getOrCreateGroup(event.source.groupId);
  await linkUserToGroup(poster.id, group.id, "member");

  // ยกเลิกการโพสต์งานผ่านคำสั่งพิมพ์แล้ว ให้ใช้หน้าแอปแทน ถ้ามีคนพิมพ์ /job หรือ /งาน ก็ชี้ทางให้เฉยๆ
  if (!/^\/(job|งาน)/i.test(text)) return; // เงียบไว้ ไม่ตอบข้อความอื่นในกลุ่ม

  const url = postFormUrl();
  await replyMessage(event.replyToken, [
    {
      type: "text",
      text:
        "ตอนนี้เปิดงานผ่านคำสั่งพิมพ์ในกลุ่มไม่ได้แล้วครับ กรุณาโพสต์งานผ่านหน้าแอปแทน" +
        (url ? `\n${url}` : ""),
    },
  ]);
}

async function handleTextMessage(event) {
  if (event.source.type === "user") {
    await handleDirectMessage(event);
  } else if (event.source.type === "group") {
    await handleGroupMessage(event);
  }
}

async function handleJoin(event) {
  if (event.source.type !== "group") return;
  const group = await getOrCreateGroup(event.source.groupId); // ลงทะเบียนกลุ่ม+ดึงชื่อกลุ่มทันทีตั้งแต่บอทถูกเชิญเข้า
  try {
    // ดึงรายชื่อสมาชิกเดิมที่แอดเพื่อนบอทไว้แล้วมาผูกกลุ่มให้ทันที ไม่ต้องรอให้พิมพ์อะไรก่อน
    await syncGroupMembers(group);
  } catch (err) {
    // ไม่ให้กระทบข้อความต้อนรับถ้าดึงรายชื่อไม่สำเร็จ
  }
  const guideUrl = process.env.APP_URL ? `${process.env.APP_URL}/guide` : null;
  await replyMessage(event.replyToken, [buildWelcomeMessage(guideUrl)]);
}

// มีคนเพิ่มเพื่อนบอทเป็นการส่วนตัว พาไปกรอกข้อมูลส่วนตัวทันที
async function handleFollow(event) {
  const { user, isNew, freeCredit } = await getOrCreateUser(event.source.userId);

  try {
    // เช็คว่าเขาเป็นสมาชิกกลุ่มที่มีบอทอยู่แล้วบ้างมั้ย ถ้าใช่ผูกให้ทันทีตั้งแต่แอดเพื่อน ไม่ต้องรอพิมพ์ในกลุ่มก่อน
    await linkUserToAllGroupsIfMember(user.id, event.source.userId);
  } catch (err) {
    // ไม่ให้กระทบข้อความต้อนรับถ้าเช็คไม่สำเร็จ
  }
  const url = profileFormUrl();
  const creditModuleEnabled = await userHasCreditGroup(user.id);
  const creditLine = isNew
    ? `เราแจกเครดิตฟรีให้ ${freeCredit} เครดิตเพื่อลองใช้งาน (เครดิตคงเหลือ: ${user.wallet_balance})`
    : `เครดิตคงเหลือของคุณ: ${user.wallet_balance}`;
  await replyMessage(event.replyToken, [
    {
      type: "flex",
      altText: "ยินดีต้อนรับ! กรอกข้อมูลส่วนตัวเพื่อเริ่มใช้งาน",
      contents: {
        type: "bubble",
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            { type: "text", text: "🎉 ยินดีต้อนรับสู่ JobBotTH", weight: "bold", size: "md", wrap: true },
            ...(creditModuleEnabled
              ? [
                  {
                    type: "text",
                    text: creditLine,
                    wrap: true,
                    size: "sm",
                    color: "#555555",
                    margin: "md",
                  },
                ]
              : []),
            ...(user.profile_completed
              ? []
              : [
                  {
                    type: "text",
                    text: "กรอกข้อมูลส่วนตัวก่อนเริ่มรับงาน/จ่ายงานได้เลยครับ ใช้เวลาไม่ถึงนาที",
                    wrap: true,
                    size: "sm",
                    color: "#555555",
                    margin: "md",
                  },
                ]),
          ],
        },
        footer: url && !user.profile_completed
          ? {
              type: "box",
              layout: "vertical",
              contents: [
                {
                  type: "button",
                  style: "primary",
                  action: { type: "uri", label: "📝 กรอกข้อมูลส่วนตัว", uri: url },
                },
              ],
            }
          : undefined,
      },
    },
  ]);
}

// มีคนเข้ากลุ่มใหม่ (ที่มีบอทอยู่แล้ว) ผูกกลุ่มให้ทันทีโดยไม่ต้องรอให้เขาพิมพ์อะไรก่อน
async function handleMemberJoined(event) {
  if (event.source.type !== "group") return;
  const group = await getOrCreateGroup(event.source.groupId);
  for (const member of event.joined?.members ?? []) {
    if (!member.userId) continue;
    const { user } = await getOrCreateUser(member.userId);
    await linkUserToGroup(user.id, group.id, "member");
  }
}

export async function POST(request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-line-signature");

  if (!signature || !isValidSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody);

  for (const event of body.events) {
    if (event.type === "message" && event.message.type === "text") {
      await handleTextMessage(event);
    } else if (event.type === "join") {
      await handleJoin(event);
    } else if (event.type === "follow") {
      await handleFollow(event);
    } else if (event.type === "memberJoined") {
      await handleMemberJoined(event);
    }
  }

  return NextResponse.json({ status: "ok" });
}
