import Link from "next/link";

const ERRORS: Record<string, string> = {
  name: "Укажите имя и фамилию.",
  domain: "Тренажёр доступен только сотрудникам ГК КОРУС Консалтинг. Используйте почту @korusconsulting.ru или @mons.ru.",
  password: "Пароль должен содержать не менее 8 символов.",
  exists: "Учётная запись с этой почтой уже существует. Войдите или обратитесь к администратору.",
  failed: "Не удалось создать учётную запись. Попробуйте ещё раз или обратитесь к администратору.",
};

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return (
    <main className="site-login-shell">
      <section className="site-login-card register-card neon-panel">
        <Link className="site-login-brand" href="/login"><strong>K</strong><span>KORUS NEGA AI<small>ТРЕНАЖЁР ПЕРЕГОВОРОВ</small></span></Link>
        <span className="admin-eyebrow">РЕГИСТРАЦИЯ УЧАСТНИКА</span>
        <h1>Создайте личный профиль</h1>
        <p>Статистика поединков, победы и любимые кейсы будут сохраняться в вашем личном кабинете.</p>
        <form action="/api/site/register" method="post">
          <div className="auth-name-grid">
            <label>ИМЯ<input name="firstName" autoComplete="given-name" required /></label>
            <label>ФАМИЛИЯ<input name="lastName" autoComplete="family-name" required /></label>
          </div>
          <label htmlFor="register-email">КОРПОРАТИВНАЯ ПОЧТА</label>
          <input id="register-email" name="email" type="email" autoComplete="email" placeholder="name@korusconsulting.ru" required />
          <small className="field-hint">Допустимы адреса @korusconsulting.ru и @mons.ru</small>
          <label htmlFor="register-password">ПАРОЛЬ</label>
          <input id="register-password" name="password" type="password" minLength={8} autoComplete="new-password" required />
          {params.error && <div className="admin-login-error">{ERRORS[params.error] || ERRORS.failed}</div>}
          <button type="submit">ЗАРЕГИСТРИРОВАТЬСЯ</button>
        </form>
        <div className="auth-switch">Уже зарегистрированы? <Link href="/login">Войти</Link></div>
      </section>
    </main>
  );
}
