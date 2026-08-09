import type { Metadata } from "next";
import OnboardingModal from "@/components/OnboardingModal";
import WelcomeBackModal from "@/components/WelcomeBackModal";
import "./globals.css";

export const metadata: Metadata = {
  title: "KORUS NEGA AI 2.0 — тренажёр переговоров",
  description: "Русскоязычный голосовой тренажёр с анализом по разным методологиям переговоров",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>
        {children}
        {process.env.E2E_TEST_MODE !== "1" && <OnboardingModal />}
        {process.env.E2E_TEST_MODE !== "1" && <WelcomeBackModal />}
      </body>
    </html>
  );
}
