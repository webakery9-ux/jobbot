import { supabase } from "./supabase";

const URGENT_KEYWORDS = ["งานด่วน", "ด่วน"];
const VEHICLE_KEYWORDS = ["เก๋ง", "SUV", "VAN", "รถตู้", "ตู้"];

// ปุ่มกดรับงานเปิดหน้า LIFF ส่วนตัวของแต่ละคน (จัดการเพิ่มเพื่อน/กรอกข้อมูล/รับงานในที่เดียว ไม่รบกวนกลุ่ม)
function claimAction(jobId) {
  const mgmt = process.env.NEXT_PUBLIC_MGMT_LIFF_ID;
  if (mgmt) {
    return {
      type: "uri",
      label: "กดรับงาน",
      uri: `https://liff.line.me/${mgmt}?tab=claim&job=${jobId}`,
    };
  }
  return { type: "postback", label: "กดรับงาน", data: `action=claim&job_id=${jobId}` };
}

// รูปแบบ: /job [ด่วน] [เก๋ง|SUV|VAN|ตู้] รายละเอียด ราคา วิธีจ่ายเงิน (คั่นด้วยเว้นวรรคหรือ /)
// ตัดจากตัวเลข (ราคา) ตัวสุดท้ายในข้อความ เพื่อไม่ให้ตัวเลขในรายละเอียดงานมากวนพาร์ส
// วิธีจ่ายเงินไม่ตรวจสอบรูปแบบ รับข้อความที่พิมพ์มาตรงๆ ได้ทุกแบบ
// "ด่วน" และประเภทรถ เป็น prefix ที่ไม่บังคับ จะพิมพ์ลำดับไหนก่อนก็ได้
export function parseJobCommand(text) {
  const withoutCmd = text.replace(/^\/(job|งาน)\s*/i, "");

  let isUrgent = false;
  let vehicleType = null;
  let rest = withoutCmd;

  let matched = true;
  while (matched) {
    matched = false;

    if (!isUrgent) {
      for (const kw of URGENT_KEYWORDS) {
        const re = new RegExp(`^${kw}\\s+`, "i");
        if (re.test(rest)) {
          isUrgent = true;
          rest = rest.replace(re, "");
          matched = true;
          break;
        }
      }
    }
    if (matched) continue;

    if (!vehicleType) {
      for (const kw of VEHICLE_KEYWORDS) {
        const re = new RegExp(`^${kw}\\s+`, "i");
        if (re.test(rest)) {
          vehicleType = kw;
          rest = rest.replace(re, "");
          matched = true;
          break;
        }
      }
    }
  }

  const normalized = rest.replace(/\//g, " ").trim();

  const match = normalized.match(/^(.+)\s+(\d+(?:\.\d+)?)\s+(.+)$/);
  if (!match) return null;

  const [, detailRaw, wageStr, paymentRaw] = match;
  const detail = detailRaw.trim();
  const wage = parseFloat(wageStr);
  const payment_method = paymentRaw.trim();
  if (!detail || isNaN(wage) || wage <= 0 || !payment_method) return null;

  return { detail, wage, payment_method, isUrgent, vehicleType };
}

// ชื่อที่ใช้แสดง: ชื่อ LINE ก่อน ถ้าไม่มีใช้ชื่อ-นามสกุลที่กรอก ถ้าไม่มีอีกใช้ "-"
export function displayNameOf(user) {
  if (user?.display_name) return user.display_name;
  const full = [user?.first_name, user?.last_name].filter(Boolean).join(" ");
  return full || "-";
}

// ข้อความในกลุ่มตอนงานถูกรับ แสดงชื่อผู้รับงาน/เจ้าของงาน
// (mention แท็กจริงต้องใช้ OA ที่ยืนยันบัญชีแล้ว จึงแสดงเป็นชื่อธรรมดาไปก่อน)
export function buildGroupClaimedMessage(claimer, poster, quoteToken) {
  const text =
    "✅ งานนี้ถูกรับแล้ว\n\n" +
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

export async function postJob({
  posterId,
  groupId,
  detail,
  wage,
  paymentMethod,
  isUrgent,
  vehicleType,
}) {
  const { data, error } = await supabase.rpc("post_job", {
    p_poster_id: posterId,
    p_group_id: groupId,
    p_detail: detail,
    p_wage: wage,
    p_payment_method: paymentMethod,
    p_is_urgent: !!isUrgent,
    p_requested_vehicle_type: vehicleType ?? null,
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
export function buildWelcomeMessage(guideUrl) {
  const highlight = (label, text) => [
    { type: "text", text: label, weight: "bold", size: "sm", color: "#0F6E56", margin: "md" },
    { type: "text", text, wrap: true, size: "sm", color: "#555555", margin: "xs" },
  ];

  return {
    type: "flex",
    altText: "ยินดีต้อนรับ! ผู้ช่วยจ่ายงาน-รับงานอัตโนมัติ",
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "🎉 ยินดีต้อนรับ! ผู้ช่วยจ่ายงาน-รับงานอัตโนมัติ",
            weight: "bold",
            size: "md",
            wrap: true,
          },
          ...highlight("⚡ รับงานไว ไม่ต้องโทรอีกต่อไป", 'กดปุ่ม "รับงาน" บนการ์ด ใครกดก่อนได้งานก่อนทันที'),
          ...highlight(
            "📝 โพสต์งานได้จากหน้าระบบ",
            "พิมพ์คำสั่งในกลุ่ม หรือเปิดหน้าโพสต์งานในแชทส่วนตัว เลือกกลุ่มที่จะส่งได้เอง"
          ),
          ...highlight(
            "📊 มีประวัติเก็บให้ครบทุกงาน",
            "ดูย้อนหลังได้ว่าจ่ายให้ใคร รับจากใคร วันไหน พร้อมสรุปรายได้รายวัน/สัปดาห์/เดือน/ปี"
          ),
          ...highlight(
            "🔒 เบอร์ติดต่อส่งตรงส่วนตัว ไม่ปนในกลุ่ม",
            "ปลอดภัย เป็นระเบียบ ไม่ต้องเผยแพร่ข้อมูลในกลุ่มหลัก"
          ),
        ],
      },
      footer: guideUrl
        ? {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "button",
                style: "primary",
                action: { type: "uri", label: "📖 ดูวิธีใช้งานแบบละเอียด", uri: guideUrl },
              },
            ],
          }
        : undefined,
    },
  };
}

const LOW_CREDIT_THRESHOLD = 20;

// การ์ดเดียวส่งให้ผู้รับงานหลังกดรับสำเร็จ รวมรายละเอียดงาน/เจ้าของงาน/เครดิต/ปุ่มจัดการทั้งหมด
export function buildClaimedCard(job, poster, claim, balance) {
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
        {
          type: "text",
          text: `วิธีจ่ายเงิน: ${job.payment_method}`,
          size: "lg",
          weight: "bold",
        },
        ...(job.requested_vehicle_type
          ? [
              {
                type: "text",
                text: `ประเภทรถ: ${job.requested_vehicle_type}`,
                size: "sm",
              },
            ]
          : []),
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
      "id, detail, wage, payment_method, status, poster_id, poster:poster_id(display_name, phone), group:group_id(group_name), claims:job_claims(claimed_at, released_at, delivery_at, delivery_note, delivery_photo_url, claimer:claimed_by(display_name, phone))"
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
            size: "lg",
            color: job.is_urgent ? "#FF0000" : "#000000",
          },
          { type: "text", text: job.detail, wrap: true, margin: "md", size: "lg", weight: "bold" },
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
              {
                type: "text",
                text: `วิธีจ่ายเงิน: ${job.payment_method}`,
                size: "lg",
                weight: "bold",
              },
              ...(job.requested_vehicle_type
                ? [
                    {
                      type: "text",
                      text: `ประเภทรถ: ${job.requested_vehicle_type}`,
                      size: "md",
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
            contents: [
              {
                type: "text",
                text: `ผู้เปิดงาน: ${poster.display_name ?? "-"}`,
                size: "md",
                color: "#888888",
                wrap: true,
              },
              {
                type: "text",
                text: formatThaiDateTime(job.created_at),
                size: "md",
                color: "#888888",
              },
              ...(poster.phone
                ? [
                    {
                      type: "text",
                      text: `📞 โทร: ${poster.phone}`,
                      size: "md",
                      color: "#06C755",
                      margin: "lg",
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
                      size: "md",
                      color: "#888888",
                      margin: "xxl",
                      wrap: true,
                    },
                    {
                      type: "text",
                      text: formatThaiDateTime(returnedAt),
                      size: "md",
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

// การ์ดยืนยันเปิดงานสำเร็จ ส่งเข้าแชทส่วนตัวผู้เปิดงาน รวมทุกอย่างในการ์ดเดียว ไม่แยกส่งข้อความซ้ำ
export function buildJobPostedCard(job, balance, extraNote) {
  const headerText = job.is_urgent ? "คุณเปิดงานแล้ว --ด่วน" : "คุณเปิดงานแล้ว";

  const creditBoxContents = [];
  if (job.platform_fee > 0) {
    creditBoxContents.push({ type: "text", text: `คุณใช้เครดิตไป: ${job.platform_fee}`, size: "sm" });
    creditBoxContents.push({
      type: "text",
      text: `เครดิตคงเหลือ: ${balance}`,
      size: "sm",
      weight: "bold",
      margin: "sm",
    });
    if (balance <= LOW_CREDIT_THRESHOLD) {
      creditBoxContents.push({
        type: "text",
        text: "⚠️ เครดิตใกล้หมด กรุณาเติมเครดิต",
        size: "xs",
        color: "#E24B4A",
        wrap: true,
        margin: "sm",
      });
    }
  }
  if (extraNote) {
    creditBoxContents.push({
      type: "text",
      text: extraNote,
      size: "xs",
      color: "#888888",
      wrap: true,
      margin: "sm",
    });
  }

  return {
    type: "flex",
    altText: job.is_urgent ? `[ด่วน] เปิดงานสำเร็จ: ${job.detail}` : `เปิดงานสำเร็จ: ${job.detail}`,
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
            size: "lg",
            color: job.is_urgent ? "#FF0000" : "#000000",
          },
          { type: "text", text: job.detail, wrap: true, margin: "md", size: "lg", weight: "bold" },
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
              {
                type: "text",
                text: `วิธีจ่ายเงิน: ${job.payment_method}`,
                size: "lg",
                weight: "bold",
              },
              ...(job.requested_vehicle_type
                ? [
                    {
                      type: "text",
                      text: `ประเภทรถ: ${job.requested_vehicle_type}`,
                      size: "sm",
                    },
                  ]
                : []),
            ],
          },
          {
            type: "text",
            text: formatThaiDateTime(job.created_at),
            size: "sm",
            color: "#888888",
            margin: "md",
          },
          ...(creditBoxContents.length > 0
            ? [{ type: "box", layout: "vertical", margin: "lg", contents: creditBoxContents }]
            : []),
        ],
      },
    },
  };
}
