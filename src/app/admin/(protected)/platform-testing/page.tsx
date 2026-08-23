import PlatformTestingPanel from "@/components/PlatformTestingPanel";
import { DEFAULT_CASE } from "@/lib/default-case";
import type { CaseRole } from "@/lib/case-types";
import type { PlatformTestCaseOption } from "@/lib/platform-test";
import { getSupabaseAdmin } from "@/lib/supabase-server";

function optionFromCase(input: { id: string; title: string; userRole: CaseRole; opponentRole: CaseRole; requiredFirstSpeaker?: unknown }): PlatformTestCaseOption {
  return {
    id: input.id,
    title: input.title,
    participantName: input.userRole.name,
    participantPosition: input.userRole.position,
    opponentName: input.opponentRole.name,
    opponentPosition: input.opponentRole.position,
    opponentVoiceGender: input.opponentRole.voiceGender,
    requiredFirstSpeaker: input.requiredFirstSpeaker === "participant" || input.requiredFirstSpeaker === "opponent" ? input.requiredFirstSpeaker : null,
  };
}

export default async function PlatformTestingPage() {
  const { data, error } = await getSupabaseAdmin()
    .from("negotiation_cases")
    .select("id,title,user_role,opponent_role,required_first_speaker")
    .eq("status", "published")
    .order("title")
    .limit(500);
  if (error) throw new Error(`Кейсы для тестирования: ${error.message}`);

  const cases = [
    optionFromCase({ id: DEFAULT_CASE.id, title: DEFAULT_CASE.title, userRole: DEFAULT_CASE.userRole, opponentRole: DEFAULT_CASE.opponentRole }),
    ...(data || [])
      .filter((item) => item.id !== DEFAULT_CASE.id && item.user_role && item.opponent_role)
      .map((item) => optionFromCase({ id: item.id, title: item.title, userRole: item.user_role as CaseRole, opponentRole: item.opponent_role as CaseRole, requiredFirstSpeaker: item.required_first_speaker })),
  ];

  return (
    <>
      <header className="admin-page-header platform-testing-header">
        <div>
          <span className="admin-eyebrow">АВТОМАТИЧЕСКИЙ КОНТРОЛЬ КАЧЕСТВА</span>
          <h1>Тестирование платформы</h1>
          <p>Запустите автономные переговоры двух AI-ролей, прослушайте речь оппонента, наблюдайте стенограмму и получите отчёт о технических и смысловых аномалиях.</p>
        </div>
      </header>
      <PlatformTestingPanel cases={cases} />
    </>
  );
}
