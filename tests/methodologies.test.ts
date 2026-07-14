import { describe, expect, it } from "vitest";
import { DEFAULT_METHODOLOGY_ID, getMethodology, methodologyOptions } from "../src/lib/methodologies";

describe("methodology registry", () => {
  it("contains the two product methodologies", () => {
    expect(methodologyOptions()).toEqual([
      { id: "tarasov", name: "Методология Владимира Тарасова" },
      { id: "harvard", name: "Гарвардский метод переговоров" },
    ]);
  });

  it("falls back to Tarasov for missing or manipulated input", () => {
    expect(getMethodology(undefined).id).toBe(DEFAULT_METHODOLOGY_ID);
    expect(getMethodology("unknown").sourceCode).toBe("SRC-001");
  });

  it("resolves Harvard metadata without accepting client-supplied source codes", () => {
    expect(getMethodology("harvard")).toMatchObject({
      sourceCode: "SRC-002",
      candidateVersion: "harvard-v0-candidate",
      releaseVersion: "harvard-v1",
    });
  });
});
