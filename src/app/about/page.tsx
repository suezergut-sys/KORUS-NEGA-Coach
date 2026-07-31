"use client";

import Image from "next/image";
import { useState, type KeyboardEvent } from "react";
import UserSidebar from "@/components/UserSidebar";
import { groupProductHistory, PRODUCT_HISTORY, PRODUCT_SECTIONS } from "@/lib/about-product";

const ABOUT_TABS = [
  { id: "program", label: "О программе" },
  { id: "features", label: "Функциональность" },
  { id: "history", label: "История изменений" },
] as const;

type AboutTab = (typeof ABOUT_TABS)[number]["id"];

function historyDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Moscow",
  }).format(new Date(`${value}T12:00:00+03:00`));
}

export default function AboutPage() {
  const [activeTab, setActiveTab] = useState<AboutTab>("program");
  const historyGroups = groupProductHistory();
  const firstDate = PRODUCT_HISTORY.at(-1)?.date || "";
  const latestDate = PRODUCT_HISTORY[0]?.date || "";

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (index + direction + ABOUT_TABS.length) % ABOUT_TABS.length;
    setActiveTab(ABOUT_TABS[nextIndex].id);
    document.getElementById(`about-tab-${ABOUT_TABS[nextIndex].id}`)?.focus();
  }

  return (
    <main className="admin-shell user-area-shell">
      <UserSidebar />
      <div className="admin-main about-page">
        <nav className="about-tabs" role="tablist" aria-label="Разделы о программе">
          {ABOUT_TABS.map((tab, index) => (
            <button
              id={`about-tab-${tab.id}`}
              key={tab.id}
              type="button"
              role="tab"
              aria-controls={`about-panel-${tab.id}`}
              aria-selected={activeTab === tab.id}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <header className="admin-page-header about-header">
          <div>
            <span className="admin-eyebrow">О ПРОГРАММЕ</span>
            <h1>KORUS NEGA AI 2.0</h1>
            <p>Тренажёр управленческих переговоров: практика с AI-оппонентом, собственные кейсы, методический анализ и персональная траектория развития.</p>
          </div>
        </header>

        <section
          id="about-panel-program"
          className="about-tab-panel"
          role="tabpanel"
          aria-labelledby="about-tab-program"
          hidden={activeTab !== "program"}
        >
          <section className="about-intro neon-panel">
            <div>
              <span>НАЗНАЧЕНИЕ ПЛАТФОРМЫ</span>
              <h2>Практика сложных разговоров в безопасной AI-среде</h2>
              <p>KORUS NEGA AI 2.0 помогает руководителям и сотрудникам готовиться к управленческим переговорам, отрабатывать выбранную стратегию в голосовом поединке и превращать разбор каждой попытки в конкретный следующий шаг развития.</p>
            </div>
            <dl>
              <div><dt>{PRODUCT_SECTIONS.length}</dt><dd>функциональных направлений</dd></div>
              <div><dt>{PRODUCT_HISTORY.length}</dt><dd>объединённых PR в истории</dd></div>
              <div><dt>{historyDate(firstDate)}</dt><dd>первая зафиксированная версия</dd></div>
            </dl>
          </section>

          <section className="about-creator neon-panel">
            <div className="about-creator-photo">
              <Image
                src="/about/maxim-sumin.png"
                alt="Максим Сумин — создатель KORUS NEGA AI 2.0"
                width={763}
                height={937}
                priority
              />
            </div>
            <div className="about-creator-copy">
              <span className="admin-eyebrow">СОЗДАТЕЛЬ ПРОДУКТА</span>
              <h2>Максим Сумин</h2>
              <p>Автор идеи и создатель платформы KORUS NEGA AI 2.0 — цифрового тренажёра, который соединяет практику переговоров, методическую обратную связь и данные о прогрессе пользователя.</p>
              <div className="about-internal-note">
                <strong>Внутренний продукт</strong>
                <p>Платформа создана для внутреннего использования в компании Corpus Consulting.</p>
              </div>
            </div>
          </section>
        </section>

        <section
          id="about-panel-features"
          className="about-tab-panel about-section"
          role="tabpanel"
          aria-labelledby="about-tab-features"
          hidden={activeTab !== "features"}
        >
          <header className="about-section-header">
            <span className="admin-eyebrow">ФУНКЦИОНАЛЬНОСТЬ</span>
            <h2>Возможности по разделам</h2>
            <p>Восемь направлений платформы — последовательно, от тренировки до управления качеством и данными.</p>
          </header>
          <div className="about-feature-list">
            {PRODUCT_SECTIONS.map((section, index) => (
              <article key={section.eyebrow}>
                <div className="about-feature-number">{index + 1}</div>
                <div className="about-feature-copy">
                  <small>{section.eyebrow}</small>
                  <h3>{section.title}</h3>
                  <p>{section.description}</p>
                </div>
                <ul>{section.capabilities.map((capability) => <li key={capability}>{capability}</li>)}</ul>
              </article>
            ))}
          </div>
        </section>

        <section
          id="about-panel-history"
          className="about-tab-panel about-section about-history"
          role="tabpanel"
          aria-labelledby="about-tab-history"
          hidden={activeTab !== "history"}
        >
          <header className="about-section-header">
            <span className="admin-eyebrow">ИСТОРИЯ ИЗМЕНЕНИЙ</span>
            <h2>Как развивался продукт</h2>
            <p>Логи всех объединённых pull request репозитория, от новых к старым. Даты указаны по московскому календарю.</p>
          </header>
          <div className="about-history-note">
            <strong>Точка отсчёта</strong>
            <p>История GitHub PR начинается с документации уже работавшего прототипа. Поэтому PR №1 описывает исходную платформу, созданную до появления этой последовательности изменений.</p>
          </div>
          <div className="about-timeline" data-latest-version={latestDate}>
            {historyGroups.map((group) => (
              <section key={group.date}>
                <header><time dateTime={group.date}>{historyDate(group.date)}</time><span>{group.items.length} {group.items.length === 1 ? "изменение" : group.items.length < 5 ? "изменения" : "изменений"}</span></header>
                <div>
                  {group.items.map((item) => (
                    <article key={item.pr}>
                      <a href={`https://github.com/suezergut-sys/KORUS-NEGA-Coach/pull/${item.pr}`} target="_blank" rel="noreferrer">PR #{item.pr}</a>
                      <div><h3>{item.title}</h3><p>{item.description}</p></div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
