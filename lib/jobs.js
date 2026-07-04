import { supabase } from "./supabase";

const PAYMENT_KEYWORDS = [
  { match: ["โอนทันที", "ทันที"], value: "transfer_now" },
  { match: ["โอน24ชม", "โอน24", "24ชม"], value: "transfer_24h" },
  { match: ["เก็บปลายทาง", "ปลายทาง", "เก็บลูกค้า"], value: "cod" },
];

const PAYMENT_LABELS = {
  transfer_now: "โอนทันที",
  transfer_24h: "โอน 24 ชม.",
  cod: "เก็บปลายทาง",
};

// รูปแบบ: /job [งานด่วน|ด่วน] รายละเอียด ราคา วิธีจ่ายเงิน (คั่นด้วยเว้นวรรคหรือ /)
// ตัดจากตัวเลข (ราคา) ตัวสุดท้ายในข้อความ เพื่อไม่ให้ตัวเลขในรายละเอียดงานมากวนพาร์ส
export function parseJobCommand(text) {
  const withoutCmd = text.replace(/^\/job\s*/i, "");

  let isUrgent = false;
  let rest = withoutCmd;
  const urgentMatch = rest.match(/^(งานด่วน|ด่วน)\s+(.*)$/);
  if (urgentMatch) {
    isUrgent = true;
    rest = urgentMatch[2];
  }

  const normalized = rest.replace(/\//g, " ").trim();

  const match = normalized.match(/^(.+)\s+(\d+(?:\.\d+)?)\s+(.+)$/);
  if (!match) return null;

  const [, detailRaw, wageStr, paymentRaw] = match;
  const detail = detailRaw.trim();
  const wage = parseFloat(wageStr);
  if (!detail || isNaN(wage) || wage <= 0) return null;

  const normalizedPayment = paymentRaw.replace(/\s|\./g, "");
  const found = PAYMENT_KEYWORDS.find((k) =>
    k.match.some((m) => normalizedPayment.includes(m))
  );
  if (!found) return null;

  return { detail, wage, payment_method: found.value, isUrgent };
}

export function paymentLabel(paymentMethod) {
  return PAYMENT_LABELS[paymentMethod] ?? paymentMethod;
}

export async function postJob({ posterId, groupId, detail, wage, paymentMethod, isUrgent }) {
  const { data, error } = await supabase.rpc("post_job", {
    p_poster_id: posterId,
    p_group_id: groupId,
    p_detail: detail,
    p_wage: wage,
    p_payment_method: paymentMethod,
    p_is_urgent: !!isUrgent,
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
    .select("*, poster:poster_id(id, line_user_id, display_name, phone)")
    .eq("id", jobId)
    .single();

  if (error) throw error;
  return data;
}

export function buildJobCardMessage(job, poster) {
  const created = new Date(job.created_at);
  const dateStr = created.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });
  const timeStr = created.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  });

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
          { type: "text", text: job.detail, wrap: true, margin: "md" },
          {
            type: "box",
            layout: "vertical",
            margin: "md",
            contents: [
              { type: "text", text: `ค่าจ้าง: ${job.wage} บาท`, size: "sm" },
              {
                type: "text",
                text: `จ่ายเงิน: ${paymentLabel(job.payment_method)}`,
                size: "sm",
              },
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
                size: "xs",
                color: "#888888",
              },
              {
                type: "text",
                text: `${dateStr} ${timeStr} น.`,
                size: "xs",
                color: "#888888",
              },
            ],
          },
        ],
      },
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
    },
  };
}
