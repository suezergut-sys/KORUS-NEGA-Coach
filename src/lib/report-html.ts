export type ReportExportMeta = {
  occurredAt: string;
  caseTitle: string;
  userFullName: string;
  participantRole: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] || character);
}

function reportDateTime(occurredAt: string) {
  const date = new Date(occurredAt);
  const validDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return {
    date: new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: "Europe/Moscow",
    }).format(validDate),
    time: new Intl.DateTimeFormat("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Moscow",
    }).format(validDate),
  };
}

export function reportHtmlFileName(meta: ReportExportMeta) {
  const date = new Date(meta.occurredAt);
  const datePart = Number.isNaN(date.getTime()) ? "report" : date.toISOString().slice(0, 10);
  const casePart = meta.caseTitle
    .toLocaleLowerCase("ru-RU")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "negotiation";
  return `otchet-${casePart}-${datePart}.html`;
}

export function buildNegotiationReportHtml({
  contentHtml,
  meta,
}: {
  contentHtml: string;
  meta: ReportExportMeta;
}) {
  const { date, time } = reportDateTime(meta.occurredAt);
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Отчёт по поединку — ${escapeHtml(meta.caseTitle)}</title>
  <style>
    :root { color-scheme: light; font-family: Arial, Helvetica, sans-serif; color: #17233a; background: #eef3f8; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 32px 18px; background: #eef3f8; line-height: 1.5; }
    main { max-width: 980px; margin: 0 auto; padding: 36px; background: #fff; border-radius: 16px; box-shadow: 0 12px 40px rgba(20, 43, 75, .12); }
    .export-meta { padding-bottom: 24px; border-bottom: 2px solid #1571c9; }
    .export-meta h1 { margin: 0 0 18px; font-size: 26px; }
    .export-meta dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 24px; margin: 0; }
    .export-meta div { padding: 10px 12px; background: #f4f8fc; border-radius: 8px; }
    .export-meta dt { color: #56708d; font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
    .export-meta dd { margin: 4px 0 0; font-weight: 700; }
    .negotiation-report { margin-top: 28px; }
    .analysis-header, .duel-outcome, .score-breakdown article header, .technique-review article header, .evidence-review article header, .report-footer, .quote-pair { display: flex; justify-content: space-between; gap: 18px; }
    .analysis-header h2 { margin: 6px 0; font-size: 20px; }
    .analysis-header span, section > h3, section > span, article > span, .report-footer { color: #3971a5; font-size: 12px; letter-spacing: .06em; }
    .analysis-score { min-width: 105px; text-align: right; color: #1571c9; }
    .analysis-score strong { font-size: 44px; }
    .analysis-score small { font-size: 16px; }
    .analysis-disclaimer { color: #617085; font-size: 13px; }
    section, .analysis-section, .analysis-list { margin: 20px 0; padding: 18px; border: 1px solid #d8e3ee; border-radius: 10px; break-inside: avoid; }
    .duel-outcome { align-items: flex-start; background: #f5faff; }
    .outcome-symbol { color: #1571c9; font-size: 34px; }
    h3 { margin: 6px 0 10px; color: #17233a; }
    ul, ol { padding-left: 22px; }
    li { margin: 6px 0; }
    .analysis-grid, .speech-analytics-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
    .speech-analytics-grid article, .stratagem-review article, .development-plan article, .turning-points article, .technique-review article, .evidence-review article, .score-breakdown article { margin: 12px 0; padding: 14px; background: #f7f9fc; border-radius: 8px; break-inside: avoid; }
    blockquote { flex: 1; margin: 8px 0; padding: 12px; border-left: 3px solid #61a5e6; background: #fff; }
    blockquote small { display: block; margin-bottom: 6px; color: #56708d; font-size: 10px; }
    .score-breakdown i { display: block; height: 6px; background: #dbe7f2; border-radius: 4px; overflow: hidden; }
    .score-breakdown i b { display: block; height: 100%; background: #1571c9; }
    a { color: #146db9; }
    @media (max-width: 680px) { body { padding: 0; } main { padding: 22px; border-radius: 0; } .export-meta dl, .analysis-grid, .speech-analytics-grid { grid-template-columns: 1fr; } .quote-pair, .analysis-header { flex-direction: column; } .analysis-score { text-align: left; } }
    @media print { body { padding: 0; background: #fff; } main { max-width: none; padding: 0; box-shadow: none; } }
  </style>
</head>
<body>
  <main>
    <header class="export-meta">
      <h1>Итоговый отчёт по поединку</h1>
      <dl>
        <div><dt>Дата</dt><dd>${escapeHtml(date)}</dd></div>
        <div><dt>Время</dt><dd>${escapeHtml(time)} МСК</dd></div>
        <div><dt>Кейс</dt><dd>${escapeHtml(meta.caseTitle)}</dd></div>
        <div><dt>Пользователь</dt><dd>${escapeHtml(meta.userFullName)}</dd></div>
        <div><dt>Роль в поединке</dt><dd>${escapeHtml(meta.participantRole)}</dd></div>
      </dl>
    </header>
    ${contentHtml}
  </main>
</body>
</html>`;
}
