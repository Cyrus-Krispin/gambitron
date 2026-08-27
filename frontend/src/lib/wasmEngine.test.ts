import { describe, expect, it } from "vitest";
import { calculateAIMove, evaluateQuiescenceForTesting } from "./wasmEngine";

describe("calculateAIMove", () => {
  it("completes at least depth three before the time budget can stop search", async () => {
    const result = await calculateAIMove(
      "r1bq1rk1/pp2bppp/2n1pn2/2pp4/3P4/2P1PN2/PP1NBPPP/R2Q1RK1 w - - 2 9",
      { maxDepth: 7, timeLimitMs: 10 },
    );

    expect(result.search?.depth).toBeGreaterThanOrEqual(3);
  });

  it("plays a book response during the first four moves before searching", async () => {
    const result = await calculateAIMove(
      "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
    );

    expect(["Nf3", "Bc4", "Bb5", "d4"]).toContain(result.move?.san);
    expect(result.search).toBeUndefined();
  });

  it("searches legal check evasions instead of accepting a stand-pat score", async () => {
    const result = await evaluateQuiescenceForTesting(
      "7k/8/8/8/8/8/7r/7K w - - 0 1",
      -2_000,
      -1_000,
    );

    expect(Math.abs(result.score)).toBe(0);
    expect(result.nodes).toBeGreaterThan(1);
  });

  it("reuses quiet-cutoff history for the original side to move", async () => {
    const result = await calculateAIMove(
      "rn1qkb1r/p1p1pppp/3p3n/1p6/1P1P1P2/1bP5/P3P1PP/RNBQKBNR w KQkq - 1 6",
      { maxDepth: 4, timeLimitMs: 30_000, nodeLimit: 500_000 },
    );

    expect(result.move?.san).toBe("axb3");
    expect(result.search?.depth).toBe(4);
    expect(result.search?.nodes).toBeLessThanOrEqual(8_000);
  });
});
