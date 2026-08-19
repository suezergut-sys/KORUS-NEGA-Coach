import VoiceArena from "@/components/VoiceArena";
import { isPlatformAdministrator } from "@/lib/admin-access";
import { STANDARD_DAILY_TRAINING_LIMIT } from "@/lib/training-quota";
import { getDailyTrainingQuota } from "@/lib/training-quota-server";
import { getCurrentUserSession } from "@/lib/user-auth";

export default async function Home() {
  const session = await getCurrentUserSession();
  const isAdministrator = isPlatformAdministrator(session?.email);
  const trainingQuota = session
    ? await getDailyTrainingQuota(session.userId, session.email)
    : { tier: "standard" as const, limit: STANDARD_DAILY_TRAINING_LIMIT, used: STANDARD_DAILY_TRAINING_LIMIT, remaining: 0 };
  return <VoiceArena isAdministrator={isAdministrator} initialTrainingQuota={trainingQuota} />;
}
