import "server-only";

import { isAdminAuthenticated } from "@/lib/admin-auth";

export async function rejectNonAdminApiRequest() {
  return await isAdminAuthenticated()
    ? null
    : Response.json({ error: "Недостаточно прав." }, { status: 403 });
}
