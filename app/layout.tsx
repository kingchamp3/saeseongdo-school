import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "새성도스쿨 | 진행 대시보드",
  description: "새성도스쿨 운영과 돌봄을 위한 진행 대시보드",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
