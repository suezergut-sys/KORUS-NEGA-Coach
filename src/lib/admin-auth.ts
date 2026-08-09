import "server-only";

import { redirect } from "next/navigation";
import { isPlatformAdministrator } from "@/lib/admin-access";
import { getCurrentUserSession } from "@/lib/user-auth";

export async function isAdminAuthenticated() {
  return isPlatformAdministrator((await getCurrentUserSession())?.email);
}

export async function requireAdmin() {
  if (!(await isAdminAuthenticated())) redirect("/");
}
