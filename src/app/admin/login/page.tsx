import Link from "next/link";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="admin-login-shell">
      <section className="admin-login-card neon-panel">
        <Link className="admin-back-link" href="/">← Вернуться в KORUS NEGA AI</Link>
        <div className="admin-login-mark">D</div>
        <span className="admin-eyebrow">ЗАКРЫТАЯ ЗОНА</span>
        <h1>Админ-панель</h1>
        <p>Управление методической базой и проверкой правил Владимира Тарасова.</p>
        <form action="/api/admin/login" method="post">
          <label htmlFor="admin-password">Пароль администратора</label>
          <input id="admin-password" name="password" type="password" autoComplete="current-password" required autoFocus />
          {params.error && <div className="admin-login-error" role="alert">Неверный пароль.</div>}
          <button type="submit">ВОЙТИ В АДМИН-ПАНЕЛЬ</button>
        </form>
      </section>
    </main>
  );
}
