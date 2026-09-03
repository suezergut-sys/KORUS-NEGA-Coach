import { describe, expect, it } from "vitest";
import { fuseMethodologyChunkResults, type RetrievedMethodChunk } from "../src/lib/methodology-server";

function chunk(id: number, similarity: number): RetrievedMethodChunk {
  return { id, similarity, source_id: "source", section_path: `Раздел ${id}`, content: `Фрагмент ${id}` };
}

describe("methodology retrieval fusion", () => {
  it("keeps coverage across negotiation parts and removes duplicates", () => {
    const result = fuseMethodologyChunkResults([
      [chunk(1, 0.9), chunk(2, 0.8), chunk(3, 0.7)],
      [chunk(4, 0.88), chunk(2, 0.82), chunk(1, 0.6)],
      [chunk(5, 0.91), chunk(2, 0.85), chunk(4, 0.7)],
    ], 4);

    expect(result.map((item) => item.id)).toEqual([1, 4, 5, 2]);
    expect(new Set(result.map((item) => item.id))).toHaveProperty("size", result.length);
  });

  it("keeps the original limit for one query", () => {
    const result = fuseMethodologyChunkResults([
      Array.from({ length: 12 }, (_, index) => chunk(index + 1, 1 - index / 100)),
    ], 8);

    expect(result).toHaveLength(8);
    expect(result.map((item) => item.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("represents the beginning, middle and end when there are more parts than result slots", () => {
    const resultSets = Array.from({ length: 30 }, (_, index) => [chunk(index + 1, 0.9)]);
    const result = fuseMethodologyChunkResults(resultSets, 8);

    expect(result).toHaveLength(20);
    expect(result[0].id).toBe(1);
    expect(result.at(-1)?.id).toBe(30);
    expect(result.some((item) => item.id >= 14 && item.id <= 17)).toBe(true);
  });
});
