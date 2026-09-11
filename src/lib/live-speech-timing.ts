import { isMeaningfulUserSpeechTranscript } from "./realtime-interruption";
import type { LiveCaptions } from "./live-conversation";

// Caption timestamps share the Live session clock; pause boundaries are kept separately.
export function liveSpeechTiming(captions: LiveCaptions) {
  const userSpeakingDurationsMs: number[] = [];
  const opponentSpeakingDurationsMs: number[] = [];
  const userResponseTimesMs: number[] = [];
  let interruptionCount = 0;
  const boundaries = [...new Set([...captions.segmentStarts, captions.rows.length])];
  for (let segment = 0; segment < boundaries.length - 1; segment += 1) {
    let opponentEnd: number | null = null;
    const rows = captions.rows.slice(boundaries[segment], boundaries[segment + 1]).sort((a, b) => a.startMs - b.startMs);
    for (const row of rows) {
      if (!isMeaningfulUserSpeechTranscript(row.text) || row.endMs <= row.startMs) continue;
      if (row.author === "Оппонент") {
        opponentSpeakingDurationsMs.push(row.endMs - row.startMs);
        opponentEnd = Math.max(opponentEnd ?? 0, row.endMs);
      } else {
        userSpeakingDurationsMs.push(row.endMs - row.startMs);
        if (opponentEnd !== null) {
          if (row.startMs < opponentEnd) interruptionCount += 1;
          else userResponseTimesMs.push(row.startMs - opponentEnd);
          opponentEnd = null;
        }
      }
    }
  }
  return { opponentTimingSource: "live_transcript", userSpeakingDurationsMs, opponentSpeakingDurationsMs, userResponseTimesMs, interruptionCount };
}
