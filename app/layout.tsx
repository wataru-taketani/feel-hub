import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Feel Hub - FEELCYCLEライフをもっと快適に",
  description: "FEELCYCLEのレッスン予約やキャンセル待ちをサポートするツール",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
