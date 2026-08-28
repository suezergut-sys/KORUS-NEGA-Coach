"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import AppBrandMark from "@/components/AppBrandMark";
import AppSectionIcon, { type AppSectionIconName } from "@/components/AppSectionIcon";

const NAV_RAIL_STORAGE_KEY = "korus-nega-nav-rail-expanded";
const NAV_RAIL_CHANGE_EVENT = "korus-nega-nav-rail-change";

function subscribeToNavRail(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(NAV_RAIL_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(NAV_RAIL_CHANGE_EVENT, onStoreChange);
  };
}

function getNavRailSnapshot() {
  return window.localStorage.getItem(NAV_RAIL_STORAGE_KEY) === "true";
}

function subscribeToDesktopViewport(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia("(min-width: 821px)");
  mediaQuery.addEventListener("change", onStoreChange);
  return () => mediaQuery.removeEventListener("change", onStoreChange);
}

function getDesktopViewportSnapshot() {
  return window.matchMedia("(min-width: 821px)").matches;
}

function RailLink({
  href,
  label,
  active,
  icon,
  className = "",
  prefetch = true,
}: {
  href: string;
  label: string;
  active: boolean;
  icon: AppSectionIconName;
  className?: string;
  prefetch?: boolean;
}) {
  return (
    <Link className={`rail-button ${active ? "active" : ""} ${className}`.trim()} href={href} aria-label={label} title={label} prefetch={prefetch}>
      <AppSectionIcon name={icon} />
      <span className="rail-label">{label}</span>
    </Link>
  );
}

export default function AppNavRail({ isAdministrator = false, prefetch = true }: { isAdministrator?: boolean; prefetch?: boolean }) {
  const pathname = usePathname() || "";
  const storedExpanded = useSyncExternalStore(subscribeToNavRail, getNavRailSnapshot, () => false);
  const isDesktop = useSyncExternalStore(subscribeToDesktopViewport, getDesktopViewportSnapshot, () => true);
  const isExpanded = isDesktop && storedExpanded;

  function toggleExpanded() {
    if (!isDesktop) return;

    window.localStorage.setItem(NAV_RAIL_STORAGE_KEY, String(!isExpanded));
    window.dispatchEvent(new Event(NAV_RAIL_CHANGE_EVENT));
  }

  return (
    <aside className={`nav-rail ${isExpanded ? "is-expanded" : ""}`.trim()} aria-label="Разделы приложения">
      <button
        className="rail-logo"
        type="button"
        onClick={toggleExpanded}
        disabled={!isDesktop}
        aria-label={isDesktop ? (isExpanded ? "Свернуть панель навигации" : "Развернуть панель навигации") : "KORUS Consulting"}
        aria-expanded={isExpanded}
        title={isDesktop ? (isExpanded ? "Свернуть панель" : "Развернуть панель") : undefined}
      >
        <AppBrandMark className="rail-logo-mark" priority />
        <span className="rail-toggle-indicator" aria-hidden="true">
          <svg viewBox="0 0 20 20">
            <path d="m7 5 5 5-5 5" />
          </svg>
        </span>
      </button>
      <RailLink href="/" label="Переговоры" active={pathname === "/"} icon="negotiations" prefetch={prefetch} />
      <RailLink href="/case-library" label="База кейсов" active={pathname.startsWith("/case-library")} icon="cases" prefetch={prefetch} />
      <RailLink href="/account" label="Личный кабинет" active={pathname === "/account"} icon="account" prefetch={prefetch} />
      <RailLink href="/rating" label="Рейтинг" active={pathname === "/rating"} icon="rating" prefetch={prefetch} />
      <RailLink href="/analyze" label="Анализ кейса" active={pathname.startsWith("/analyze")} icon="analyze" className="case-analyze-rail" prefetch={prefetch} />
      <RailLink href="/feedback" label="Обратная связь" active={pathname.startsWith("/feedback")} icon="feedback" prefetch={prefetch} />
      <RailLink href="/about" label="О программе" active={pathname.startsWith("/about")} icon="about" prefetch={prefetch} />
      <form className="rail-logout-form" action="/api/site/logout" method="post">
        <button className="rail-button" type="submit" aria-label="Выйти" title="Выйти">
          <AppSectionIcon name="logout" />
          <span className="rail-label">Выйти</span>
        </button>
      </form>
      {isAdministrator && <div className="rail-admin-spacer" aria-hidden="true" />}
      {isAdministrator && <RailLink href="/admin" label="Админ-панель" active={pathname.startsWith("/admin")} icon="admin" className="admin-rail-link" prefetch={prefetch} />}
    </aside>
  );
}
