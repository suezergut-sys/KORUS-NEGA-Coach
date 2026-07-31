import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-server";

export async function cleanupStaleDuelAudio(maxAgeMs = 24 * 60 * 60 * 1000) {
  const storage = getSupabaseAdmin().storage.from("duel-recordings");
  const { data: root, error: rootError } = await storage.list("", { limit: 1000 });
  if (rootError) throw rootError;

  const cutoff = Date.now() - maxAgeMs;
  const stalePaths: string[] = [];
  for (const entry of root || []) {
    if (entry.id) {
      if (entry.created_at && new Date(entry.created_at).getTime() < cutoff) stalePaths.push(entry.name);
      continue;
    }
    const { data: files, error } = await storage.list(entry.name, { limit: 1000 });
    if (error) throw error;
    for (const file of files || []) {
      if (file.id && file.created_at && new Date(file.created_at).getTime() < cutoff) {
        stalePaths.push(`${entry.name}/${file.name}`);
      }
    }
  }

  if (stalePaths.length) {
    const { error } = await storage.remove(stalePaths);
    if (error) throw error;
  }
  return stalePaths.length;
}
