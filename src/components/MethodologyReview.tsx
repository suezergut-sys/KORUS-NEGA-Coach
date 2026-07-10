"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type AtomStatus = "candidate" | "verified" | "rejected";
type AtomKind = "principle" | "stratagem" | "case_rule" | "evaluation_criterion" | "example";

type ReviewAtom = {
  id: string;
  kind: AtomKind;
  title: string;
  statement: string;
  signals: string[];
  counterexamples: string[];
  sourceQuote: string;
  verificationStatus: AtomStatus;
  reviewerNote: string;
  methodologyVersion: string;
  sectionPath: string;
  sourceContext: string;
  chunkIndex: number;
};

type Draft = Pick<ReviewAtom, "kind" | "title" | "statement" | "reviewerNote"> & {
  signalsText: string;
  counterexamplesText: string;
};

const KIND_LABELS: Record<AtomKind, string> = {
  principle: "Принцип",
  stratagem: "Стратагема",
  case_rule: "Правило кейса",
  evaluation_criterion: "Критерий оценки",
  example: "Пример",
};

const STATUS_LABELS: Record<AtomStatus, string> = {
  candidate: "Ожидает решения",
  verified: "Подтверждено",
  rejected: "Отклонено",
};

function toDraft(atom: ReviewAtom): Draft {
  return {
    kind: atom.kind,
    title: atom.title,
    statement: atom.statement,
    reviewerNote: atom.reviewerNote,
    signalsText: atom.signals.join("\n"),
    counterexamplesText: atom.counterexamples.join("\n"),
  };
}

function toLines(value: string) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

function SourceContext({ atom }: { atom: ReviewAtom }) {
  const index = atom.sourceContext.indexOf(atom.sourceQuote);
  if (index < 0) return <p>{atom.sourceContext}</p>;
  return (
    <p>
      {atom.sourceContext.slice(0, index)}
      <mark>{atom.sourceQuote}</mark>
      {atom.sourceContext.slice(index + atom.sourceQuote.length)}
    </p>
  );
}

export default function MethodologyReview({
  initialAtoms,
  sourceStatus,
  sourceVersion,
}: {
  initialAtoms: ReviewAtom[];
  sourceStatus: AtomStatus;
  sourceVersion: string;
}) {
  const [atoms, setAtoms] = useState(initialAtoms);
  const [selectedId, setSelectedId] = useState(initialAtoms[0]?.id || "");
  const selected = atoms.find((atom) => atom.id === selectedId) || atoms[0];
  const [draft, setDraft] = useState<Draft>(() => selected ? toDraft(selected) : { kind: "principle", title: "", statement: "", reviewerNote: "", signalsText: "", counterexamplesText: "" });
  const [statusFilter, setStatusFilter] = useState<"all" | AtomStatus>("all");
  const [kindFilter, setKindFilter] = useState<"all" | AtomKind>("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [releaseStatus, setReleaseStatus] = useState({ status: sourceStatus, version: sourceVersion });

  const counts = useMemo(() => ({
    candidate: atoms.filter((atom) => atom.verificationStatus === "candidate").length,
    verified: atoms.filter((atom) => atom.verificationStatus === "verified").length,
    rejected: atoms.filter((atom) => atom.verificationStatus === "rejected").length,
  }), [atoms]);

  const filtered = useMemo(() => {
    const normalized = query.toLocaleLowerCase("ru-RU").trim();
    return atoms.filter((atom) =>
      (statusFilter === "all" || atom.verificationStatus === statusFilter) &&
      (kindFilter === "all" || atom.kind === kindFilter) &&
      (!normalized || `${atom.title} ${atom.statement} ${atom.sourceQuote}`.toLocaleLowerCase("ru-RU").includes(normalized)),
    );
  }, [atoms, kindFilter, query, statusFilter]);

  function choose(atom: ReviewAtom) {
    setSelectedId(atom.id);
    setDraft(toDraft(atom));
    setNotice("");
  }

  async function save(verificationStatus: AtomStatus) {
    if (!selected || busy) return;
    setBusy(true);
    setNotice("");
    try {
      const signals = toLines(draft.signalsText);
      const counterexamples = toLines(draft.counterexamplesText);
      const response = await fetch(`/api/admin/methodology/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, signals, counterexamples, verificationStatus }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Не удалось сохранить решение.");
      setAtoms((current) => current.map((atom) => atom.id === selected.id ? {
        ...atom,
        kind: draft.kind,
        title: draft.title,
        statement: draft.statement,
        reviewerNote: draft.reviewerNote,
        signals,
        counterexamples,
        verificationStatus,
        methodologyVersion: "tarasov-v0-candidate",
      } : atom));
      setReleaseStatus({ status: "candidate", version: "tarasov-v0-candidate" });
      setNotice(verificationStatus === "verified" ? "Атом подтверждён." : verificationStatus === "rejected" ? "Атом отклонён." : "Изменения сохранены, решение отложено.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Ошибка сохранения.");
    } finally {
      setBusy(false);
    }
  }

  async function releaseVersion() {
    if (busy || !window.confirm("Зафиксировать проверенный набор как tarasov-v1? После новых правок версия снова станет предварительной.")) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/methodology/release", { method: "POST" });
      const payload = (await response.json()) as { error?: string; methodologyVersion?: string };
      if (!response.ok) throw new Error(payload.error || "Не удалось зафиксировать версию.");
      setReleaseStatus({ status: "verified", version: payload.methodologyVersion || "tarasov-v1" });
      setAtoms((current) => current.map((atom) => atom.verificationStatus === "verified" ? { ...atom, methodologyVersion: "tarasov-v1" } : atom));
      setNotice("Версия tarasov-v1 зафиксирована и будет использоваться в оценке.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Ошибка фиксации версии.");
    } finally {
      setBusy(false);
    }
  }

  if (!selected) return <div className="admin-empty">Методические атомы пока не импортированы.</div>;

  return (
    <>
      <header className="admin-page-header methodology-header">
        <div><span className="admin-eyebrow">МЕТОДИЧЕСКИЙ КОНТРОЛЬ</span><h1>Верификация правил Тарасова</h1><p>Сверяйте формулировку с контекстом книги и фиксируйте экспертное решение.</p></div>
        <div className="method-version"><span>{releaseStatus.status === "verified" ? "ВЕРИФИЦИРОВАНА" : "ПРЕДВАРИТЕЛЬНАЯ"}</span><strong>{releaseStatus.version}</strong><button onClick={releaseVersion} disabled={busy || releaseStatus.status === "verified"}>Зафиксировать v1</button></div>
      </header>

      <section className="review-summary">
        <div><strong>{atoms.length}</strong><span>Всего</span></div>
        <div className="candidate"><strong>{counts.candidate}</strong><span>Ожидают</span></div>
        <div className="verified"><strong>{counts.verified}</strong><span>Подтверждено</span></div>
        <div className="rejected"><strong>{counts.rejected}</strong><span>Отклонено</span></div>
        <div className="review-progress"><i style={{ width: `${atoms.length ? ((counts.verified + counts.rejected) / atoms.length) * 100 : 0}%` }} /></div>
      </section>

      <section className="methodology-workspace">
        <aside className="atom-browser">
          <div className="atom-filters">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по правилам…" />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | AtomStatus)} aria-label="Статус">
              <option value="all">Все статусы</option><option value="candidate">Ожидают</option><option value="verified">Подтверждены</option><option value="rejected">Отклонены</option>
            </select>
            <select value={kindFilter} onChange={(event) => setKindFilter(event.target.value as "all" | AtomKind)} aria-label="Тип атома">
              <option value="all">Все типы</option>{Object.entries(KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div className="atom-list">
            {filtered.map((atom) => <button key={atom.id} onClick={() => choose(atom)} className={`${atom.id === selected.id ? "selected" : ""} ${atom.verificationStatus}`}><span>{KIND_LABELS[atom.kind]}</span><strong>{atom.title}</strong><small>{STATUS_LABELS[atom.verificationStatus]}</small></button>)}
            {!filtered.length && <p>По выбранным фильтрам ничего не найдено.</p>}
          </div>
        </aside>

        <article className="atom-editor">
          <div className="atom-editor-meta"><span>ATOM {selected.id.slice(0, 8)}</span><span>Фрагмент #{selected.chunkIndex}</span><Link href="/admin">← В настройки</Link></div>
          <label>Тип<select value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as AtomKind })}>{Object.entries(KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Название<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
          <label>Формулировка правила<textarea rows={4} value={draft.statement} onChange={(event) => setDraft({ ...draft, statement: event.target.value })} /></label>

          <section className="source-context-card">
            <header><span>ИСТОЧНИК: SRC-001</span><strong>{selected.sectionPath}</strong></header>
            <SourceContext atom={selected} />
            <blockquote>Цитата-кандидат: «{selected.sourceQuote}»</blockquote>
          </section>

          <div className="atom-fields-grid">
            <label>Наблюдаемые признаки <small>Каждый признак с новой строки</small><textarea rows={5} value={draft.signalsText} onChange={(event) => setDraft({ ...draft, signalsText: event.target.value })} /></label>
            <label>Контрпримеры <small>Что не является применением правила</small><textarea rows={5} value={draft.counterexamplesText} onChange={(event) => setDraft({ ...draft, counterexamplesText: event.target.value })} /></label>
          </div>
          <label>Комментарий методиста<textarea rows={3} value={draft.reviewerNote} onChange={(event) => setDraft({ ...draft, reviewerNote: event.target.value })} placeholder="Почему подтверждено или отклонено; что было исправлено…" /></label>
          {notice && <div className="review-notice" role="status">{notice}</div>}
          <footer className="review-actions">
            <button className="review-reject" onClick={() => save("rejected")} disabled={busy}>✕ ОТКЛОНИТЬ</button>
            <button className="review-defer" onClick={() => save("candidate")} disabled={busy}>◷ ОТЛОЖИТЬ</button>
            <button className="review-verify" onClick={() => save("verified")} disabled={busy}>✓ ПОДТВЕРДИТЬ</button>
          </footer>
        </article>
      </section>
    </>
  );
}

