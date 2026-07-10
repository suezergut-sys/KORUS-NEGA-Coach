import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Полигон — тренажёр переговоров",
  description: "Русскоязычный голосовой тренажёр управленческих переговоров",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
