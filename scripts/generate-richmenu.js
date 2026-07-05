const sharp = require("sharp");
const path = require("path");

const WIDTH = 2500;
const ROW_H = 490;
const HEIGHT = 980;
const COLS = 3;
const ROWS = 2;
const COL_W = [834, 833, 833];
const CIRCLE_R = 150;
const TOP_MARGIN = 55;
const ICON_LABEL_GAP = 85;
const ACCENT = "#06C755";
const LABEL_COLOR = "#3C3C3C";
const DIVIDER = "#BEBEBE";

const items = [
  { label: "รับงาน", icon: "briefcase" },
  { label: "โพสต์งาน", icon: "plus" },
  { label: "ประวัติงาน", icon: "list" },
  { label: "สรุปรายได้", icon: "chart" },
  { label: "เติมเครดิต", icon: "wallet" },
  { label: "ข้อมูลส่วนตัว", icon: "user" },
];

function iconPath(icon, cx, cy) {
  const s = 1; // scale factor, icon drawn around (cx, cy) radius ~55
  switch (icon) {
    case "briefcase":
      return `
        <rect x="${cx - 55}" y="${cy - 30}" width="110" height="75" rx="10" fill="#fff"/>
        <rect x="${cx - 25}" y="${cy - 50}" width="50" height="28" rx="6" fill="none" stroke="#fff" stroke-width="8"/>
        <line x1="${cx - 55}" y1="${cy}" x2="${cx + 55}" y2="${cy}" stroke="${ACCENT}" stroke-width="8"/>
      `;
    case "plus":
      return `
        <line x1="${cx}" y1="${cy - 50}" x2="${cx}" y2="${cy + 50}" stroke="#fff" stroke-width="16" stroke-linecap="round"/>
        <line x1="${cx - 50}" y1="${cy}" x2="${cx + 50}" y2="${cy}" stroke="#fff" stroke-width="16" stroke-linecap="round"/>
      `;
    case "list":
      return `
        <rect x="${cx - 45}" y="${cy - 55}" width="90" height="110" rx="8" fill="none" stroke="#fff" stroke-width="8"/>
        <line x1="${cx - 25}" y1="${cy - 25}" x2="${cx + 25}" y2="${cy - 25}" stroke="#fff" stroke-width="8" stroke-linecap="round"/>
        <line x1="${cx - 25}" y1="${cy}" x2="${cx + 25}" y2="${cy}" stroke="#fff" stroke-width="8" stroke-linecap="round"/>
        <line x1="${cx - 25}" y1="${cy + 25}" x2="${cx + 25}" y2="${cy + 25}" stroke="#fff" stroke-width="8" stroke-linecap="round"/>
      `;
    case "chart":
      return `
        <rect x="${cx - 50}" y="${cy + 5}" width="26" height="45" rx="4" fill="#fff"/>
        <rect x="${cx - 13}" y="${cy - 25}" width="26" height="75" rx="4" fill="#fff"/>
        <rect x="${cx + 24}" y="${cy - 50}" width="26" height="100" rx="4" fill="#fff"/>
      `;
    case "wallet":
      return `
        <rect x="${cx - 55}" y="${cy - 38}" width="110" height="80" rx="12" fill="none" stroke="#fff" stroke-width="8"/>
        <circle cx="${cx + 30}" cy="${cy + 2}" r="12" fill="#fff"/>
      `;
    case "user":
      return `
        <circle cx="${cx}" cy="${cy - 22}" r="28" fill="#fff"/>
        <path d="M ${cx - 48} ${cy + 55} Q ${cx} ${cy - 5} ${cx + 48} ${cy + 55} Z" fill="#fff"/>
      `;
    default:
      return "";
  }
}

function buildSvg() {
  let cellsSvg = "";
  let x = 0;
  for (let row = 0; row < ROWS; row++) {
    x = 0;
    for (let col = 0; col < COLS; col++) {
      const w = COL_W[col];
      const item = items[row * COLS + col];
      const cx = x + w / 2;
      const circleCy = row * ROW_H + TOP_MARGIN + CIRCLE_R;
      const labelY = circleCy + CIRCLE_R + ICON_LABEL_GAP;

      cellsSvg += `
        <circle cx="${cx}" cy="${circleCy}" r="${CIRCLE_R}" fill="${ACCENT}"/>
        <g transform="translate(${cx},${circleCy}) scale(1.6) translate(${-cx},${-circleCy})">
          ${iconPath(item.icon, cx, circleCy)}
        </g>
        <text x="${cx}" y="${labelY}" text-anchor="middle" font-family="Tahoma, Arial, sans-serif" font-size="68" font-weight="bold" fill="${LABEL_COLOR}">${item.label}</text>
      `;
      x += w;
    }
  }

  let dividers = "";
  dividers += `<line x1="${COL_W[0]}" y1="0" x2="${COL_W[0]}" y2="${ROW_H}" stroke="${DIVIDER}" stroke-width="6"/>`;
  dividers += `<line x1="${COL_W[0] + COL_W[1]}" y1="0" x2="${COL_W[0] + COL_W[1]}" y2="${ROW_H}" stroke="${DIVIDER}" stroke-width="6"/>`;
  dividers += `<line x1="${COL_W[0]}" y1="${ROW_H}" x2="${COL_W[0]}" y2="${HEIGHT}" stroke="${DIVIDER}" stroke-width="6"/>`;
  dividers += `<line x1="${COL_W[0] + COL_W[1]}" y1="${ROW_H}" x2="${COL_W[0] + COL_W[1]}" y2="${HEIGHT}" stroke="${DIVIDER}" stroke-width="6"/>`;
  dividers += `<line x1="0" y1="${ROW_H}" x2="${WIDTH}" y2="${ROW_H}" stroke="${DIVIDER}" stroke-width="6"/>`;
  dividers += `<line x1="0" y1="${HEIGHT - 4}" x2="${WIDTH}" y2="${HEIGHT - 4}" stroke="${DIVIDER}" stroke-width="8"/>`;
  dividers += `<line x1="0" y1="4" x2="${WIDTH}" y2="4" stroke="${DIVIDER}" stroke-width="8"/>`;

  return `
    <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="#FFFFFF"/>
      ${dividers}
      ${cellsSvg}
    </svg>
  `;
}

async function main() {
  const svg = buildSvg();
  const outPath = path.join(__dirname, "richmenu.png");
  await sharp(Buffer.from(svg)).png().toFile(outPath);
  console.log("written:", outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
