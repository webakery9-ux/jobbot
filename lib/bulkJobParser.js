// แยกข้อความยาวๆ ที่วางมาทีเดียว (คั่นแต่ละงานด้วยบรรทัด ---) ออกเป็นงานย่อยหลายงาน
// ใช้ได้ทั้งฝั่ง client (พรีวิวสด ไม่ต้องยิง server) และฝั่ง server (แยกไว้เผื่ออนาคต จึงไม่ import อะไรเลย)

const SEPARATOR_RE = /^-{3,}\s*$/;
// บรรทัดสุดท้ายของแต่ละงานต้อง: ประเภทรถ (เว้นวรรค) ราคา เช่น "EV-SUV 450"
const VEHICLE_WAGE_RE = /^(.+?)\s+([\d]+(?:\.\d+)?)$/;

function splitBlocks(rawText) {
  const lines = rawText.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let current = [];
  for (const line of lines) {
    if (SEPARATOR_RE.test(line)) {
      blocks.push(current);
      current = [];
    } else {
      current.push(line);
    }
  }
  blocks.push(current);
  // ตัดบรรทัดว่างหัว-ท้ายบล็อกออก แล้วทิ้งบล็อกที่ว่างเปล่าทั้งอัน
  return blocks
    .map((linesArr) => {
      let start = 0;
      let end = linesArr.length;
      while (start < end && linesArr[start].trim() === "") start++;
      while (end > start && linesArr[end - 1].trim() === "") end--;
      return linesArr.slice(start, end);
    })
    .filter((linesArr) => linesArr.length > 0);
}

function extractField(blockText, label) {
  const re = new RegExp(`^${label}:\\s*(.+)$`, "im");
  const m = blockText.match(re);
  return m ? m[1].trim() : "";
}

function extractTime(blockText) {
  const m = blockText.match(/\b(\d{1,2}:\d{2})\b/);
  return m ? m[1] : "";
}

// สร้างบรรทัดสรุปย่อ 3 บรรทัดสำหรับข้อความรวมในกลุ่ม (ขาดข้อมูลไหนก็ข้ามไปเงียบๆ ไม่บล็อกการโพสต์)
function buildPreviewLine({ jobCode, blockText, vehicleType, wage }) {
  const time = extractTime(blockText);
  const flight = extractField(blockText, "Flight number");
  const passengers = extractField(blockText, "No\\. of passengers");
  const from = extractField(blockText, "From");
  const to = extractField(blockText, "To");

  const line1 = [jobCode, time, flight].filter(Boolean).join(" ");
  const line2 = from || to ? `${from || "-"} – ${to || "-"}` : "";
  const line3 = `${vehicleType}${passengers ? ` (${passengers})` : ""} ${wage}`;

  return [line1, line2, line3].filter(Boolean).join("\n");
}

// rawText: ข้อความทั้งก้อนที่วางมา, batchCode: prefix เช่น "XJ"
// คืนค่า { jobs: [{ seq, jobCode, detail, wage, vehicleType, previewLine }], errors: [{ blockIndex, preview, message }] }
export function parseBulkJobsText(rawText, batchCode) {
  const blocks = splitBlocks(rawText || "");
  const jobs = [];
  const errors = [];

  blocks.forEach((linesArr, idx) => {
    const seq = idx + 1;
    const jobCode = `${batchCode || ""}${seq}`;

    // หาบรรทัดสุดท้ายที่ไม่ว่าง เพื่อดึงประเภทรถ+ราคา
    let lastIdx = linesArr.length - 1;
    while (lastIdx >= 0 && linesArr[lastIdx].trim() === "") lastIdx--;

    if (lastIdx < 0) {
      errors.push({ blockIndex: idx, preview: "", message: "บล็อกว่างเปล่า" });
      return;
    }

    const lastLine = linesArr[lastIdx].trim();
    const match = lastLine.match(VEHICLE_WAGE_RE);

    if (!match) {
      errors.push({
        blockIndex: idx,
        preview: linesArr.join("\n"),
        message: `บรรทัดสุดท้ายต้องเป็น "ประเภทรถ ราคา" เช่น "EV-SUV 450" (เจอ: "${lastLine}")`,
      });
      return;
    }

    const vehicleType = match[1].trim();
    const wage = parseFloat(match[2]);
    if (!vehicleType || isNaN(wage) || wage <= 0) {
      errors.push({
        blockIndex: idx,
        preview: linesArr.join("\n"),
        message: `ราคาต้องมากกว่า 0 (เจอ: "${lastLine}")`,
      });
      return;
    }

    const detailLines = linesArr.slice(0, lastIdx);
    while (detailLines.length && detailLines[detailLines.length - 1].trim() === "") {
      detailLines.pop();
    }
    const detail = detailLines.join("\n").trim();

    if (!detail) {
      errors.push({ blockIndex: idx, preview: lastLine, message: "ไม่พบรายละเอียดงาน" });
      return;
    }

    jobs.push({
      seq,
      jobCode,
      detail,
      wage,
      vehicleType,
      previewLine: buildPreviewLine({ jobCode, blockText: detail, vehicleType, wage }),
    });
  });

  return { jobs, errors };
}
