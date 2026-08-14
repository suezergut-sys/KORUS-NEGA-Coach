"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { NegotiationAnalysis } from "@/lib/analysis-types";
import { methodologyOptions, type MethodologyId } from "@/lib/methodologies";
import { readJsonResponse } from "@/lib/http-response";

export default function ReportMethodologySwitcher({
  sessionId,
  methodologyId,
  onGenerated,
  preserveInitialReport = false,
}: {
  sessionId: string;
  methodologyId: MethodologyId;
  onGenerated?: (analysis: NegotiationAnalysis, methodologyId: MethodologyId) => void;
  preserveInitialReport?: boolean;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<MethodologyId>(methodologyId);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const unchanged = selectedId === methodologyId;

  async function generate() {
    if (working || unchanged) return;
    setWorking(true);
    setError("");
    try {
      const response = await fetch("/api/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, methodologyId: selectedId }),
      });
      const result = await readJsonResponse<{ analysis?: NegotiationAnalysis; error?: string }>(response);
      if (!result.isJson || !response.ok || !result.payload?.analysis) {
        throw new Error(result.payload?.error || "Не удалось сформировать отчёт по выбранной методологии.");
      }
      if (onGenerated) onGenerated(result.payload.analysis, selectedId);
      else router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось сформировать отчёт по выбранной методологии.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="report-methodology-switcher">
      <div>
        <span>ПОВТОРНЫЙ АНАЛИЗ</span>
        <h3>Посмотреть переговоры через другую методологию</h3>
        <p>{preserveInitialReport
          ? "Стенограмма и первый отчёт останутся неизменными. Новый разбор сохранится как текущий только после успешного анализа."
          : "Стенограмма останется прежней, а текущий отчёт будет заменён только после успешного анализа."}</p>
      </div>
      <div className="report-methodology-controls">
        <label htmlFor={`report-methodology-${sessionId}`}>
          <span>МЕТОДОЛОГИЯ</span>
          <select id={`report-methodology-${sessionId}`} value={selectedId} onChange={(event) => setSelectedId(event.target.value as MethodologyId)} disabled={working}>
            {methodologyOptions().map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => void generate()} disabled={working || unchanged}>
          {working ? "ФОРМИРУЕМ ОТЧЁТ…" : "СГЕНЕРИРОВАТЬ ОТЧЁТ"}
        </button>
      </div>
      {unchanged && !working && <small>Выберите методологию, отличную от текущей.</small>}
      {error && <p className="report-methodology-error" role="alert">{error}</p>}
    </section>
  );
}
