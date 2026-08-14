import { CASE_ADDED_MESSAGE } from "@/lib/case-approval-navigation";

export default function CaseAddedNotice({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="case-added-notice" role="status" aria-live="polite">
      <span aria-hidden="true">✓</span>
      <strong>{CASE_ADDED_MESSAGE}</strong>
      <button type="button" onClick={onDismiss} aria-label="Закрыть сообщение">×</button>
    </div>
  );
}
