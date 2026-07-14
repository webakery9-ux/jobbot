import { supabase } from "./supabase";

// ปุ่มกดรับงานเปิดหน้า LIFF ส่วนตัวของแต่ละคน (จัดการเพิ่มเพื่อน/กรอกข้อมูล/รับงานในที่เดียว ไม่รบกวนกลุ่ม)
function claimAction(jobId) {
  const mgmt = process.env.NEXT_PUBLIC_MGMT_LIFF_ID;
  return {
    type: "uri",
    label: "กดรับงาน",
    uri: mgmt ? `https://liff.line.me/${mgmt}?tab=claim&job=${jobId}` : "#",
  };
}

// ชื่อที่ใช้แสดง: ชื่อ LINE ก่อน ถ้าไม่มีใช้ชื่อ-นามสกุลที่กรอก ถ้าไม่มีอีกใช้ "-"
export function displayNameOf(user) {
  if (user?.display_name) return user.display_name;
  const full = [user?.first_name, user?.last_name].filter(Boolean).join(" ");
  return full || "-";
}

// ข้อความในกลุ่มตอนงานถูกรับ แสดงชื่อผู้รับงาน/เจ้าของงาน
// (mention แท็กจริงต้องใช้ OA ที่ยืนยันบัญชีแล้ว จึงแสดงเป็นชื่อธรรมดาไปก่อน)
export function buildGroupClaimedMessage(claimer, poster, quoteToken, jobCode) {
  const text =
    `${jobCode ? `✅ งาน ${jobCode} ถูกรับแล้ว` : "✅ งานนี้ถูกรับแล้ว"}\n\n` +
    `ผู้รับงาน: ${displayNameOf(claimer)}\n` +
    `เบอร์โทร: ${claimer?.phone || "-"}\n\n` +
    `ผู้จ่ายงาน: ${displayNameOf(poster)}\n` +
    `เบอร์โทร: ${poster?.phone || "-"}`;

  const msg = { type: "text", text };
  if (quoteToken) msg.quoteToken = quoteToken;
  return msg;
}

export function formatThaiDateTime(dateInput) {
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

// วันในสัปดาห์แบบย่อ 2-3 ตัวอักษรพร้อมจุด ตามที่ใช้กันทั่วไป (ของจริงจาก Intl ให้ชื่อเต็ม เช่น "จันทร์" เลยต้องกำหนดเอง)
const THAI_WEEKDAY_SHORT = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

// "จ. 06-07-2026" จาก string วันที่แบบ YYYY-MM-DD (แยกตัวเลขเองแทนใช้ getDate()/getMonth() ของเครื่อง
// เพื่อไม่ให้ timezone ของ server ทำวันเพี้ยน แล้วคำนวณวันในสัปดาห์แบบอิงเวลาไทยแยกต่างหาก)
function formatBatchLabelDate(isoDateStr) {
  const [yyyy, mm, dd] = isoDateStr.split("-");
  // ใช้ Date.UTC จากตัวเลขวันที่ตรงๆ (ไม่ผ่าน timezone offset ใดๆ) วันในสัปดาห์ของปฏิทินวันนั้นเลยถูกต้องเสมอไม่ว่า server จะอยู่โซนเวลาไหน
  const dayOfWeek = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd))).getUTCDay();
  const weekday = THAI_WEEKDAY_SHORT[dayOfWeek];
  return `${weekday} ${dd}-${mm}-${yyyy}`;
}

// เอาส่วนตัวอักษร (ไม่ใช่ตัวเลข) ที่ขึ้นต้นรหัสงานมาโชว์หัวข้อความ เช่น "XH31" -> "XH" (ไม่ต้องพิมพ์เอง ดึงจากรหัสจริงของงานแรกในชุด)
function extractCodePrefix(jobCode) {
  const m = (jobCode || "").match(/^([^\d]+)/);
  return m ? m[1] : null;
}

// ข้อความรวมเดียวสำหรับส่งเข้ากลุ่มตอนโพสต์งานเป็นชุด (แทนที่จะส่งการ์ดแยกทีละงาน)
// jobs: อาเรย์ของงานที่โพสต์สำเร็จ แต่ละอันต้องมี jobCode + previewLine (3 บรรทัดสรุปย่อ คำนวณไว้แล้วตอน parse)
export function buildBatchSummaryMessage(jobs, batchLabelDate, jobsTabUri) {
  const codePrefix = extractCodePrefix(jobs[0]?.jobCode);
  const headerText = codePrefix
    ? `รหัส ${codePrefix} | ${formatBatchLabelDate(batchLabelDate)}`
    : formatBatchLabelDate(batchLabelDate);
  const body = jobs.map((j) => j.previewLine).join("\n\n");

  return {
    type: "flex",
    altText: headerText,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: headerText, weight: "bold", size: "md", color: "#06C755", wrap: true },
          { type: "separator", margin: "md" },
          { type: "text", text: body, wrap: true, size: "sm", margin: "md" },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "button", style: "primary", action: { type: "uri", label: "กดรับงาน", uri: jobsTabUri } },
        ],
      },
    },
  };
}

export async function postJob({
  posterId,
  groupId,
  detail,
  wage,
  paymentMethod,
  isUrgent,
  vehicleType,
  jobCode,
}) {
  const { data, error } = await supabase.rpc("post_job", {
    p_poster_id: posterId,
    p_group_id: groupId,
    p_detail: detail,
    p_wage: wage,
    p_payment_method: paymentMethod,
    p_is_urgent: !!isUrgent,
    p_requested_vehicle_type: vehicleType ?? null,
    p_job_code: jobCode ?? null,
  });

  if (error) throw error;
  return data;
}

export async function claimJob({ jobId, claimerId }) {
  const { data, error } = await supabase.rpc("claim_job", {
    p_job_id: jobId,
    p_claimer_id: claimerId,
  });

  if (error) throw error;
  return data;
}

export async function returnJob({ jobId, claimerId }) {
  const { data, error } = await supabase.rpc("return_job", {
    p_job_id: jobId,
    p_claimer_id: claimerId,
  });

  if (error) throw error;
  return data;
}

export async function completeJob({ jobId, claimerId, note, photoUrl }) {
  const { data, error } = await supabase.rpc("complete_job", {
    p_job_id: jobId,
    p_claimer_id: claimerId,
    p_note: note ?? null,
    p_photo_url: photoUrl ?? null,
  });

  if (error) throw error;
  return data;
}

// การ์ดปุ่มเดียว ใช้ส่งลิงก์แบบกดได้ (แทนการฝังเป็น URL ในข้อความ)
export function buildLinkButtonMessage(title, buttonLabel, uri) {
  return {
    type: "flex",
    altText: title,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [{ type: "text", text: title, wrap: true, size: "md" }],
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "button", style: "primary", action: { type: "uri", label: buttonLabel, uri } },
        ],
      },
    },
  };
}

// ปุ่มโทรออกหาเบอร์ติดต่อโดยตรง
export function buildPhoneButtonMessage(name, phone) {
  return buildLinkButtonMessage(
    `ติดต่อ ${name}`,
    "📞 โทร",
    `tel:${phone.replace(/[^0-9+]/g, "")}`
  );
}

// การ์ดต้อนรับตอนบอทถูกเชิญเข้ากลุ่ม
export function buildWelcomeMessage(addFriendUrl) {
  const highlight = (label, text) => [
    { type: "text", text: label, weight: "bold", size: "sm", color: "#0F6E56", margin: "md" },
    { type: "text", text, wrap: true, size: "sm", color: "#555555", margin: "xs" },
  ];

  return {
    type: "flex",
    altText: "ยินดีต้อนรับ! ระบบบันทึกและช่วยรับงาน",
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "🎉 ยินดีต้อนรับ! ระบบบันทึกและช่วยรับงาน",
            weight: "bold",
            size: "md",
            wrap: true,
          },
          ...highlight(
            "✋ ก่อนเริ่มใช้งาน ผู้ที่จะรับงาน",
            'กรุณาเพิ่มเพื่อน JobBotTH ก่อน เพื่อรับงาน หลังจากเพิ่มเพื่อนเสร็จแล้ว กลับมาพิมพ์อะไรก็ได้ในกลุ่มนี้อีกครั้ง ' +
              'เช่น พิมพ์ว่า "พร้อมรับงาน" เพื่อแจ้งให้ระบบทราบว่าพร้อมรับงานกลุ่มนี้ หลังจากนั้นกลับไปดูงานใหม่ในแชทส่วนตัว JobBotTH ได้เลยครับ'
          ),
          ...highlight("⚡ รับงานไว ไม่ต้องโทรอีกต่อไป", 'กดปุ่ม "รับงาน" จากหน้ารับงานได้เลย'),
          ...highlight(
            "📝 โพสต์งานได้จากหน้าระบบ",
            "เปิดหน้าโพสต์งานในแชทส่วนตัว เลือกกลุ่มที่จะส่งได้ โพสต์ได้ทั้งทีละงานหรือหลายงานพร้อมกัน"
          ),
          ...highlight(
            "📊 มีประวัติเก็บให้ครบทุกงาน",
            "ดูย้อนหลังได้ว่ารับงานเมื่อไร วันไหน พร้อมสรุปรายได้รายวัน/สัปดาห์/เดือน/ปี"
          ),
          ...highlight(
            "🔒 เบอร์ติดต่อลูกค้าส่งตรงส่วนตัว",
            "ปลอดภัย เป็นระเบียบ ไม่ต้องเผยแพร่ข้อมูลในกลุ่มหลัก"
          ),
        ],
      },
      footer: addFriendUrl
        ? {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: "กรุณาเพิ่มเพื่อน JobBotTH เพื่อเริ่มรับงานได้เลยครับ",
                wrap: true,
                size: "sm",
                color: "#555555",
                margin: "md",
              },
              {
                type: "button",
                style: "primary",
                action: { type: "uri", label: "➕ เพิ่มเพื่อน JobBotTH", uri: addFriendUrl },
              },
            ],
          }
        : undefined,
    },
  };
}

const LOW_CREDIT_THRESHOLD = 20;

// การ์ดเดียวส่งให้ผู้รับงานหลังกดรับสำเร็จ รวมรายละเอียดงาน/เจ้าของงาน/เครดิต/ปุ่มจัดการทั้งหมด
export function buildClaimedCard(job, poster, claim, balance, claimer = null) {
  const mgmt = process.env.NEXT_PUBLIC_MGMT_LIFF_ID;
  const completeUri = mgmt
    ? `https://liff.line.me/${mgmt}?tab=complete&job=${job.id}`
    : "#";
  const returnUri = mgmt ? `https://liff.line.me/${mgmt}?tab=return&job=${job.id}` : "#";

  const bodyContents = [
    {
      type: "text",
      text: job.is_urgent ? "คุณรับงานแล้ว --ด่วน" : "คุณรับงานแล้ว",
      weight: "bold",
      size: "lg",
      color: job.is_urgent ? "#FF0000" : "#000000",
    },
    { type: "text", text: job.detail, wrap: true, margin: "md", size: "lg", weight: "bold" },
    // งานที่โพสต์เป็นชุด (มี job_code) แนบข้อมูลรถ+คนขับกลับไปให้ในตัว เผื่อเอาไปโชว์ลูกค้า/รปภ.สนามบิน
    ...(job.job_code && claimer
      ? [
          {
            type: "box",
            layout: "vertical",
            margin: "md",
            contents: [
              ...(job.requested_vehicle_type
                ? [{ type: "text", text: job.requested_vehicle_type, size: "md", weight: "bold" }]
                : []),
              { type: "text", text: `Driver : ${displayNameOf(claimer)}`, size: "sm", wrap: true },
              ...(claimer.vehicle_model
                ? [{ type: "text", text: `Car : ${claimer.vehicle_model}`, size: "sm", wrap: true }]
                : []),
              ...(claimer.vehicle_plate
                ? [{ type: "text", text: `Plate : ${claimer.vehicle_plate}`, size: "sm" }]
                : []),
              ...(claimer.phone
                ? [{ type: "text", text: `Tel : ${claimer.phone}`, size: "sm" }]
                : []),
            ],
          },
        ]
      : []),
    { type: "separator", margin: "md" },
    {
      type: "box",
      layout: "vertical",
      margin: "md",
      contents: [
        {
          type: "text",
          text: `ค่าจ้าง: ${job.wage} บาท`,
          size: "lg",
          weight: "bold",
        },
      ],
    },
    {
      type: "text",
      text: formatThaiDateTime(claim.claimed_at),
      size: "sm",
      color: "#888888",
      margin: "md",
    },
    { type: "separator", margin: "lg" },
    {
      type: "box",
      layout: "vertical",
      margin: "lg",
      contents: [
        { type: "text", text: "เจ้าของงาน", size: "xs", color: "#888888" },
        { type: "text", text: displayNameOf(poster), size: "md", margin: "sm" },
        ...(poster?.phone
          ? [
              {
                type: "text",
                text: `📞 ${poster.phone}`,
                size: "md",
                color: "#06C755",
                decoration: "underline",
                margin: "sm",
                action: {
                  type: "uri",
                  uri: `tel:${poster.phone.replace(/[^0-9+]/g, "")}`,
                },
              },
            ]
          : []),
      ],
    },
    ...(claim.platform_fee > 0
      ? [
          {
            type: "box",
            layout: "vertical",
            margin: "lg",
            contents: [
              { type: "text", text: `คุณใช้เครดิตไป: ${claim.platform_fee}`, size: "sm" },
              {
                type: "text",
                text: `เครดิตคงเหลือ: ${balance}`,
                size: "sm",
                weight: "bold",
                margin: "sm",
              },
              ...(balance <= LOW_CREDIT_THRESHOLD
                ? [
                    {
                      type: "text",
                      text: "⚠️ เครดิตใกล้หมด กรุณาเติมเครดิต",
                      size: "xs",
                      color: "#E24B4A",
                      wrap: true,
                      margin: "sm",
                    },
                  ]
                : []),
            ],
          },
        ]
      : []),
  ];

  const buttons = [
    {
      type: "button",
      style: "primary",
      action: { type: "uri", label: "✅ จบงาน", uri: completeUri },
    },
    {
      type: "button",
      style: "secondary",
      action: { type: "uri", label: "↩️ คืนงาน", uri: returnUri },
    },
  ];

  return {
    type: "flex",
    altText: "คุณรับงานแล้ว",
    contents: {
      type: "bubble",
      body: { type: "box", layout: "vertical", contents: bodyContents },
      footer: { type: "box", layout: "vertical", spacing: "sm", contents: buttons },
    },
  };
}

export async function getJobWithPoster(jobId) {
  const { data, error } = await supabase
    .from("jobs")
    .select(
      "*, poster:poster_id(id, line_user_id, display_name, first_name, last_name, phone), group:group_id(line_group_id)"
    )
    .eq("id", jobId)
    .single();

  if (error) throw error;
  return data;
}

export async function saveJobQuoteToken(jobId, quoteToken) {
  if (!quoteToken) return;
  await supabase.from("jobs").update({ line_quote_token: quoteToken }).eq("id", jobId);
}

// งาน + claim ที่ยัง active ของ claimer คนนี้ (ใช้ตรวจสิทธิ์ก่อนจบ/คืนงาน)
export async function getActiveClaimForUser(jobId, claimerId) {
  const { data, error } = await supabase
    .from("job_claims")
    .select("*")
    .eq("job_id", jobId)
    .eq("claimed_by", claimerId)
    .is("released_at", null)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// รายละเอียดงานแบบเต็ม (สถานะปัจจุบัน/ประวัติการคืนงาน/รายละเอียดปิดงาน) ใช้ทั้งฝั่งผู้เปิดงานและผู้รับงาน
export async function getJobCloseDetails(jobId, viewerId = null) {
  const { data, error } = await supabase
    .from("jobs")
    .select(
      "id, detail, wage, payment_method, status, poster_id, job_code, poster:poster_id(display_name, phone), group:group_id(group_name), claims:job_claims(claimed_at, released_at, delivery_at, delivery_note, delivery_photo_url, claimer:claimed_by(display_name, phone))"
    )
    .eq("id", jobId)
    .single();

  if (error) throw error;

  const isViewerPoster = viewerId != null && viewerId === data.poster_id;
  const posterName = data.poster?.display_name ?? "-";
  const posterPhone = data.poster?.phone ?? null;

  const claims = (data.claims ?? [])
    .slice()
    .sort((a, b) => new Date(a.claimed_at) - new Date(b.claimed_at));

  const returns = claims
    .filter((c) => c.released_at)
    .map((c) => ({ claimerName: c.claimer?.display_name ?? "-", releasedAt: c.released_at }));

  // ถ้าผู้ดูเป็นคนโพสต์งาน ให้แสดงข้อมูลผู้รับงาน (คู่สัญญาอีกฝั่ง) และในทางกลับกัน
  function toCounterparty(claim) {
    if (!claim) return null;
    return {
      claimedAt: claim.claimed_at,
      deliveryAt: claim.delivery_at,
      deliveryNote: claim.delivery_note,
      deliveryPhotoUrl: claim.delivery_photo_url,
      counterpartyLabel: isViewerPoster ? "ผู้รับงาน" : "เจ้าของงาน",
      counterpartyName: isViewerPoster ? (claim.claimer?.display_name ?? "-") : posterName,
      counterpartyPhone: isViewerPoster ? (claim.claimer?.phone ?? null) : posterPhone,
    };
  }

  const currentClaim = toCounterparty(claims.find((c) => !c.released_at && !c.delivery_at) ?? null);
  const doneClaim = toCounterparty(claims.find((c) => c.delivery_at) ?? null);

  const now = Date.now();
  const totalServiceMs = claims.reduce((sum, c) => {
    const start = new Date(c.claimed_at).getTime();
    const end = c.released_at
      ? new Date(c.released_at).getTime()
      : c.delivery_at
        ? new Date(c.delivery_at).getTime()
        : now;
    return sum + Math.max(0, end - start);
  }, 0);

  return {
    id: data.id,
    detail: data.detail,
    wage: data.wage,
    paymentMethod: data.payment_method,
    status: data.status,
    jobCode: data.job_code,
    groupName: data.group?.group_name ?? null,
    returns,
    currentClaim,
    doneClaim,
    totalServiceMs,
  };
}

export function buildJobCardMessage(
  job,
  poster,
  { showClaimButton = true, returnedBy = null, returnedAt = null } = {}
) {
  const headerBase = job.is_urgent ? "🔥 งานใหม่ - ด่วน!!!" : "📋 งานใหม่";
  const headerText = returnedBy ? `${headerBase} --คืนงาน` : headerBase;

  return {
    type: "flex",
    altText: `${headerText}: ${job.detail}`,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: headerText,
            weight: "bold",
            size: "md",
            color: job.is_urgent ? "#FF0000" : "#000000",
          },
          { type: "text", text: job.detail, wrap: true, margin: "sm", size: "md", weight: "bold" },
          { type: "separator", margin: "md" },
          {
            type: "box",
            layout: "vertical",
            margin: "md",
            spacing: "xs",
            contents: [
              {
                type: "text",
                text: `ค่าจ้าง: ${job.wage} บาท`,
                size: "md",
                weight: "bold",
              },
              {
                type: "text",
                text: `วิธีจ่ายเงิน: ${job.payment_method}`,
                size: "md",
                weight: "bold",
              },
              ...(job.requested_vehicle_type
                ? [
                    {
                      type: "text",
                      text: `ประเภทรถ: ${job.requested_vehicle_type}`,
                      size: "sm",
                      color: "#888888",
                    },
                  ]
                : []),
            ],
          },
          { type: "separator", margin: "md" },
          {
            type: "box",
            layout: "vertical",
            margin: "md",
            spacing: "xs",
            contents: [
              {
                type: "text",
                text: `ผู้เปิดงาน: ${poster.display_name ?? "-"}`,
                size: "sm",
                color: "#888888",
                wrap: true,
              },
              {
                type: "text",
                text: formatThaiDateTime(job.created_at),
                size: "sm",
                color: "#888888",
              },
              ...(poster.phone
                ? [
                    {
                      type: "text",
                      text: `📞 โทร: ${poster.phone}`,
                      size: "sm",
                      color: "#06C755",
                      margin: "sm",
                      decoration: "underline",
                      action: {
                        type: "uri",
                        uri: `tel:${poster.phone.replace(/[^0-9+]/g, "")}`,
                      },
                    },
                  ]
                : []),
              ...(returnedBy
                ? [
                    {
                      type: "text",
                      text: `คืนงานโดย ${returnedBy}`,
                      size: "sm",
                      color: "#888888",
                      margin: "md",
                      wrap: true,
                    },
                    {
                      type: "text",
                      text: formatThaiDateTime(returnedAt),
                      size: "sm",
                      color: "#888888",
                    },
                  ]
                : []),
            ],
          },
        ],
      },
      ...(showClaimButton
        ? {
            footer: {
              type: "box",
              layout: "vertical",
              contents: [
                {
                  type: "button",
                  style: "primary",
                  action: claimAction(job.id),
                },
              ],
            },
          }
        : {}),
    },
  };
}

