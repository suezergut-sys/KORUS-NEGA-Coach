"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AnalysisRetryButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  async function retry() {
    if (working) return;
    setWorking(true);
    setError("");
    try {
      const response = await fetch("/api/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Не удалось повторить анализ.");
      router.refresh();
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "Не удалось повторить анализ.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="analysis-retry">
      <button type="button" onClick={() => void retry()} disabled={working}>
        {working ? "АНАЛИЗИРУЕМ…" : "ПОВТОРИТЬ АНАЛИЗ"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
