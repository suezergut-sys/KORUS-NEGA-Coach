"use client";

import Link from "next/link";
import CaseNegotiationPairs from "@/components/CaseNegotiationPairs";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { CaseLibraryItem } from "@/lib/case-library";
import type { CaseRole } from "@/lib/case-types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/Moscow" }).format(new Date(value));
}

function RoleDetails({ role, index }: { role: CaseRole; index: number }) {
  return (
    <article className="case-library-role">
      <span>РОЛЬ {index + 1}</span>
      <h3>{role.name}</h3>
      <p className="case-library-position">{role.position}</p>
      <dl>
        <div><dt>Открытая цель</dt><dd>{role.publicGoal}</dd></div>
        <div><dt>Интересы</dt><dd>{role.interests.join("; ")}</dd></div>
        <div><dt>Ограничения</dt><dd>{role.constraints.join("; ")}</dd></div>
        <div><dt>Ресурсы влияния</dt><dd>{role.leverage.join("; ")}</dd></div>
      </dl>
    </article>
  );
}

export default function CaseLibrary({ cases }: { cases: CaseLibraryItem[] }) {
  const [selected, setSelected] = useState<CaseLibraryItem | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selected) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setSelected(null); };
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", close);
    };
  }, [selected]);

  return (
    <>
      <div className="case-library-grid">
        {cases.map((item, index) => (
          <article className="case-library-card" key={item.id}>
            <div className="case-library-comic">
              {item.comicImage ? <Image src={item.comicImage} alt={`Комикс к кейсу «${item.title}»`} fill sizes="(max-width: 700px) 100vw, (max-width: 1150px) 32vw, 19vw" unoptimized /> : <div className="case-library-comic-placeholder"><span>КЕЙС {String(index + 1).padStart(2, "0")}</span><strong>Комикс<br />готовится</strong></div>}
              <span className="case-library-rank">#{String(index + 1).padStart(2, "0")}</span>
            </div>
            <div className="case-library-card-copy">
              <div className="case-library-meta"><time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time><span>{item.plays} {item.plays === 1 ? "отыгрыш" : "отыгрышей"}</span></div>
              <h2>{item.title}</h2>
              <p>{item.summary}</p>
              <div className="case-library-author"><span>АВТОР</span><strong>{item.createdBy}</strong></div>
              <footer>
                <button type="button" onClick={() => setSelected(item)}>Подробное описание</button>
                <Link href={`/?case=${item.id}`}>Сыграть кейс <span>→</span></Link>
              </footer>
            </div>
          </article>
        ))}
      </div>
      {!cases.length && <div className="dashboard-empty">Доступных кейсов пока нет. Создайте первый кейс или загрузите готовый.</div>}

      {selected && (
        <div className="case-library-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <div className="case-library-dialog" role="dialog" aria-modal="true" aria-labelledby="case-library-dialog-title" ref={dialogRef} tabIndex={-1}>
            <button className="case-library-dialog-x" type="button" onClick={() => setSelected(null)} aria-label="Закрыть подробное описание">×</button>
            <span className="admin-eyebrow">ПОДРОБНОЕ ОПИСАНИЕ КЕЙСА</span>
            <h2 id="case-library-dialog-title">{selected.title}</h2>
            <p className="case-library-dialog-summary">{selected.summary}</p>
            <section className="case-library-context">
              <article><span>КОНТЕКСТ</span><p>{selected.situation}</p></article>
              <article><span>ЦЕНТРАЛЬНЫЙ КОНФЛИКТ</span><p>{selected.conflict}</p></article>
              <article><span>НАЧАЛЬНАЯ СИТУАЦИЯ</span><p>{selected.startSituation}</p></article>
              {selected.stakes.length > 0 && <article><span>СТАВКИ</span><ul>{selected.stakes.map((stake) => <li key={stake}>{stake}</li>)}</ul></article>}
            </section>
            <section className="case-library-roles">
              {[selected.userRole, selected.opponentRole, ...selected.additionalRoles].map((role, index) => <RoleDetails role={role} index={index} key={`${role.name}-${index}`} />)}
            </section>
            <CaseNegotiationPairs roles={[selected.userRole, selected.opponentRole, ...selected.additionalRoles]} pairs={selected.negotiationPairs} />
            <footer className="case-library-dialog-actions"><button type="button" onClick={() => setSelected(null)}>Закрыть</button><Link href={`/?case=${selected.id}`}>Сыграть кейс →</Link></footer>
          </div>
        </div>
      )}
    </>
  );
}
