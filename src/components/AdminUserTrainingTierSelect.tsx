"use client";

import { useState } from "react";
import { normalizeTrainingTier, type TrainingTier } from "@/lib/training-quota";

export default function AdminUserTrainingTierSelect({
  userId,
  userName,
  initialTier,
}: {
  userId: string;
  userName: string;
  initialTier: TrainingTier;
}) {
  const [tier, setTier] = useState(initialTier);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function updateTier(nextValue: string) {
    const nextTier = normalizeTrainingTier(nextValue);
    const previousTier = tier;
    setTier(nextTier);
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trainingTier: nextTier }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Не удалось изменить статус пользователя.");
    } catch (caught) {
      setTier(previousTier);
      setError(caught instanceof Error ? caught.message : "Не удалось изменить статус пользователя.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-training-tier-control">
      <select
        aria-label={`Статус тренировок пользователя ${userName}`}
        value={tier}
        disabled={saving}
        onChange={(event) => void updateTier(event.target.value)}
      >
        <option value="standard">Обычный · 3 в день</option>
        <option value="premium">Премиум · 20 в день</option>
      </select>
      {saving && <small>Сохраняем…</small>}
      {error && <small className="admin-training-tier-error" role="alert">{error}</small>}
    </div>
  );
}
