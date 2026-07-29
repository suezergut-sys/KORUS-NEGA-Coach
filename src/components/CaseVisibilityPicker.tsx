"use client";

import type { CaseVisibility } from "@/lib/case-visibility";

export default function CaseVisibilityPicker({
  value,
  onChange,
  disabled = false,
  compact = false,
}: {
  value: CaseVisibility;
  onChange: (value: CaseVisibility) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <fieldset className={`case-visibility-picker ${compact ? "compact" : ""}`} disabled={disabled}>
      <legend>КТО СМОЖЕТ ОТРАБАТЫВАТЬ КЕЙС</legend>
      <div>
        <label className={value === "public" ? "selected" : ""}>
          <input type="radio" name={compact ? "quick-case-visibility" : "case-visibility"} checked={value === "public"} onChange={() => onChange("public")} />
          <span><strong>Открыть для всех</strong><small>Кейс появится у всех пользователей платформы.</small></span>
        </label>
        <label className={value === "private" ? "selected" : ""}>
          <input type="radio" name={compact ? "quick-case-visibility" : "case-visibility"} checked={value === "private"} onChange={() => onChange("private")} />
          <span><strong>Скрыть для всех</strong><small>Полное содержание и запуск будут доступны только вам.</small></span>
        </label>
      </div>
    </fieldset>
  );
}
