import "./guide.css";
import { isCreditModuleEnabled } from "@/lib/settings";

export const metadata = {
  title: "วิธีใช้งาน JobBotTH",
  description: "คู่มือการใช้งานระบบจ่ายงาน-รับงานอัตโนมัติ JobBotTH",
};

// ต้อง render ใหม่ทุก request ห้ามแคชแบบ static เพราะเช็คสวิตช์เปิด/ปิดโมดูลเครดิตจาก DB สด
export const dynamic = "force-dynamic";

function Section({ id, title, children }) {
  return (
    <section id={id} className="section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Step({ n, children }) {
  return (
    <div className="step">
      <span className="step-n">{n}</span>
      <p className="step-text">{children}</p>
    </div>
  );
}

export default async function GuidePage() {
  const basicId = process.env.LINE_BASIC_ID;
  const addFriendUrl = basicId
    ? `https://line.me/R/ti/p/%40${basicId.replace(/^@/, "")}`
    : null;
  const CREDIT_MODULE_ENABLED = await isCreditModuleEnabled();

  return (
    <div className="wrap">
      <header className="hero">
        <p className="eyebrow">คู่มือการใช้งาน</p>
        <h1>JobBotTH</h1>
        <p className="tagline">จ่ายงาน-รับงานในกลุ่มไลน์ ง่าย ไว โปร่งใส ไม่ต้องโทรอีกต่อไป</p>
        {addFriendUrl && (
          <a className="add-friend-btn" href={addFriendUrl}>
            ➕ เพิ่มเพื่อน JobBotTH
          </a>
        )}
      </header>

      <nav className="quicknav">
        <a href="#poster">ผู้เปิดงาน</a>
        <a href="#claimer">ผู้รับงาน</a>
        {CREDIT_MODULE_ENABLED && <a href="#credit">ระบบเครดิต</a>}
        <a href="#features">ฟีเจอร์อื่นๆ</a>
      </nav>

      <Section id="poster" title="📝 สำหรับผู้เปิดงาน">
        <Step n="1">
          เพิ่มเพื่อน JobBotTH แล้วกรอกข้อมูลส่วนตัว (ชื่อ-นามสกุล เบอร์ติดต่อ) ในแชทส่วนตัวครั้งแรก
          ใช้เวลาไม่ถึงนาที ทำครั้งเดียวจบ
        </Step>
        <Step n="2">
          โพสต์งานได้ 2 ทาง — พิมพ์คำสั่งในกลุ่มไลน์ เช่น{" "}
          <code>/job แอร์สุ-สุขุมวิท 400 โอนทันที</code> หรือเปิดหน้า
          <b> โพสต์งาน</b> ในแชทส่วนตัว เลือกกลุ่มที่จะส่งได้เอง
        </Step>
        <Step n="3">
          ระบบประกาศงานเข้ากลุ่มให้อัตโนมัติทันที พร้อมรายละเอียดค่าจ้าง วิธีจ่ายเงิน
        </Step>
        <Step n="4">
          พอมีคนกดรับงาน ระบบส่งชื่อ+เบอร์ติดต่อของผู้รับงานให้ในแชทส่วนตัวทันที
          ไม่ต้องรอใครทักมาก่อน
        </Step>
        <Step n="5">
          คุยรายละเอียดงานผ่านระบบแชทในตัวได้เลย ไม่ต้องแลกเบอร์ก่อนก็คุยได้
        </Step>
        <Step n="6">
          ดูสถานะงาน ประวัติการจ่ายงานทั้งหมด และใครเคยรับงานให้บ้าง ได้ในหน้า{" "}
          <b>ประวัติงาน</b>
        </Step>
      </Section>

      <Section id="claimer" title="💼 สำหรับผู้รับงาน">
        <Step n="1">
          เห็นการ์ดงานใหม่ในกลุ่ม กดปุ่ม <b>รับงาน</b> ได้ทันที ไม่ต้องพิมพ์อะไรเลย
          ใครกดก่อนได้งานก่อน ไม่มีซ้ำ
        </Step>
        <Step n="2">
          รับชื่อ+เบอร์ติดต่อของเจ้าของงานทันทีในแชทส่วนตัว พร้อมปุ่มโทรและปุ่มแชทในตัว
        </Step>
        <Step n="3">
          ทำงานเสร็จ กดปุ่ม <b>จบงาน</b> แนบรูป/หมายเหตุได้ หรือกด{" "}
          <b>คืนงาน</b> หากทำต่อไม่ได้ งานจะกลับเข้ากลุ่มให้คนอื่นรับต่อทันที
        </Step>
        <Step n="4">
          ดูรายได้สะสมของตัวเองได้ในหน้า <b>สรุปรายได้</b> แยกรายวัน/สัปดาห์/เดือน/ปี
          กดดูรายการงานแต่ละช่วงได้เลย
        </Step>
      </Section>

      {CREDIT_MODULE_ENABLED && (
        <Section id="credit" title="🪙 ระบบเครดิต">
          <p className="p">
            ทุกครั้งที่มีการจ่ายงาน-รับงานสำเร็จ ระบบจะหักเครดิตเป็นค่าบำรุงเซิร์ฟเวอร์เล็กน้อย
            จากทั้งสองฝั่ง (คิดตามค่าจ้างงานเป็นขั้นบันได ทุกๆ 100 บาทของค่าจ้าง) เพื่อให้ระบบพัฒนา
            และดูแลต่อไปได้
          </p>
          <p className="p">
            สมาชิกใหม่ทุกคนได้รับ <b>เครดิตทดลองฟรี 20 เครดิต</b> ไว้ลองใช้งานได้เลยโดยไม่ต้องเติมเงินก่อน
          </p>

          <table className="price-table">
            <thead>
              <tr>
                <th>จ่าย</th>
                <th>ได้เครดิต</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>20 บาท</td><td>20 เครดิต</td></tr>
              <tr><td>50 บาท</td><td>52 เครดิต</td></tr>
              <tr><td>100 บาท</td><td>105 เครดิต</td></tr>
              <tr><td>200 บาท</td><td>215 เครดิต</td></tr>
              <tr><td>300 บาท</td><td>325 เครดิต</td></tr>
              <tr><td>500 บาท</td><td>550 เครดิต</td></tr>
            </tbody>
          </table>
          <p className="p muted">ยิ่งเติมก้อนใหญ่ ยิ่งได้โบนัสเครดิตเพิ่มมากขึ้น เติมได้จากหน้า "เติมเครดิต" ในแชทส่วนตัว แนบสลิปโอนเงิน รอตรวจสอบไม่นาน</p>

          <p className="p" style={{ marginTop: 10 }}>
            🎁 <b>ยิ่งเปิดงานเยอะ ยิ่งได้เครดิตคืน</b> — วันไหนเปิดงานครบ 10 งาน หรือรับงานครบ 10 งาน
            ระบบคืนให้ทันที 2 เครดิต ใช้ได้ทั้งฝั่งเปิดงานและรับงาน สะสมได้ทุกวันไม่จำกัด
          </p>
        </Section>
      )}

      <Section id="features" title="✨ ฟีเจอร์อื่นๆ ที่มีให้">
        <ul className="feature-list">
          <li>📜 ประวัติงานแยก 3 แท็บ — จ่ายงาน / รับงาน / คืนงาน ค้นหาและกรองตามช่วงวันที่ได้</li>
          <li>💬 ระบบแชทในตัว คุยกับอีกฝ่ายได้โดยไม่ต้องแลกเบอร์ก่อน</li>
          <li>📞 เบอร์ติดต่อกดโทรออกได้ทันทีจากในแชท ไม่ต้องก็อปวาง</li>
          <li>📊 สรุปรายได้แบบละเอียด พร้อมกดดูรายการงานย้อนหลังได้</li>
          <li>🔒 ข้อมูลติดต่อส่งเฉพาะแชทส่วนตัว ไม่โพสต์ในกลุ่มหลัก ปลอดภัยไม่ปนกัน</li>
        </ul>
      </Section>

      {addFriendUrl && (
        <a className="add-friend-btn bottom" href={addFriendUrl}>
          ➕ เพิ่มเพื่อน JobBotTH
        </a>
      )}

      <Section id="contact" title="☎️ ติดต่อผู้ดูแลระบบ">
        <p className="p">มีคำถามเพิ่มเติมหรือแจ้งปัญหาการใช้งาน ติดต่อได้เลยครับ</p>
        <div className="contact-buttons">
          <a className="contact-btn" href="tel:0649636292">
            📞 โทร 064-963-6292
          </a>
          <a className="contact-btn" href="https://line.me/ti/p/~jpuuh">
            💬 แอดไลน์ผู้ดูแล
          </a>
        </div>
      </Section>

      <footer className="footer">JobBotTH</footer>
    </div>
  );
}
