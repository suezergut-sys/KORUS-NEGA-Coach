"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEventHandler, ReactNode } from "react";

type AppNavRailProps = {
  onQuickUpload?: MouseEventHandler<HTMLButtonElement>;
  quickUploadDisabled?: boolean;
};

function Icon({ children }: { children: ReactNode }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true">{children}</svg>;
}

const icons = {
  negotiations: <Icon><path d="M4 5.5h10v7H8l-4 3v-10Z" /><path d="M10 15.5h6l4 3v-10h-3" /></Icon>,
  account: <Icon><circle cx="12" cy="8" r="3" /><path d="M6.5 19c.6-3.2 2.4-5 5.5-5s4.9 1.8 5.5 5" /></Icon>,
  rating: <Icon><path d="M5 19V12h3v7H5Zm5.5 0V8h3v11h-3ZM16 19V4h3v15h-3Z" /></Icon>,
  upload: <Icon><path d="M12 16V4m-4 4 4-4 4 4" /><path d="M5 14v5h14v-5" /></Icon>,
  create: <Icon><path d="M12 5v14M5 12h14" /></Icon>,
  logout: <Icon><path d="M10 5H5v14h5M14 8l4 4-4 4m4-4H9" /></Icon>,
  admin: <Icon><circle cx="12" cy="12" r="3" /><path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4m0-12.8L17 7M7 17l-1.4 1.4" /></Icon>,
};

function RailLink({ href, label, active, children, className = "" }: { href: string; label: string; active: boolean; children: ReactNode; className?: string }) {
  return <Link className={`rail-button ${active ? "active" : ""} ${className}`.trim()} href={href} aria-label={label} title={label}>{children}</Link>;
}

export default function AppNavRail({ onQuickUpload, quickUploadDisabled = false }: AppNavRailProps) {
  const pathname = usePathname();

  return (
    <aside className="nav-rail" aria-label="Разделы приложения">
      <Link className="rail-logo" href="/" aria-label="KORUS Consulting" title="KORUS Consulting">
        <Image src="/korus_sign_color.jpg" alt="" fill sizes="48px" priority />
      </Link>
      <RailLink href="/" label="Переговоры" active={pathname === "/"}>{icons.negotiations}</RailLink>
      <RailLink href="/account" label="Личный кабинет" active={pathname === "/account"}>{icons.account}</RailLink>
      <RailLink href="/rating" label="Рейтинг" active={pathname === "/rating"}>{icons.rating}</RailLink>
      {onQuickUpload ? (
        <button className="rail-button case-upload-rail" onClick={onQuickUpload} disabled={quickUploadDisabled} aria-label="Загрузить кейс" title="Загрузить кейс">{icons.upload}</button>
      ) : (
        <RailLink href="/?quickUpload=1" label="Загрузить кейс" active={false} className="case-upload-rail">{icons.upload}</RailLink>
      )}
      <RailLink href="/cases" label="Создать свой кейс" active={pathname.startsWith("/cases")} className="case-create-rail">{icons.create}</RailLink>
      <form className="rail-logout-form" action={pathname.startsWith("/admin") ? "/api/admin/logout" : "/api/site/logout"} method="post">
        <button className="rail-button" type="submit" aria-label="Выйти" title="Выйти">{icons.logout}</button>
      </form>
      <div className="rail-admin-spacer" aria-hidden="true" />
      <RailLink href="/admin" label="Админ-панель" active={pathname.startsWith("/admin")} className="admin-rail-link">{icons.admin}</RailLink>
    </aside>
  );
}
