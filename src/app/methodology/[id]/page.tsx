import UserSidebar from "@/components/UserSidebar";
import { methodologyAtomLabel } from "@/lib/methodology-atom-kind";
import { getMethodology, type MethodologyId } from "@/lib/methodologies";
import { getPublicMethodology } from "@/lib/public-methodology";

export const dynamic = "force-dynamic";

export default async function PublicMethodologyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ atom?: string }>;
}) {
  const { id } = await params;
  const { atom } = await searchParams;
  const methodology = getMethodology(id) as ReturnType<typeof getMethodology>;
  const data = await getPublicMethodology(methodology.id as MethodologyId);
  return (
    <main className="admin-shell user-area-shell">
      <UserSidebar />
      <div className="admin-main public-methodology-page">
        <header className="admin-page-header">
          <div>
            <span className="admin-eyebrow">МЕТОДИЧЕСКАЯ БАЗА</span>
            <h1>{data.methodology.name}</h1>
            <p>{data.source.author} · версия {data.source.methodology_version} · {data.source.verification_status === "verified" ? "условно проверенная база" : "предварительная база"}</p>
          </div>
        </header>
        <p className="methodology-public-note">Это режим чтения для участника. Редактирование и экспертная верификация доступны только методисту.</p>
        <section className="public-atom-list">
          {data.atoms.map((item) => (
            <article id={`atom-${item.id}`} key={item.id} className={`neon-panel ${atom === item.id ? "selected" : ""}`}>
              <header><span>{methodologyAtomLabel(item.kind)}</span><b>{item.verification_status === "verified" ? "УСЛОВНО ПРОВЕРЕНО" : "ПРЕДВАРИТЕЛЬНО"}</b></header>
              <h2>{item.title}</h2>
              <p>{item.statement}</p>
              {item.signals?.length > 0 && <div><strong>Сигналы в переговорах</strong><ul>{item.signals.map((signal: string) => <li key={signal}>{signal}</li>)}</ul></div>}
              {item.counterexamples?.length > 0 && <div><strong>Когда вывод неприменим</strong><ul>{item.counterexamples.map((example: string) => <li key={example}>{example}</li>)}</ul></div>}
              <blockquote>«{item.source_quote}»</blockquote>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
