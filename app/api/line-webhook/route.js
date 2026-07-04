import crypto from "crypto";
import { NextResponse } from "next/server";
import { replyMessage, pushMessage } from "@/lib/line";
import { getOrCreateUser, getUserBalance } from "@/lib/users";
import { getOrCreateGroup } from "@/lib/groups";
import {
  parseJobCommand,
  postJob,
  buildJobCardMessage,
  claimJob,
  getJobWithPoster,
  formatThaiDateTime,
} from "@/lib/jobs";

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const LOW_CREDIT_THRESHOLD = 20;

function isValidSignature(rawBody, signature) {
  const hash = crypto
    .createHmac("SHA256", CHANNEL_SECRET)
    .update(rawBody)
    .digest("base64");
  return hash === signature;
}

function addFriendUrl() {
  const basicId = process.env.LINE_BASIC_ID;
  if (!basicId) return null;
  return `https://line.me/R/ti/p/%40${basicId.replace(/^@/, "")}`;
}

function creditSuffix(balance) {
  let text = `\n\nเครดิตคงเหลือของคุณ: ${balance}`;
  if (balance <= LOW_CREDIT_THRESHOLD) {
    text +=
      "\n\n⚠️ เครดิตใกล้หมด กรุณาเติมเครดิตไว้ให้เพียงพอ เพื่อให้สามารถจ่ายงาน-รับงานได้ต่อเนื่อง " +
      "ตรวจสอบเครดิตได้ที่ปุ่มเช็คเครดิต ขอขอบคุณที่สนับสนุนครับ";
  }
  return text;
}

function personLine(user) {
  const name = user.display_name ?? "-";
  return user.phone ? `${name} (โทร ${user.phone})` : name;
}

const WELCOME_MESSAGE =
  "🤖 สวัสดีครับพี่ๆ สมาชิกในกลุ่มทุกท่าน!\n" +
  "ขออนุญาตแนะนำบอทผู้ช่วยจัดระเบียบและจ่ายงานอัตโนมัติเข้ามาสแตนด์บายในกลุ่มนี้นะครับ:\n\n" +
  "🔹 ผู้จ้างงาน: โพสต์งานง่าย เป็นระบบ งานไม่โดนข้อความอื่นดันหาย\n" +
  "🔹 ผู้รับงาน: ระบบปุ่มกดแย่งงานที่โปร่งใสที่สุด ใครไวได้ไป\n" +
  "🔹 ลดความวุ่นวาย: กดรับงานสำเร็จ บอทส่งข้อมูลติดต่อให้คุยหลังบ้านทันที ไม่รบกวนกลุ่มหลัก\n\n" +
  "🟢 ก่อนใช้งาน กรุณาเพิ่มเพื่อนบอทก่อนนะครับ (จำเป็นสำหรับรับการแจ้งเตือนส่วนตัว)\n" +
  "📥 พิมพ์ /job รายละเอียดงาน ราคา วิธีจ่ายเงิน เพื่อเปิดงานแรกได้เลยครับ";

function requireFriendMessage() {
  const url = addFriendUrl();
  return (
    "ต้องเพิ่มเพื่อนบอทก่อนถึงจะใช้งานส่วนนี้ได้ครับ (ระบบต้องส่งการแจ้งเตือนส่วนตัวให้คุณ)\n" +
    (url ? `เพิ่มเพื่อนที่: ${url}` : "ค้นหาชื่อบอทใน LINE เพื่อเพิ่มเพื่อนได้เลยครับ")
  );
}

async function handleDirectMessage(event) {
  const { user, isNew, freeCredit } = await getOrCreateUser(event.source.userId);

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
  if (!/^\/(job|งาน)/i.test(text)) return; // เงียบไว้ ไม่ตอบข้อความอื่นในกลุ่ม

  if (!event.source.userId) {
    await replyMessage(event.replyToken, [
      { type: "text", text: requireFriendMessage() },
    ]);
    return;
  }

  const { user: poster } = await getOrCreateUser(event.source.userId);
  const group = await getOrCreateGroup(event.source.groupId);

  const parsed = parseJobCommand(text);
  if (!parsed) {
    await replyMessage(event.replyToken, [
      {
        type: "text",
        text:
          "รูปแบบคำสั่งไม่ถูกต้อง ใช้แบบนี้:\n" +
          "/job รายละเอียดงาน ราคา วิธีจ่ายเงิน\n\n" +
          "ตัวอย่าง:\n" +
          "/job ล้างบ้าน 2 ชั้น 500 ทันที\n" +
          "/job ล้างบ้าน 2 ชั้น/500/โอน24ชม\n\n" +
          "วิธีจ่ายเงินที่รองรับ: ทันที / โอนทันที / โอน 24 / โอน24ชม / เก็บปลายทาง / เก็บลูกค้า",
      },
    ]);
    return;
  }

  try {
    const job = await postJob({
      posterId: poster.id,
      groupId: group.id,
      detail: parsed.detail,
      wage: parsed.wage,
      paymentMethod: parsed.payment_method,
      isUrgent: parsed.isUrgent,
    });

    await replyMessage(event.replyToken, [buildJobCardMessage(job, poster)]);

    const balance = await getUserBalance(poster.id);
    await pushMessage(poster.line_user_id, [
      { type: "text", text: `เปิดงานสำเร็จ${creditSuffix(balance)}` },
    ]);
  } catch (err) {
    if (err.message?.includes("INSUFFICIENT_CREDIT")) {
      await replyMessage(event.replyToken, [
        { type: "text", text: "เครดิตของคุณไม่พอสำหรับเปิดงานนี้ กรุณาเติมเครดิต" },
      ]);
      return;
    }
    throw err;
  }
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
  await replyMessage(event.replyToken, [{ type: "text", text: WELCOME_MESSAGE }]);
}

async function handlePostback(event) {
  const params = new URLSearchParams(event.postback.data);
  if (params.get("action") !== "claim") return;

  if (!event.source.userId) {
    await replyMessage(event.replyToken, [
      { type: "text", text: requireFriendMessage() },
    ]);
    return;
  }

  const jobId = params.get("job_id");
  const { user: claimer } = await getOrCreateUser(event.source.userId);

  let claim;
  try {
    claim = await claimJob({ jobId, claimerId: claimer.id });
  } catch (err) {
    if (err.code === "23505" || err.message?.includes("JOB_NOT_AVAILABLE")) {
      await pushMessage(claimer.line_user_id, [
        { type: "text", text: "งานนี้ถูกรับไปแล้วครับ ลองงานอื่นดูนะครับ" },
      ]);
      return;
    }
    if (err.message?.includes("INSUFFICIENT_CREDIT")) {
      await pushMessage(claimer.line_user_id, [
        { type: "text", text: "เครดิตของคุณไม่พอสำหรับรับงานนี้ กรุณาเติมเครดิต" },
      ]);
      return;
    }
    throw err;
  }

  const job = await getJobWithPoster(jobId);
  const poster = job.poster;

  const claimerBalance = await getUserBalance(claimer.id);
  await pushMessage(claimer.line_user_id, [
    {
      type: "text",
      text:
        `✅ คุณได้รับงานนี้แล้ว!\n` +
        `งาน: ${job.detail}\n${formatThaiDateTime(job.created_at)}\n\n` +
        `ผู้จ้างงาน: ${personLine(poster)}\n${formatThaiDateTime(claim.claimed_at)}` +
        creditSuffix(claimerBalance),
    },
  ]);

  const posterBalance = await getUserBalance(poster.id);
  await pushMessage(poster.line_user_id, [
    {
      type: "text",
      text:
        `🎉 มีคนรับงานแล้ว!\n` +
        `งาน: ${job.detail}\n${formatThaiDateTime(job.created_at)}\n\n` +
        `ผู้รับงาน: ${personLine(claimer)}\n${formatThaiDateTime(claim.claimed_at)}` +
        creditSuffix(posterBalance),
    },
  ]);
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
    } else if (event.type === "postback") {
      await handlePostback(event);
    } else if (event.type === "join") {
      await handleJoin(event);
    }
  }

  return NextResponse.json({ status: "ok" });
}
