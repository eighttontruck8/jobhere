import type { Metadata } from "next";
import Link from "next/link";
import "pretendard/dist/web/variable/pretendardvariable.css";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "잡핏 대시보드",
    template: "%s | 잡핏 대시보드",
  },
  description: "채용 공고를 비교하고 내 자격 조건과의 적합도를 확인하는 대시보드",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
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
