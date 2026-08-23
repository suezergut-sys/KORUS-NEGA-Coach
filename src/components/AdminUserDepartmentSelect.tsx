"use client";

import { useState } from "react";

type DepartmentOption = { id: string; name: string };

export default function AdminUserDepartmentSelect({
  userId,
  userName,
  initialDepartmentId,
  departments,
}: {
  userId: string;
  userName: string;
  initialDepartmentId: string | null;
  departments: DepartmentOption[];
}) {
  const [departmentId, setDepartmentId] = useState(initialDepartmentId || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function updateDepartment(nextValue: string) {
    const previous = departmentId;
    setDepartmentId(nextValue);
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ departmentId: nextValue || null }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Не удалось изменить департамент.");
    } catch (caught) {
      setDepartmentId(previous);
      setError(caught instanceof Error ? caught.message : "Не удалось изменить департамент.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-training-tier-control">
      <select
        aria-label={`Департамент пользователя ${userName}`}
        value={departmentId}
        disabled={saving}
        onChange={(event) => void updateDepartment(event.target.value)}
      >
        <option value="">Не назначен</option>
        {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
      </select>
      {saving && <small>Сохраняем…</small>}
      {error && <small className="admin-training-tier-error" role="alert">{error}</small>}
    </div>
  );
}
