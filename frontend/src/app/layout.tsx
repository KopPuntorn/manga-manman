import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Manga Manman — อ่านมังงะแปลไทย",
  description: "เว็บอ่านมังงะส่วนตัว ดึงจาก MangaDex พร้อมแปลไทยอัตโนมัติด้วย AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" suppressHydrationWarning data-scroll-behavior="smooth">
      <body suppressHydrationWarning>

        <nav className="navbar">
          <div className="navbar-inner">
            <Link href="/" className="navbar-logo">
              <span className="navbar-logo-icon">📖</span>
              <span className="navbar-logo-text">Manga Manman</span>
            </Link>
            <div className="navbar-links">
              <Link href="/" className="navbar-link">
                🏠 Home
              </Link>
              <Link href="/library" className="navbar-link">
                📚 Library
              </Link>
            </div>
          </div>
        </nav>
        <main className="main-content">
          {children}
        </main>
        <footer className="attribution">
          Manga data from <a href="https://mangadex.org" target="_blank" rel="noopener noreferrer">MangaDex</a>.
          All manga content belongs to their respective creators and scanlation groups.
        </footer>
      </body>
    </html>
  );
}
