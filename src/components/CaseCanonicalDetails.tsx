import CaseNegotiationPairs from "@/components/CaseNegotiationPairs";
import type { CaseRole, GeneratedCaseVariant, MethodologyBasis } from "@/lib/case-types";
import type { ReactNode } from "react";

type DetailedCase = Pick<GeneratedCaseVariant,
  "summary" | "situation" | "conflict" | "addressForm" | "userRole" | "opponentRole" | "additionalRoles" |
  "negotiationPairs" | "stakes" | "startSituation" | "difficultyReason" | "evaluationFocus" | "methodologyBasis" |
  "scenarioConditions" | "decisionTerms" | "authorityLimits" | "riskZones" | "successOutcome" |
  "expectedNextSteps" | "methodologyNotes"
>;

const NOT_SET = "Не задано";

function TextValue({ value }: { value?: string }) {
  return <p>{value?.trim() || NOT_SET}</p>;
}

function ListValue({ values }: { values?: string[] }) {
  return values?.length
    ? <ul>{values.map((value, index) => <li key={`${value}-${index}`}>{value}</li>)}</ul>
    : <p>{NOT_SET}</p>;
}

function MethodologyValue({ values }: { values: MethodologyBasis[] }) {
  return values.length
    ? <ul>{values.map((value, index) => <li key={`${value.atomId}-${index}`}><strong>{value.title}:</strong> {value.application}</li>)}</ul>
    : <p>{NOT_SET}</p>;
}

function RoleDetails({ role, index }: { role: CaseRole; index: number }) {
  const row = (label: string, value?: string) => <div><dt>{label}</dt><dd>{value?.trim() || NOT_SET}</dd></div>;
  const list = (label: string, values?: string[]) => row(label, values?.length ? values.join("; ") : "");
  return (
    <article className="case-library-role">
      <span>РОЛЬ {index + 1}</span>
      <h3>{role.name || NOT_SET}</h3>
      <p className="case-library-position">{role.position || NOT_SET}</p>
      <dl>
        {row("Голос персонажа", role.voiceGender === "male" ? "мужской" : role.voiceGender === "female" ? "женский" : "")}
        {row("Открытая цель", role.publicGoal)}
        {list("Интересы", role.interests)}
        {list("Ограничения", role.constraints)}
        {list("Скрытые мотивы", role.hiddenMotives)}
        {list("Ресурсы влияния", role.leverage)}
        {row("Задача в разговоре", role.roleBrief)}
        {row("Стартовая реплика", role.openingLine)}
        {list("Типовые возражения", role.typicalObjections)}
        {list("Рекомендуемые формулировки", role.recommendedPhrases)}
        {list("Запрещённые формулировки", role.forbiddenPhrases)}
      </dl>
    </article>
  );
}

export default function CaseCanonicalDetails({ item }: { item: DetailedCase }) {
  const roles = [item.userRole, item.opponentRole, ...item.additionalRoles];
  const block = (title: string, content: ReactNode) => <article><span>{title}</span>{content}</article>;
  return (
    <div className="canonical-case-details">
      <section className="case-library-context">
        {block("КРАТКОЕ ОПИСАНИЕ", <TextValue value={item.summary} />)}
        {block("КОНТЕКСТ", <TextValue value={item.situation} />)}
        {block("ЦЕНТРАЛЬНЫЙ КОНФЛИКТ", <TextValue value={item.conflict} />)}
        {block("ОБРАЩЕНИЕ", <p>{item.addressForm === "informal" ? "На «ты»" : "На «вы»"}</p>)}
        {block("НАЧАЛЬНАЯ СИТУАЦИЯ", <TextValue value={item.startSituation} />)}
        {block("СТАВКИ", <ListValue values={item.stakes} />)}
        {block("ПОЧЕМУ КЕЙС СЛОЖНЫЙ", <TextValue value={item.difficultyReason} />)}
        {block("ФОКУС ОЦЕНКИ", <ListValue values={item.evaluationFocus} />)}
        {block("СЦЕНАРНЫЕ УСЛОВИЯ", <ListValue values={item.scenarioConditions} />)}
        {block("УСЛОВИЯ РЕШЕНИЯ", <ListValue values={item.decisionTerms} />)}
        {block("ГРАНИЦЫ ПОЛНОМОЧИЙ", <ListValue values={item.authorityLimits} />)}
        {block("ОПАСНЫЕ ЗОНЫ", <ListValue values={item.riskZones} />)}
        {block("УСПЕШНЫЙ ИТОГ", <TextValue value={item.successOutcome} />)}
        {block("ОЖИДАЕМЫЕ СЛЕДУЮЩИЕ ШАГИ", <ListValue values={item.expectedNextSteps} />)}
        {block("МЕТОДИЧЕСКИЕ ПОЯСНЕНИЯ", <TextValue value={item.methodologyNotes} />)}
        {block("МЕТОДИЧЕСКАЯ ОСНОВА", <MethodologyValue values={item.methodologyBasis} />)}
      </section>
      <section className="case-library-roles">
        {roles.map((role, index) => <RoleDetails role={role} index={index} key={`${role.name}-${index}`} />)}
      </section>
      <CaseNegotiationPairs roles={roles} pairs={item.negotiationPairs} />
    </div>
  );
}
