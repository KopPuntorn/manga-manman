import type { Metadata, Viewport } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Manga Manman — อ่านมังงะแปลไทย",
  description: "เว็บอ่านมังงะส่วนตัว ดึงจาก MangaDex พร้อมแปลไทยอัตโนมัติด้วย AI",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bai+Jamjuree:ital,wght@0,400;0,600;0,700;1,400&family=Itim&family=Kanit:ital,wght@0,400;0,600;0,700;1,400&family=Mali:ital,wght@0,400;0,600;0,700;1,400&family=Mitr:wght@400;500;600&family=Prompt:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap"
          rel="stylesheet"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
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
