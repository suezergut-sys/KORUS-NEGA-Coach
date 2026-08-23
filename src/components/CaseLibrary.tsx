"use client";

import Link from "next/link";
import CaseCanonicalDetails from "@/components/CaseCanonicalDetails";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { CaseLibraryItem } from "@/lib/case-library";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/Moscow" }).format(new Date(value));
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
            <CaseCanonicalDetails item={selected} />
            <footer className="case-library-dialog-actions"><button type="button" onClick={() => setSelected(null)}>Закрыть</button><Link href={`/?case=${selected.id}`}>Сыграть кейс →</Link></footer>
          </div>
        </div>
      )}
    </>
  );
}
