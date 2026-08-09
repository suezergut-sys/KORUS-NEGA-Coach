"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AppBrandMark from "@/components/AppBrandMark";
import AppSectionIcon, { type AppSectionIconName } from "@/components/AppSectionIcon";

function RailLink({
  href,
  label,
  active,
  icon,
  className = "",
}: {
  href: string;
  label: string;
  active: boolean;
  icon: AppSectionIconName;
  className?: string;
}) {
  return (
    <Link className={`rail-button ${active ? "active" : ""} ${className}`.trim()} href={href} aria-label={label} title={label}>
      <AppSectionIcon name={icon} />
    </Link>
  );
}

export default function AppNavRail({ isAdministrator = false }: { isAdministrator?: boolean }) {
  const pathname = usePathname() || "";

  return (
    <aside className="nav-rail" aria-label="Разделы приложения">
      <Link className="rail-logo" href="/" aria-label="KORUS Consulting" title="KORUS Consulting">
        <AppBrandMark className="rail-logo-mark" priority />
      </Link>
      <RailLink href="/" label="Переговоры" active={pathname === "/"} icon="negotiations" />
      <RailLink href="/case-library" label="База кейсов" active={pathname.startsWith("/case-library")} icon="cases" />
      <RailLink href="/account" label="Личный кабинет" active={pathname === "/account"} icon="account" />
      <RailLink href="/rating" label="Рейтинг" active={pathname === "/rating"} icon="rating" />
      <RailLink href="/analyze" label="Проанализировать кейс" active={pathname.startsWith("/analyze")} icon="analyze" className="case-analyze-rail" />
      <RailLink href="/feedback" label="Обратная связь" active={pathname.startsWith("/feedback")} icon="feedback" />
      <RailLink href="/about" label="О программе" active={pathname.startsWith("/about")} icon="about" />
      <form className="rail-logout-form" action="/api/site/logout" method="post">
        <button className="rail-button" type="submit" aria-label="Выйти" title="Выйти">
          <AppSectionIcon name="logout" />
        </button>
      </form>
      {isAdministrator && <div className="rail-admin-spacer" aria-hidden="true" />}
      {isAdministrator && <RailLink href="/admin" label="Админ-панель" active={pathname.startsWith("/admin")} icon="admin" className="admin-rail-link" />}
    </aside>
  );
}
