import { supabase } from "./supabase";

const PAYMENT_KEYWORDS = [
  { match: ["โอนทันที"], value: "transfer_now" },
  { match: ["โอน24ชม", "โอน24"], value: "transfer_24h" },
  { match: ["เก็บปลายทาง", "ปลายทาง"], value: "cod" },
];

const PAYMENT_LABELS = {
  transfer_now: "โอนทันที",
  transfer_24h: "โอน 24 ชม.",
  cod: "เก็บปลายทาง",
};

// รูปแบบ: /job รายละเอียด | ราคา | วิธีจ่ายเงิน
export function parseJobCommand(text) {
  const withoutCmd = text.replace(/^\/job\s*/i, "");
  const parts = withoutCmd.split("|").map((s) => s.trim());
  if (parts.length !== 3) return null;

  const [detail, wageStr, paymentRaw] = parts;
  const wage = parseFloat(wageStr);
  if (!detail || isNaN(wage) || wage <= 0) return null;

  const normalized = paymentRaw.replace(/\s|\./g, "");
  const found = PAYMENT_KEYWORDS.find((k) =>
    k.match.some((m) => normalized.includes(m))
  );
  if (!found) return null;

  return { detail, wage, payment_method: found.value };
}

export function paymentLabel(paymentMethod) {
  return PAYMENT_LABELS[paymentMethod] ?? paymentMethod;
}

export async function postJob({ posterId, groupId, detail, wage, paymentMethod }) {
  const { data, error } = await supabase.rpc("post_job", {
    p_poster_id: posterId,
    p_group_id: groupId,
    p_detail: detail,
    p_wage: wage,
    p_payment_method: paymentMethod,
  });

  if (error) throw error;
  return data;
}

export function buildJobCardMessage(job) {
  return {
    type: "flex",
    altText: `งานใหม่: ${job.detail}`,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "📋 งานใหม่", weight: "bold", size: "lg" },
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
