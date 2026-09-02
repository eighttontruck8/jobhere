import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "잡핏 대시보드",
    template: "%s | 잡핏 대시보드",
  },
  description: "채용 공고를 비교하고 내 자격 조건과의 적합도를 확인하는 대시보드",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <header className="site-header">
          <div className="header-inner">
            <Link className="brand" href="/dashboard">
              잡핏
            </Link>
            <nav aria-label="주요 메뉴" className="main-nav">
              <Link href="/dashboard">대시보드</Link>
              <Link href="/profile">내 자격</Link>
              <Link href="/postings/add">공고 추가</Link>
            </nav>
          </div>
        </header>
        <main className="site-main">{children}</main>
      </body>
    </html>
  );
}
