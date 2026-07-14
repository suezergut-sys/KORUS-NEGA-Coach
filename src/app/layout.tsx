import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KORUS NEGA AI 2.0 — тренажёр переговоров",
  description: "Русскоязычный голосовой тренажёр с анализом по разным методологиям переговоров",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
