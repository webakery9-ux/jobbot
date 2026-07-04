import crypto from "crypto";
import { NextResponse } from "next/server";
import { replyMessage, pushMessage } from "@/lib/line";
import { getOrCreateUser } from "@/lib/users";
import { getOrCreateGroup } from "@/lib/groups";
import {
  parseJobCommand,
  postJob,
  buildJobCardMessage,
  claimJob,
  getJobWithPoster,
} from "@/lib/jobs";

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;

function isValidSignature(rawBody, signature) {
  const hash = crypto
    .createHmac("SHA256", CHANNEL_SECRET)
    .update(rawBody)
    .digest("base64");
  return hash === signature;
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
  if (!text.toLowerCase().startsWith("/job")) return; // เงียบไว้ ไม่ตอบข้อความอื่นในกลุ่ม

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
    });

    await replyMessage(event.replyToken, [buildJobCardMessage(job)]);
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

function contactLine(user) {
  const name = user.display_name ?? "-";
  return user.phone ? `${name}\nเบอร์: ${user.phone}` : name;
}

async function handlePostback(event) {
  const params = new URLSearchParams(event.postback.data);
  if (params.get("action") !== "claim") return;

  const jobId = params.get("job_id");
  const { user: claimer } = await getOrCreateUser(event.source.userId);

  try {
    await claimJob({ jobId, claimerId: claimer.id });
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

  await pushMessage(claimer.line_user_id, [
    {
      type: "text",
      text:
        `คุณได้รับงานนี้แล้ว!\n${job.detail}\nค่าจ้าง: ${job.wage} บาท\n\n` +
        `ติดต่อผู้จ้าง:\n${contactLine(poster)}`,
    },
  ]);

  await pushMessage(poster.line_user_id, [
    {
      type: "text",
      text: `งาน "${job.detail}" มีคนรับแล้ว!\n\nผู้รับงาน:\n${contactLine(claimer)}`,
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
    }
  }

  return NextResponse.json({ status: "ok" });
}
