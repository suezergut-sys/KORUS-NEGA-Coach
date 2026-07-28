"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEventHandler } from "react";
import AppBrandMark from "@/components/AppBrandMark";
import AppSectionIcon, { type AppSectionIconName } from "@/components/AppSectionIcon";

type AppNavRailProps = {
  onQuickUpload?: MouseEventHandler<HTMLButtonElement>;
  quickUploadDisabled?: boolean;
};

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

export default function AppNavRail({ onQuickUpload, quickUploadDisabled = false }: AppNavRailProps) {
  const pathname = usePathname();

  return (
    <aside className="nav-rail" aria-label="Разделы приложения">
      <Link className="rail-logo" href="/" aria-label="KORUS Consulting" title="KORUS Consulting">
        <AppBrandMark className="rail-logo-mark" priority />
      </Link>
      <RailLink href="/" label="Переговоры" active={pathname === "/"} icon="negotiations" />
      <RailLink href="/account" label="Личный кабинет" active={pathname === "/account"} icon="account" />
      <RailLink href="/rating" label="Рейтинг" active={pathname === "/rating"} icon="rating" />
      {onQuickUpload ? (
        <button className="rail-button case-upload-rail" onClick={onQuickUpload} disabled={quickUploadDisabled} aria-label="Загрузить кейс" title="Загрузить кейс">
          <AppSectionIcon name="upload" />
        </button>
      ) : (
        <RailLink href="/?quickUpload=1" label="Загрузить кейс" active={false} icon="upload" className="case-upload-rail" />
      )}
      <RailLink href="/cases" label="Создать свой кейс" active={pathname.startsWith("/cases")} icon="create" className="case-create-rail" />
      <RailLink href="/analyze" label="Проанализировать кейс" active={pathname.startsWith("/analyze")} icon="analyze" className="case-analyze-rail" />
      <form className="rail-logout-form" action={pathname.startsWith("/admin") ? "/api/admin/logout" : "/api/site/logout"} method="post">
        <button className="rail-button" type="submit" aria-label="Выйти" title="Выйти">
          <AppSectionIcon name="logout" />
        </button>
      </form>
      <div className="rail-admin-spacer" aria-hidden="true" />
      <RailLink href="/admin" label="Админ-панель" active={pathname.startsWith("/admin")} icon="admin" className="admin-rail-link" />
    </aside>
  );
}
