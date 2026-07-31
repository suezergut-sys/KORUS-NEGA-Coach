import UserSidebar from "@/components/UserSidebar";
import { groupProductHistory, PRODUCT_HISTORY, PRODUCT_SECTIONS } from "@/lib/about-product";

function historyDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Moscow",
  }).format(new Date(`${value}T12:00:00+03:00`));
}

export default function AboutPage() {
  const historyGroups = groupProductHistory();
  const firstDate = PRODUCT_HISTORY.at(-1)?.date || "";
  const latestDate = PRODUCT_HISTORY[0]?.date || "";

  return (
    <main className="admin-shell user-area-shell">
      <UserSidebar />
      <div className="admin-main about-page">
        <header className="admin-page-header about-header">
          <div>
            <span className="admin-eyebrow">О ПРОГРАММЕ</span>
            <h1>KORUS NEGA AI 2.0</h1>
            <p>Тренажёр управленческих переговоров: практика с AI-оппонентом, собственные кейсы, методический анализ и персональная траектория развития.</p>
          </div>
        </header>

        <section className="about-intro neon-panel">
          <div>
            <span>КАК УСТРОЕН СЕРВИС</span>
            <h2>От рабочей ситуации — к тренировке и измеримому прогрессу</h2>
            <p>Платформа объединяет подготовку кейса, голосовой поединок, доказательный разбор и следующий учебный шаг. Ниже — полная карта функций и история того, как продукт развивался.</p>
          </div>
          <dl>
            <div><dt>{PRODUCT_SECTIONS.length}</dt><dd>функциональных направлений</dd></div>
            <div><dt>{PRODUCT_HISTORY.length}</dt><dd>объединённых PR в истории</dd></div>
            <div><dt>{historyDate(firstDate)}</dt><dd>первая зафиксированная версия</dd></div>
          </dl>
        </section>

        <section className="about-section">
          <header className="about-section-header">
            <span className="admin-eyebrow">ФУНКЦИОНАЛЬНОСТЬ</span>
            <h2>Возможности по разделам</h2>
            <p>Краткая карта всего, что доступно пользователю и команде сопровождения.</p>
          </header>
          <div className="about-feature-grid">
            {PRODUCT_SECTIONS.map((section, index) => (
              <article key={section.eyebrow}>
                <header><span>{String(index + 1).padStart(2, "0")}</span><small>{section.eyebrow}</small></header>
                <h3>{section.title}</h3>
                <p>{section.description}</p>
                <ul>{section.capabilities.map((capability) => <li key={capability}>{capability}</li>)}</ul>
              </article>
            ))}
          </div>
        </section>

        <section className="about-section about-history">
          <header className="about-section-header">
            <span className="admin-eyebrow">ИСТОРИЯ ВЕРСИЙ</span>
            <h2>Как развивался продукт</h2>
            <p>Все объединённые pull request репозитория, от новых к старым. Даты указаны по московскому календарю.</p>
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
