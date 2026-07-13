import { describe, expect, it } from "vitest";
import { uniqueCaseMediaPaths } from "../src/lib/case-media-paths";

describe("case deletion", () => {
  it("collects every unique comic image and narration path", () => {
    expect(uniqueCaseMediaPaths([
      { image_path: "case/generation/panel-1.webp", audio_path: "case/generation/role-0-panel-1.mp3" },
      { image_path: "case/generation/panel-1.webp", audio_path: "case/generation/role-1-panel-1.mp3" },
      { image_path: null, audio_path: null },
    ])).toEqual([
      "case/generation/panel-1.webp",
      "case/generation/role-0-panel-1.mp3",
      "case/generation/role-1-panel-1.mp3",
    ]);
  });
});
