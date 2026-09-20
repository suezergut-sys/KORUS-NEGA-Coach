import { redirect } from "next/navigation";
import OneCCaseBuilder from "@/components/OneCCaseBuilder";
import { getCurrentUserSession } from "@/lib/user-auth";
import { getOneCCaseCreatorAccess } from "@/lib/one-c-case-access";

export const dynamic = "force-dynamic";

export default async function OneCCaseBuilderPage() {
  const session = await getCurrentUserSession();
  if (!session) redirect("/login");
  const access = await getOneCCaseCreatorAccess(session);
  if (!access.allowed) redirect("/case-library");
  return <OneCCaseBuilder />;
}
