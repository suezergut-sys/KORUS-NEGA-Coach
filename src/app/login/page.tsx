import Link from "next/link";

export default async function SiteLoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const params = await searchParams;
  const next = params.next?.startsWith("/") && !params.next.startsWith("//") ? params.next : "/";
  return (
    <main className="site-login-shell">
      <section className="site-login-card neon-panel">
        <Link className="site-login-brand" href="/login"><strong>K</strong><span>KORUS NEGA AI<small>ТРЕНАЖЁР ПЕРЕГОВОРОВ</small></span></Link>
        <span className="admin-eyebrow">ЗАКРЫТЫЙ ПРОТОТИП</span>
        <h1>Вход в KORUS NEGA AI</h1>
        <p>Введите общий пароль, чтобы открыть тренажёр, конструктор кейсов и админ-панель.</p>
        <form action="/api/site/login" method="post">
          <input type="hidden" name="next" value={next} />
          <label htmlFor="site-password">ПАРОЛЬ САЙТА</label>
          <input id="site-password" name="password" type="password" autoComplete="current-password" autoFocus required />
          {params.error && <div className="admin-login-error">Неверный пароль. Попробуйте ещё раз.</div>}
          <button type="submit">ОТКРЫТЬ ТРЕНАЖЁР</button>
        </form>
      </section>
    </main>
  );
}
