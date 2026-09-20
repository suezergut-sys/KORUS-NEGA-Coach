import "server-only";

import { ANALYSIS_MODEL, getOpenAI } from "@/lib/openai-server";
import { createCaseVariantsSchema, type GeneratedCaseVariant } from "@/lib/case-types";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getRegisteredMethodology } from "@/lib/methodologies";
import { getMethodologySource } from "@/lib/methodology-server";
import type { OneCCaseBrief } from "@/lib/one-c-case-input";

export async function generateOneCCase(brief: OneCCaseBrief): Promise<GeneratedCaseVariant> {
  const db = getSupabaseAdmin();
  const source = await getMethodologySource(db, getRegisteredMethodology("dismissal_1c"));
  const { data: atoms, error } = await db
    .from("method_atoms")
    .select("id,kind,title,statement,source_quote")
    .eq("source_id", source.id)
    .eq("verification_status", "verified")
    .in("kind", ["case_rule", "principle", "stratagem", "evaluation_criterion", "anti_pattern"])
    .limit(40);
  if (error) throw new Error(`Методология 1С: ${error.message}`);

  const methodAtoms = atoms || [];
  const atomIds = methodAtoms.map((atom) => String(atom.id));
  const methodology = methodAtoms.map((atom) =>
    `[АТОМ ${atom.id}] ${atom.kind}: ${atom.title}\n${atom.statement}\nИсточник: ${atom.source_quote}`,
  ).join("\n\n");

  const response = await getOpenAI().responses.create({
    model: ANALYSIS_MODEL,
    reasoning: { effort: "low" },
    instructions: `
Ты создаёшь один подробный приватный учебный кейс для руководителя по корпоративной методологии «1С: разговор об увольнении по соглашению сторон».

Обязательные правила:
1. Ровно две роли. userRole — руководитель, которого будет играть пользователь. opponentRole — увольняемый сотрудник, которого играет AI. additionalRoles всегда пустой массив.
2. У обеих ролей реалистичные полные имена (имя и фамилия), должности отдельно. Руководитель сообщает решение и начинает разговор; сотрудник не знает цель встречи до прямого сообщения руководителя.
3. Кейс должен подробно и непротиворечиво воплотить описание, выбранную основную причину, поведенческий профиль, ограничения/возражения и рамку соглашения. Не добавляй обещаний сверх рамки пользователя.
4. Сотрудник не соглашается мгновенно, последовательно отрабатывает заданные возражения и реагирует на качество ответов руководителя. Одна реплика — одна главная реакция и не более одного вопроса.
5. Поля scenarioConditions, decisionTerms, authorityLimits, riskZones, successOutcome, expectedNextSteps и methodologyNotes заполни подробно. В authorityLimits особенно чётко раздели допустимые предложения и запрещённые обещания.
6. addressForm выбери по исходному описанию; если данных нет — informal. negotiationPairs содержит одну пару 0–1.
7. В methodologyBasis используй только реальные идентификаторы из блоков [АТОМ id]. Не придумывай юридические факты и не обещай юридическую безупречность сценария.
8. Пиши по-русски, конкретно, без упоминания нейросети. Верни ровно один вариант.
    `.trim(),
    input: `
ОПИСАНИЕ СИТУАЦИИ:
${brief.situation}

ОСНОВНАЯ ПРИЧИНА:
${brief.reasons.join("; ") || "не выбрана — вывести из описания"}

ПОВЕДЕНЧЕСКИЙ ПРОФИЛЬ СОТРУДНИКА:
${brief.profiles.join("; ") || "не выбран — вывести из описания"}

ОГРАНИЧЕНИЯ И ВОЗРАЖЕНИЯ:
${brief.objections.join("; ") || "не выбраны — вывести из описания"}

РАМКА СОГЛАШЕНИЯ (ЧТО МОЖНО ПРЕДЛАГАТЬ И ЧТО НЕЛЬЗЯ ОБЕЩАТЬ):
${brief.agreementFrame}

ПРОВЕРЕННАЯ МЕТОДИЧЕСКАЯ БАЗА:
${methodology || "Проверенные атомы пока отсутствуют; оставь methodologyBasis пустым."}
    `.trim(),
    text: {
      format: {
        type: "json_schema",
        name: "private_one_c_dismissal_case",
        strict: true,
        schema: createCaseVariantsSchema(atomIds, 1, 2),
      },
    },
  });

  const parsed = JSON.parse(response.output_text) as { variants?: GeneratedCaseVariant[] };
  const generated = parsed.variants?.[0];
  if (!generated) throw new Error("Не удалось сформировать кейс 1С.");
  generated.additionalRoles = [];
  generated.negotiationPairs = generated.negotiationPairs.filter((pair) => pair.roleAIndex === 0 && pair.roleBIndex === 1).slice(0, 1);
  if (!generated.negotiationPairs.length) {
    generated.negotiationPairs = [{ roleAIndex: 0, roleBIndex: 1, reason: "Руководитель сообщает о решении расстаться, а сотрудник оспаривает причины и условия завершения работы." }];
  }
  return generated;
}
