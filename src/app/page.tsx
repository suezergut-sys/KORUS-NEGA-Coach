import VoiceArena from "@/components/VoiceArena";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export default async function Home() {
  return <VoiceArena isAdministrator={await isAdminAuthenticated()} />;
}
