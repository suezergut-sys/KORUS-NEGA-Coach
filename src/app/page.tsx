import VoiceArena from "@/components/VoiceArena";
import { isPlatformAdministrator } from "@/lib/admin-access";
import { STANDARD_DAILY_TRAINING_LIMIT } from "@/lib/training-quota";
import { getDailyTrainingQuota } from "@/lib/training-quota-server";
import { getCurrentUserSession } from "@/lib/user-auth";
import { getUserFullName } from "@/lib/user-profile";

export default async function Home() {
  const session = await getCurrentUserSession();
  const isAdministrator = isPlatformAdministrator(session?.email);
  const [trainingQuota, userFullName] = session
    ? await Promise.all([
      getDailyTrainingQuota(session.userId, session.email),
      getUserFullName(session.userId, session.email || "Пользователь"),
    ])
    : [{ tier: "standard" as const, limit: STANDARD_DAILY_TRAINING_LIMIT, used: STANDARD_DAILY_TRAINING_LIMIT, remaining: 0 }, "Пользователь"];
  return <VoiceArena isAdministrator={isAdministrator} initialTrainingQuota={trainingQuota} userFullName={userFullName} />;
}
