import { describe, expect, it } from "vitest";
import { adminMethodologyOptions, DEFAULT_METHODOLOGY_ID, getAdminMethodology, getMethodology, isMethodologyId, methodologyOptions } from "../src/lib/methodologies";

describe("methodology registry", () => {
  it("contains all three product methodologies", () => {
    expect(methodologyOptions()).toEqual([
      { id: "tarasov", name: "Методология Владимира Тарасова" },
      { id: "harvard", name: "Гарвардский метод переговоров" },
      { id: "conflicts", name: "Работа с конфликтами" },
    ]);
  });

  it("exposes the conditionally verified conflicts methodology to participants", () => {
    expect(getMethodology("conflicts").id).toBe("conflicts");
    expect(adminMethodologyOptions()).toContainEqual({ id: "conflicts", name: "Работа с конфликтами" });
    expect(getAdminMethodology("conflicts")).toMatchObject({
      author: "Ирина Матвеева",
      sourceCode: "SRC-003",
      candidateVersion: "conflicts-v0-candidate",
      releaseVersion: "conflicts-v1",
      visibility: "public",
    });
  });

  it("validates only public methodology identifiers", () => {
    expect(isMethodologyId("tarasov")).toBe(true);
    expect(isMethodologyId("harvard")).toBe(true);
    expect(isMethodologyId("conflicts")).toBe(true);
    expect(isMethodologyId("unknown")).toBe(false);
    expect(isMethodologyId(null)).toBe(false);
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
