import { describe, expect, it } from "vitest";
import { publicCaseAuthor, sortCaseLibrary, type CaseLibraryItem } from "../src/lib/case-library";

const base = { id: "1", slug: "one", title: "One", summary: "", situation: "", conflict: "", userRole: {}, opponentRole: {}, additionalRoles: [], stakes: [], startSituation: "", difficultyReason: "", evaluationFocus: [], methodologyBasis: [], origin: "builder", visibility: "public", comicImage: null } as unknown as CaseLibraryItem;

describe("case library", () => {
  it("shows an author name without an email", () => {
    expect(publicCaseAuthor("Иван Петров · ivan.petrov@example.com", "builder")).toBe("Иван Петров");
    expect(publicCaseAuthor("author@example.com", "builder")).toBe("Автор не указан");
    expect(publicCaseAuthor(null, "seed")).toBe("Команда KORUS");
  });

  it("sorts by plays and then by creation date", () => {
    const items = [
      { ...base, id: "old", plays: 4, createdAt: "2026-01-01T00:00:00Z", createdBy: "A" },
      { ...base, id: "popular", plays: 8, createdAt: "2025-01-01T00:00:00Z", createdBy: "B" },
      { ...base, id: "new", plays: 4, createdAt: "2026-02-01T00:00:00Z", createdBy: "C" },
    ];
    expect(sortCaseLibrary(items).map((item) => item.id)).toEqual(["popular", "new", "old"]);
  });
});
