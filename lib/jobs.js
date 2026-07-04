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
    "✅ งานนี้ถูกรับแล้ว\n" +
    `ผู้รับงาน ${displayNameOf(claimer)}\n` +
    `เจ้าของงาน ${displayNameOf(poster)}`;

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

// การ์ดส่งให้ผู้รับงานหลังกดรับสำเร็จ มีปุ่มจบงาน/คืนงาน (เปิดหน้า LIFF จัดการ)
export function buildClaimedActionsCard(job) {
  const mgmt = process.env.NEXT_PUBLIC_MGMT_LIFF_ID;
  const completeUri = mgmt
    ? `https://liff.line.me/${mgmt}?tab=complete&job=${job.id}`
    : "#";
  const returnUri = mgmt ? `https://liff.line.me/${mgmt}?tab=return&job=${job.id}` : "#";

  return {
    type: "flex",
    altText: "จัดการงานที่รับ",
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "งานที่กำลังทำอยู่", weight: "bold", size: "lg" },
          { type: "text", text: job.detail, wrap: true, margin: "md", size: "md" },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
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
        ],
      },
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

// รายละเอียดปิดงาน (โชว์ให้ผู้เปิดงานดู)
export async function getJobCloseDetails(jobId) {
  const { data, error } = await supabase
    .from("jobs")
    .select(
      "id, detail, wage, status, poster:poster_id(display_name), claim:job_claims(delivery_at, delivery_note, delivery_photo_url, claimed_at, claimer:claimed_by(display_name, phone))"
    )
    .eq("id", jobId)
    .single();

  if (error) throw error;
  const claim = Array.isArray(data.claim)
    ? data.claim.find((c) => c.delivery_at) ?? data.claim[0]
    : data.claim;
  return { ...data, claim };
}

export function buildJobCardMessage(job, poster, { showClaimButton = true } = {}) {
  const headerText = job.is_urgent ? "🔥 งานใหม่ - ด่วน!!!" : "📋 งานใหม่";

  return {
    type: "flex",
    altText: job.is_urgent ? `[ด่วน] ${job.detail}` : `งานใหม่: ${job.detail}`,
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
          { type: "text", text: job.detail, wrap: true, margin: "md", size: "md" },
          {
            type: "box",
            layout: "vertical",
            margin: "md",
            contents: [
              { type: "text", text: `ค่าจ้าง: ${job.wage} บาท`, size: "md" },
              {
                type: "text",
                text: `จ่ายเงิน: ${job.payment_method}`,
                size: "md",
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
export function buildJobPostedCard(job, noticeText) {
  const headerText = job.is_urgent ? "✅ เปิดงานสำเร็จ - ด่วน!!!" : "✅ เปิดงานสำเร็จ";

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
          { type: "text", text: job.detail, wrap: true, margin: "md", size: "md" },
          {
            type: "box",
            layout: "vertical",
            margin: "md",
            contents: [
              { type: "text", text: `ค่าจ้าง: ${job.wage} บาท`, size: "md" },
              { type: "text", text: `จ่ายเงิน: ${job.payment_method}`, size: "md" },
              ...(job.requested_vehicle_type
                ? [
                    {
                      type: "text",
                      text: `ประเภทรถ: ${job.requested_vehicle_type}`,
                      size: "md",
                    },
                  ]
                : []),
              {
                type: "text",
                text: formatThaiDateTime(job.created_at),
                size: "md",
                color: "#888888",
                margin: "md",
              },
            ],
          },
          {
            type: "box",
            layout: "vertical",
            margin: "lg",
            contents: [{ type: "text", text: noticeText, size: "md", wrap: true }],
          },
        ],
      },
    },
  };
}
