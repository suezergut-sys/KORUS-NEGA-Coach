import { isPlatformAdministrator } from "@/lib/admin-access";
import { getCurrentUserSession } from "@/lib/user-auth";

export async function GET() {
  const session = await getCurrentUserSession();
  return Response.json({ isAdministrator: isPlatformAdministrator(session?.email) });
}
