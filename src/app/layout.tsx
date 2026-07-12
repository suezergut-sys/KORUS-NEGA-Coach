import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KORUS NEGA AI — тренажёр переговоров",
  description: "Русскоязычный голосовой тренажёр управленческих переговоров по методике Владимира Тарасова",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
