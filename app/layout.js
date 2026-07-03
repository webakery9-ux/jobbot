export const metadata = {
  title: "JobBot",
  description: "ระบบบอทเปิดจ๊อบ/รับงานอัตโนมัติบน LINE Group",
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
