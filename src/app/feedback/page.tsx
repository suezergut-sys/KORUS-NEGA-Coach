import FeedbackForm from "@/components/FeedbackForm";
import UserSidebar from "@/components/UserSidebar";

export default function FeedbackPage() {
  return (
    <main className="admin-shell user-area-shell">
      <UserSidebar />
      <div className="admin-main feedback-page">
        <header className="admin-page-header">
          <div>
            <span className="admin-eyebrow">ПОМОГИТЕ НАМ СТАТЬ ЛУЧШЕ</span>
            <h1>Обратная связь</h1>
            <p>Расскажите о впечатлениях от конкретного раздела или функции. Можно написать сообщение или надиктовать его, а затем отредактировать расшифровку.</p>
          </div>
        </header>
        <FeedbackForm />
      </div>
    </main>
  );
}
