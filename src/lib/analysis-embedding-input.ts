import { buildEmbeddingInputs } from "@/lib/embedding-input";

export function buildTrainingEmbeddingInputs(input: {
  caseContext: string;
  caseGoal: string;
  caseConstraints: string[];
  transcript: string;
}) {
  return buildEmbeddingInputs([
    {
      title: "КОНТЕКСТ И ЦЕЛЬ КЕЙСА",
      text: `${input.caseContext}\n${input.caseGoal}\n${input.caseConstraints.join("\n")}`,
    },
    { title: "СТЕНОГРАММА", text: input.transcript },
  ]);
}
