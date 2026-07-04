import { supabase } from "./supabase";

const URGENT_KEYWORDS = ["งานด่วน", "ด่วน"];
const VEHICLE_KEYWORDS = ["เก๋ง", "SUV", "VAN", "ตู้"];

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

export async function getJobWithPoster(jobId) {
  const { data, error } = await supabase
    .from("jobs")
    .select(
      "*, poster:poster_id(id, line_user_id, display_name, phone), group:group_id(line_group_id)"
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
                      text: `ติดต่อ: ${poster.phone}`,
                      size: "md",
                      color: "#888888",
                      margin: "lg",
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
                  action: {
                    type: "postback",
                    label: "กดรับงาน",
                    data: `action=claim&job_id=${job.id}`,
                  },
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
  return {
    type: "flex",
    altText: `เปิดงานสำเร็จ: ${job.detail}`,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "✅ เปิดงานสำเร็จ", weight: "bold", size: "lg" },
          { type: "text", text: job.detail, wrap: true, margin: "md", size: "md" },
          {
            type: "box",
            layout: "vertical",
            margin: "md",
            contents: [
              { type: "text", text: `ค่าจ้าง: ${job.wage} บาท`, size: "md" },
              { type: "text", text: `จ่ายเงิน: ${job.payment_method}`, size: "md" },
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
