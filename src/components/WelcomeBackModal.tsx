"use client";

import { useEffect, useRef, useState } from "react";
import { getDailyQuote } from "@/lib/daily-quotes";
import { getOnboardingStorage, readOnboardingCompleted } from "@/lib/onboarding";
import { shouldOpenWelcomeBack } from "@/lib/welcome-back";

type WelcomeStats = {
  firstName: string;
  loginCount: number;
  played: number;
  winRate: number;
  averageScore: number | null;
};

export default function WelcomeBackModal() {
  const quote = getDailyQuote();
  const [stats, setStats] = useState<WelcomeStats | null>(null);
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const requested = url.searchParams.get("welcome") === "1";
    const onboardingCompleted = readOnboardingCompleted(getOnboardingStorage(window));
    const shouldOpen = shouldOpenWelcomeBack({ pathname: url.pathname, requested, onboardingCompleted });

    if (requested) {
      url.searchParams.delete("welcome");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
    if (!shouldOpen) return;

    const controller = new AbortController();
    void fetch("/api/account/welcome", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Статистика недоступна.");
        return response.json() as Promise<WelcomeStats>;
      })
      .then((payload) => {
        setStats(payload);
        setOpen(true);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Не удалось открыть приветственное окно:", error);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (!open || !stats) return null;

  return (
    <div className="welcome-back-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) setOpen(false);
    }}>
      <div className="welcome-back-dialog" role="dialog" aria-modal="true" aria-labelledby="welcome-back-title" ref={dialogRef} tabIndex={-1}>
        <button className="welcome-back-x" type="button" onClick={() => setOpen(false)} aria-label="Закрыть приветственное окно">×</button>
        <span className="welcome-back-eyebrow">KORUS NEGA AI 2.0</span>
        <h2 id="welcome-back-title">Привет, {stats.firstName}!</h2>
        <p>С возвращением на платформу развития переговорных навыков KORUS NEGA AI 2.0</p>
        <blockquote className="welcome-back-quote">
          <span>Цитата дня</span>
          <p>«{quote.text}»</p>
          <cite>— {quote.author}</cite>
        </blockquote>
        <section className="welcome-back-metrics" aria-label="Ваша статистика">
          <article><span>Входов на платформу</span><strong>{stats.loginCount}</strong></article>
          <article><span>Отыгранных кейсов</span><strong>{stats.played}</strong></article>
          <article><span>Процент побед</span><strong>{stats.winRate}%</strong></article>
          <article><span>Средний балл</span><strong>{stats.averageScore ?? "—"}</strong></article>
        </section>
        <button className="welcome-back-close" type="button" onClick={() => setOpen(false)}>Закрыть</button>
      </div>
    </div>
  );
}
