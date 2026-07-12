import Image from "next/image";
import Link from "next/link";

export default async function SiteLoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string; forgot?: string }> }) {
  const params = await searchParams;
  const next = params.next?.startsWith("/") && !params.next.startsWith("//") ? params.next : "/";
  return (
    <main className="site-login-shell">
      <section className="site-login-card neon-panel">
        <Link className="site-login-brand" href="/login"><Image className="site-login-logo" src="/korus_sign_color.jpg" alt="KORUS Consulting" width={46} height={46} priority /><span>KORUS NEGA AI 2.0<small>ТРЕНАЖЁР ПЕРЕГОВОРОВ</small></span></Link>
        <span className="admin-eyebrow">ВХОД ДЛЯ УЧАСТНИКОВ</span>
        <h1>Рады видеть вас снова</h1>
        <p>Войдите с корпоративной почтой и паролем, чтобы продолжить тренировки.</p>
        <form action="/api/site/login" method="post">
          <input type="hidden" name="next" value={next} />
          <label htmlFor="email">АДРЕС ЭЛЕКТРОННОЙ ПОЧТЫ</label>
          <input id="email" name="email" type="email" autoComplete="email" placeholder="name@korusconsulting.ru" autoFocus required />
          <label htmlFor="password">ПАРОЛЬ</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required />
          <Link className="forgot-password" href={`/login?forgot=1&next=${encodeURIComponent(next)}`}>Забыли пароль?</Link>
          {params.forgot && <div className="login-info">Обратитесь к администратору — Максиму Сумину, чтобы получить новый пароль.</div>}
          {params.error && <div className="admin-login-error">Неверный адрес почты или пароль.</div>}
          <button type="submit">ВОЙТИ В ТРЕНАЖЁР</button>
        </form>
        <div className="auth-switch">Ещё нет учётной записи? <Link href="/register">Зарегистрироваться</Link></div>
      </section>
    </main>
  );
}
