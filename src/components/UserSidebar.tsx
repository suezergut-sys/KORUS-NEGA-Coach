"use client";

import { useEffect, useState } from "react";
import AppNavRail from "@/components/AppNavRail";

export default function UserSidebar() {
  const [isAdministrator, setIsAdministrator] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/site/access", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((payload: { isAdministrator?: boolean } | null) => setIsAdministrator(Boolean(payload?.isAdministrator)))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  return <AppNavRail isAdministrator={isAdministrator} />;
}
