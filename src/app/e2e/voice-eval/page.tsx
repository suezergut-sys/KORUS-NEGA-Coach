import { notFound } from "next/navigation";
import VoiceArena from "@/components/VoiceArena";

export default function VoiceEvalPage() {
  if (process.env.E2E_TEST_MODE !== "1") notFound();
  return <VoiceArena voiceEvalMode />;
}
