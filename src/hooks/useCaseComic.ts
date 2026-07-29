"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CanonicalCase } from "@/lib/case-types";
import { getCaseComic, type ComicPanel } from "@/lib/case-comic";

export function useCaseComic(selectedCase: CanonicalCase, selectedRoleIndex: number) {
  const [remotePanels, setRemotePanels] = useState<ComicPanel[] | null>(null);
  const [mediaStatus, setMediaStatus] = useState("ready");
  const [panelIndex, setPanelIndex] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [error, setError] = useState("");
  const panels = useMemo(
    () => remotePanels || getCaseComic(selectedCase),
    [remotePanels, selectedCase],
  );
  const activePanel = panels[panelIndex];

  useEffect(() => {
    if (selectedCase.id.startsWith("default-")) return;
    let cancelled = false;
    let timer: number | undefined;
    const load = async () => {
      try {
        const response = await fetch(`/api/cases/${selectedCase.id}/comic`, { cache: "no-store" });
        const payload = await response.json() as {
          status?: string;
          error?: string;
          versions?: Record<string, ComicPanel[]>;
        };
        if (!response.ok) throw new Error(payload.error || "Не удалось проверить готовность комикса.");
        if (cancelled) return;
        setMediaStatus(payload.status || "pending");
        setRemotePanels(payload.versions?.[String(selectedRoleIndex)] || null);
        setError("");
        if (payload.status === "pending" || payload.status === "processing") {
          timer = window.setTimeout(load, 5000);
        }
      } catch (caught) {
        if (cancelled) return;
        setMediaStatus("failed");
        setError(caught instanceof Error ? caught.message : "Не удалось проверить готовность комикса.");
      }
    };
    void load();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [selectedCase.id, selectedRoleIndex]);

  const reset = useCallback(() => {
    setRemotePanels(null);
    setPanelIndex(0);
    setDetailsOpen(false);
    setError("");
  }, []);

  return {
    panels,
    activePanel,
    mediaStatus,
    panelIndex,
    setPanelIndex,
    detailsOpen,
    setDetailsOpen,
    error,
    reset,
  };
}
