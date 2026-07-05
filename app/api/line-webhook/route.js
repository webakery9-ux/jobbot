import crypto from "crypto";
import { NextResponse } from "next/server";
import { replyMessage, pushMessage } from "@/lib/line";
import {
  getOrCreateUser,
  getUserBalance,
  hasPriorJobActivity,
  shouldSendProfileReminder,
} from "@/lib/users";
import { getOrCreateGroup, linkUserToGroup } from "@/lib/groups";
import {
  parseJobCommand,
  postJob,
  buildJobCardMessage,
  claimJob,
  getJobWithPoster,
  formatThaiDateTime,
  displayNameOf,
  buildGroupClaimedMessage,
  buildClaimedActionsCard,
  buildLinkButtonMessage,
  buildPhoneButtonMessage,
  saveJobQuoteToken,
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

function profileFormUrl() {
  const mgmtId = process.env.NEXT_PUBLIC_MGMT_LIFF_ID;
  if (mgmtId) return `https://liff.line.me/${mgmtId}?tab=profile`;
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  return liffId ? `https://liff.line.me/${liffId}` : null;
}

function chatUrl(jobId) {
  const liffId = process.env.NEXT_PUBLIC_CHAT_LIFF_ID;
  return liffId ? `https://liff.line.me/${liffId}/${jobId}` : null;
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

function profileReminder(user) {
  if (user.profile_completed) return "";
  const url = profileFormUrl();
  return (
    "\n\n📝 กรุณากรอกข้อมูลส่วนตัวก่อนใช้งานครั้งต่อไปนะครับ" +
    (url ? `: ${url}` : "")
  );
}

function profileRequiredMessage() {
  const url = profileFormUrl();
  return (
    "โปรดกรอกข้อมูลเกี่ยวกับรถและเจ้าของรถ(ครั้งแรกครั้งเดียว)\n" +
    "เพื่อรับงานและจ่ายงาน\n" +
    (url ? `กรอกได้ที่: ${url}` : "กรุณาติดต่อแอดมินเพื่อกรอกข้อมูล")
  );
}

async function canDoJobAction(user) {
  if (user.profile_completed) return true;
  return !(await hasPriorJobActivity(user.id));
}

function personLine(user) {
  return displayNameOf(user);
}

// ส่ง DM หา user ถ้าส่งไม่ได้ (ยังไม่แอดเพื่อน) ให้ประกาศ fallback เข้ากลุ่มแทน
async function notifyUser({ user, lineGroupId, messages, fallbackText }) {
  const result = await pushMessage(user.line_user_id, messages);
  if (!result.ok && lineGroupId) {
    await pushMessage(lineGroupId, [{ type: "text", text: fallbackText }]);
  }
}

const WELCOME_MESSAGE =
  "สวัสดีครับพี่ๆ สมาชิกในกลุ่มทุกท่าน!\n" +
  "ขออนุญาตแนะนำบอทผู้ช่วยจัดระเบียบการจ่ายงานและรับงานอัตโนมัติในกลุ่มนะครับ:\n\n" +
  "🔹 ผู้จ้างงาน: โพสต์งานง่าย เป็นระบบ\n" +
  "🔹 ผู้รับงาน: สามารถกดรับงานได้ทันที โปร่งใสที่สุด ใครเห็นก่อนกดรับได้ก่อน ไม่มีซ้ำ\n" +
  "🔹 ลดความสับสน: กดรับงานสำเร็จ ส่งข้อมูลติดต่อในแชทส่วนตัวทันที ไม่รบกวนกลุ่มหลัก\n\n" +
  "🟢 ก่อนใช้งาน กรุณาเพิ่มเพื่อน JobBotTH และกรอกข้อมูลสำคัญก่อนนะครับ\n" +
  "(จำเป็นสำหรับการรับงาน จ่ายงานและแจ้งเตือนส่วนตัว)\n\n" +
  "📥 คนจ่ายงานพิมพ์ เพื่อทดลองเปิดงานได้ครับ \n" +
  "เช่น\n" +
  "/job แอร์สุ-สุขุมวิท 400 โอนทันที\n" +
  "/job ด่วน แอร์สุ-สุขุมวิท 400 จบโอน\n" +
  "/job ด่วน SUV แอร์สุ-สุขุมวิท 400 เก็บลูกค้า\n" +
  "/งาน นานา-พัทยา 1000 โอน24\n" +
  "/งาน ด่วน นานา-พัทยา 1000 ปลายทาง\n" +
  "/งาน ด่วน รถตู้ นานา-พัทยา 1000 เก็บลูกค้า\n\n" +
  "หรือ เปิดหน้าจัดการในแชทส่วนตัว JobBotTH ปุ่มโพสต์งาน เลือกกลุ่มที่จะส่งงาน หากอยู่หลายกลุ่มที่มีฐานข้อมูล JobBotTH\n\n" +
  "📌 คนรับงาน ไม่ต้องพิมพ์อะไรเลยครับ แค่กดปุ่ม \"กดรับงาน\" บนการ์ดงานในกลุ่มได้ทันที ใครกดก่อนได้งานก่อน งานจะไปเด้งในแชทส่วนตัว หรือเข้าไปรับงานในหน้า รับงาน ในแชทส่วนตัวก็ได้\n\n" +
  "ทุกท่านสามารถดูรายละเอียดประวัติการรับงาน จ่ายงานได้ทั้งหมด ว่าเคยจ่ายงานให้ใคร รับงานจากใคร วันไหน จ่าย-รับ กี่งาน หรือดูสรุปรายได้จากการรับงานทั้งหมดได้ รายวัน รายสัปดาห์ รายเดือน รายปี\n\n" +
  "ขอขอบพระคุณทุกท่าน หากการใช้งานทำให้สะดวกขึ้นได้ ระบบนี้เก็บแค่ค่าบำรุง Server ระบบ โดยคิดจากราคางาน 100/1 เครดิตเท่านั้น\n" +
  "หากมีข้อสงสัย สามารถติดต่อผู้ดูแลระบบได้เลยครับ";

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
  if (!event.source.userId) return; // ไม่มี ID มาจริงๆ ทำอะไรไม่ได้ ปล่อยผ่าน

  // ผูก user เข้ากับกลุ่มจากข้อความอะไรก็ได้ ไม่ใช่แค่ /job เพื่อให้รู้ว่าใครอยู่กลุ่มไหนบ้าง
  const { user: poster } = await getOrCreateUser(event.source.userId);
  const group = await getOrCreateGroup(event.source.groupId);
  await linkUserToGroup(poster.id, group.id, "member");

  if (!/^\/(job|งาน)/i.test(text)) return; // เงียบไว้ ไม่ตอบข้อความอื่นในกลุ่ม

  if (!(await canDoJobAction(poster))) {
    if (await shouldSendProfileReminder(poster.id, poster.profile_reminder_sent_at)) {
      await replyMessage(event.replyToken, [
        { type: "text", text: profileRequiredMessage() },
      ]);
    }
    return;
  }

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
          "/job ล้างบ้าน 2 ชั้น/500/โอน24ชม",
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
      vehicleType: parsed.vehicleType,
    });

    const replyResult = await replyMessage(event.replyToken, [
      buildJobCardMessage(job, poster),
    ]);
    const quoteToken = replyResult?.sentMessages?.[0]?.quoteToken;
    await saveJobQuoteToken(job.id, quoteToken);
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

async function handlePostback(event) {
  const params = new URLSearchParams(event.postback.data);
  if (params.get("action") !== "claim") return;
  if (!event.source.userId) return; // ไม่มี ID มาจริงๆ ทำอะไรไม่ได้ ปล่อยผ่าน

  const jobId = params.get("job_id");
  const { user: claimer } = await getOrCreateUser(event.source.userId);

  if (!(await canDoJobAction(claimer))) {
    return;
  }

  let claim;
  try {
    claim = await claimJob({ jobId, claimerId: claimer.id });
  } catch (err) {
    if (err.code === "23505" || err.message?.includes("JOB_NOT_AVAILABLE")) {
      const job = await getJobWithPoster(jobId);
      await notifyUser({
        user: claimer,
        lineGroupId: event.source.groupId,
        messages: [
          {
            type: "text",
            text: `งาน "${job.detail}" จาก ${job.poster?.display_name ?? "-"} ถูกท่านอื่นรับไปแล้วครับ ลองงานอื่นดูนะครับ`,
          },
        ],
        fallbackText: `งาน "${job.detail}" ถูกท่านอื่นรับไปแล้วครับ ลองงานอื่นดูนะครับ`,
      });
      return;
    }
    if (err.message?.includes("INSUFFICIENT_CREDIT")) {
      await notifyUser({
        user: claimer,
        lineGroupId: event.source.groupId,
        messages: [
          { type: "text", text: "เครดิตของคุณไม่พอสำหรับรับงานนี้ กรุณาเติมเครดิต" },
        ],
        fallbackText: "เครดิตไม่พอสำหรับรับงานนี้ครับ",
      });
      return;
    }
    throw err;
  }

  const job = await getJobWithPoster(jobId);
  const poster = job.poster;
  if (job.group_id) await linkUserToGroup(claimer.id, job.group_id, "worker");

  const claimerBalance = await getUserBalance(claimer.id);
  const chatLink = chatUrl(job.id);

  const claimerMessages = [
    {
      type: "text",
      text:
        `✅ คุณได้รับงานนี้แล้ว!\n` +
        `งาน: ${job.detail}\n${formatThaiDateTime(job.created_at)}\n\n` +
        `ผู้จ้างงาน: ${personLine(poster)}\n${formatThaiDateTime(claim.claimed_at)}` +
        creditSuffix(claimerBalance) +
        profileReminder(claimer),
    },
  ];
  if (poster?.phone) {
    claimerMessages.push(buildPhoneButtonMessage(personLine(poster), poster.phone));
  }
  claimerMessages.push(buildClaimedActionsCard(job));

  await notifyUser({
    user: claimer,
    lineGroupId: event.source.groupId,
    messages: claimerMessages,
    fallbackText: `คุณได้รับงาน "${job.detail}" แล้วครับ (ส่งข้อมูลติดต่อไม่ได้เพราะยังไม่ได้เพิ่มเพื่อนบอท)${profileReminder(
      claimer
    )}`,
  });

  const posterBalance = await getUserBalance(poster.id);
  const posterMessages = [
    {
      type: "text",
      text:
        `🎉 มีคนรับงานแล้ว!\n` +
        `งาน: ${job.detail}\n${formatThaiDateTime(job.created_at)}\n\n` +
        `ผู้รับงาน: ${personLine(claimer)}\n${formatThaiDateTime(claim.claimed_at)}` +
        creditSuffix(posterBalance) +
        profileReminder(poster),
    },
  ];
  if (claimer?.phone) {
    posterMessages.push(buildPhoneButtonMessage(personLine(claimer), claimer.phone));
  }
  if (chatLink) {
    posterMessages.push(buildLinkButtonMessage("เปิดแชทคุยกับผู้รับงาน", "💬 เปิดแชท", chatLink));
  }

  await notifyUser({
    user: poster,
    lineGroupId: job.group?.line_group_id,
    messages: posterMessages,
    fallbackText: `งาน "${job.detail}" มีคนรับแล้วครับ (ส่งข้อมูลติดต่อไม่ได้เพราะยังไม่ได้เพิ่มเพื่อนบอท)${profileReminder(
      poster
    )}`,
  });

  if (job.group?.line_group_id) {
    const groupMessage = buildGroupClaimedMessage(claimer, poster, job.line_quote_token);
    await pushMessage(job.group.line_group_id, [groupMessage]);
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
    } else if (event.type === "postback") {
      await handlePostback(event);
    } else if (event.type === "join") {
      await handleJoin(event);
    } else if (event.type === "memberJoined") {
      await handleMemberJoined(event);
    }
  }

  return NextResponse.json({ status: "ok" });
}
