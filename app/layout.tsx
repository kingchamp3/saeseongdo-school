import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://saeseongdo-school.seochakbang.chatgpt.site"),
  title: "새성도스쿨 디딤돌 | 믿음 성장 대시보드",
  description:
    "구역별 새성도의 학습 진도와 성장을 실시간으로 함께 확인하는 새성도스쿨 대시보드입니다.",
  openGraph: {
    title: "새성도스쿨 디딤돌",
    description: "함께 배우고, 함께 성장하는 믿음의 여정",
    type: "website",
    locale: "ko_KR",
    images: [
      {
        url: "/og.png",
        width: 1731,
        height: 909,
        alt: "새성도스쿨 디딤돌 진행 현황 대시보드",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "새성도스쿨 디딤돌",
    description: "함께 배우고, 함께 성장하는 믿음의 여정",
    images: ["/og.png"],
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
