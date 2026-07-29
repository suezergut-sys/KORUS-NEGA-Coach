"use client";

import { useState } from "react";
import type { LearningGoal, PracticeTask, SkillProgressItem } from "@/lib/user-stats";

export default function LearningPlan({
  initialGoal,
  initialTasks,
  skills,
}: {
  initialGoal: LearningGoal;
  initialTasks: PracticeTask[];
  skills: SkillProgressItem[];
}) {
  const [goal, setGoal] = useState(initialGoal);
  const [tasks, setTasks] = useState(initialTasks);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  async function saveGoal() {
    if (saving) return;
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/account/goal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ focusSkill: goal.focus_skill, goalText: goal.goal_text, nextSessionTarget: goal.next_session_target }),
      });
      const payload = await response.json() as { goal?: LearningGoal; error?: string };
      if (!response.ok || !payload.goal) throw new Error(payload.error || "Не удалось сохранить цель.");
      setGoal(payload.goal);
      setNotice("Цель сохранена и будет добавлена в контекст следующей тренировки.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Не удалось сохранить цель.");
    } finally {
      setSaving(false);
    }
  }

  async function updateTask(id: string, status: PracticeTask["status"]) {
    const response = await fetch(`/api/account/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const payload = await response.json() as { error?: string };
    if (!response.ok) {
      setNotice(payload.error || "Не удалось обновить задание.");
      return;
    }
    setTasks((current) => current.map((task) => task.id === id ? { ...task, status, completed_at: status === "completed" ? new Date().toISOString() : null } : task));
  }

  const pending = tasks.filter((task) => task.status === "pending");
  const completed = tasks.filter((task) => task.status === "completed");
  return (
    <section className="learning-plan-grid">
      <article className="learning-goal-card neon-panel">
        <header><span className="admin-eyebrow">ЛИЧНАЯ ЦЕЛЬ</span><h2>Фокус развития</h2></header>
        <label>Навык
          <select value={goal.focus_skill} onChange={(event) => setGoal((current) => ({ ...current, focus_skill: event.target.value }))}>
            <option value="">Выберите навык</option>
            {skills.map((skill) => <option key={skill.id} value={skill.label}>{skill.label}</option>)}
          </select>
        </label>
        <label>Цель
          <textarea value={goal.goal_text} onChange={(event) => setGoal((current) => ({ ...current, goal_text: event.target.value }))} placeholder="Например: увереннее фиксировать обязательства и сроки" maxLength={1000} />
        </label>
        <label>Фокус следующей тренировки
          <textarea value={goal.next_session_target} onChange={(event) => setGoal((current) => ({ ...current, next_session_target: event.target.value }))} placeholder="Какое конкретное поведение нужно попробовать" maxLength={1000} />
        </label>
        <button type="button" onClick={() => void saveGoal()} disabled={saving}>{saving ? "СОХРАНЯЕМ…" : "СОХРАНИТЬ ЦЕЛЬ"}</button>
        {notice && <p role="status">{notice}</p>}
      </article>

      <article className="practice-task-card neon-panel">
        <header><span className="admin-eyebrow">СЛЕДУЮЩИЕ ШАГИ</span><h2>Практические задания</h2></header>
        {pending.length ? pending.slice(0, 5).map((task) => (
          <section key={task.id}>
            <strong>{task.skill}</strong>
            <p>{task.practice}</p>
            <small>{task.why}</small>
            <div><button type="button" onClick={() => void updateTask(task.id, "completed")}>ВЫПОЛНЕНО</button><button type="button" onClick={() => void updateTask(task.id, "skipped")}>ПРОПУСТИТЬ</button></div>
          </section>
        )) : <p className="dashboard-empty">Новые задания появятся после следующего методического разбора.</p>}
        {completed.length > 0 && <footer>Выполнено заданий: {completed.length}</footer>}
      </article>
    </section>
  );
}
