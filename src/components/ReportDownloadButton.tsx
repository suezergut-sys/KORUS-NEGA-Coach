"use client";

import { buildNegotiationReportHtml, reportHtmlFileName, type ReportExportMeta } from "@/lib/report-html";
import type { MouseEvent } from "react";

export default function ReportDownloadButton({ reportMeta }: { reportMeta: ReportExportMeta }) {
  function downloadReport(event: MouseEvent<HTMLButtonElement>) {
    const root = event.currentTarget.closest<HTMLElement>("[data-negotiation-report]");
    if (!root) return;
    const report = root.cloneNode(true) as HTMLElement;
    report.querySelectorAll("[data-report-export-ignore]").forEach((element) => element.remove());
    report.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((anchor) => {
      anchor.href = new URL(anchor.getAttribute("href") || "", window.location.origin).href;
    });
    const html = buildNegotiationReportHtml({ contentHtml: report.outerHTML, meta: reportMeta });
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = reportHtmlFileName(reportMeta);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return <button type="button" className="report-download-button" onClick={downloadReport}>СКАЧАТЬ ОТЧЁТ</button>;
}
