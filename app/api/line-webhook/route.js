import crypto from "crypto";
import { NextResponse } from "next/server";
import { replyMessage, pushMessage } from "@/lib/line";
import {
  getOrCreateUser,
  getUserBalance,
  hasPriorJobActivity,
  shouldSendProfileReminder,
} from "@/lib/users";
import {
  getOrCreateGroup,
  linkUserToGroup,
  userHasCreditGroup,
  syncGroupMembers,
  linkUserToAllGroupsIfMember,
} from "@/lib/groups";
import {
  parseJobCommand,
  postJob,
  buildJobCardMessage,
  buildJobPostedCard,
  claimJob,
  getJobWithPoster,
  buildGroupClaimedMessage,
  buildClaimedCard,
  saveJobQuoteToken,
  buildWelcomeMessage,
} from "@/lib/jobs";

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

// ส่ง DM หา user ถ้าส่งไม่ได้ (ยังไม่แอดเพื่อน) ให้ประกาศ fallback เข้ากลุ่มแทน
async function notifyUser({ user, lineGroupId, messages, fallbackText }) {
  const result = await pushMessage(user.line_user_id, messages);
  if (!result.ok && lineGroupId) {
    await pushMessage(lineGroupId, [{ type: "text", text: fallbackText }]);
  }
}

async function handleDirectMessage(event) {
  const { user, isNew, freeCredit } = await getOrCreateUser(event.source.userId);

  if (!(await userHasCreditGroup(user.id))) {
    await replyMessage(event.replyToken, [
      { type: "text", text: "พิมพ์ /job ในกลุ่มไลน์ที่มีบอทเพื่อเปิดงานได้เลยครับ หรือเปิดเมนูด้านล่างเพื่อใช้งานเมนูอื่นๆ" },
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

    const balance = await getUserBalance(poster.id);
    const extraNote = profileReminder(poster).trim() || null;
    await notifyUser({
      user: poster,
      lineGroupId: event.source.groupId,
      messages: [buildJobPostedCard(job, balance, extraNote)],
      fallbackText: `เปิดงาน "${job.detail}" สำเร็จครับ${profileReminder(poster)}`,
    });
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

  const claimerMessages = [buildClaimedCard(job, poster, claim, claimerBalance)];
  const claimerReminder = profileReminder(claimer);
  if (claimerReminder) {
    claimerMessages.push({ type: "text", text: claimerReminder.trim() });
  }

  await notifyUser({
    user: claimer,
    lineGroupId: event.source.groupId,
    messages: claimerMessages,
    fallbackText: `คุณได้รับงาน "${job.detail}" แล้วครับ (ส่งข้อมูลติดต่อไม่ได้เพราะยังไม่ได้เพิ่มเพื่อนบอท)${profileReminder(
      claimer
    )}`,
  });

  // ไม่ส่ง DM หาผู้เปิดงานแล้ว (ให้เข้าไปดูในระบบ/ประวัติงานเอง) ประกาศแค่ในกลุ่มพอ
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
    } else if (event.type === "follow") {
      await handleFollow(event);
    } else if (event.type === "memberJoined") {
      await handleMemberJoined(event);
    }
  }

  return NextResponse.json({ status: "ok" });
}
