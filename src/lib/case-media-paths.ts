export type CaseMediaRow = { image_path: string | null; audio_path: string | null };

export function uniqueCaseMediaPaths(rows: CaseMediaRow[]) {
  return [...new Set(rows.flatMap((row) => [row.image_path, row.audio_path]).filter((path): path is string => Boolean(path)))];
}
