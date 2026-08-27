import { describe, expect, it } from "vitest";
import {
  calculateAIMove,
  evaluatePositionForTesting,
  evaluateQuiescenceForTesting,
  searchTimeForTesting,
  transpositionKeyForTesting,
} from "./wasmEngine";

describe("calculateAIMove", () => {
  it("allocates more search time when the game clock can afford it", () => {
    expect(searchTimeForTesting(300_000, 0)).toBeGreaterThanOrEqual(3_000);
    expect(searchTimeForTesting(10_000, 0)).toBeLessThan(searchTimeForTesting(300_000, 0));
    expect(searchTimeForTesting(300_000, 2_000)).toBeGreaterThan(searchTimeForTesting(300_000, 0));
  });

  it("keeps static evaluation stable when only the side to move changes", async () => {
    const white = await evaluatePositionForTesting(
      "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w kq - 4 6",
    );
    const black = await evaluatePositionForTesting(
      "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 b kq - 4 6",
    );

    expect(white).toBe(-black);
  });

  it("scores a nearer checkmate higher than a later checkmate", async () => {
    const fen = "5Q1k/8/6K1/8/8/8/8/8 b - - 1 1";

    expect(await evaluatePositionForTesting(fen, 1)).toBeLessThan(
      await evaluatePositionForTesting(fen, 5),
    );
  });

  it("penalizes doubled isolated pawns instead of rewarding blind advancement", async () => {
    const healthy = await evaluatePositionForTesting("7k/8/8/8/8/2P1P3/8/6KR w - - 0 1");
    const doubled = await evaluatePositionForTesting("7k/8/8/8/2P5/2P5/8/6KR w - - 0 1");

    expect(healthy).toBeGreaterThan(doubled);
  });

  it("rewards king safety over exposing the king in the middlegame", async () => {
    const safe = await evaluatePositionForTesting(
      "rnbq1rk1/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQ1RK1 w - - 4 6",
    );
    const exposed = await evaluatePositionForTesting(
      "rnbq1rk1/pppp1ppp/5n2/4p3/4P3/4KN2/PPPP1PPP/RNBQ3R w - - 4 6",
    );

    expect(safe).toBeGreaterThan(exposed);
  });

  it("rewards preserving castling rights in the opening", async () => {
    const canStillCastle = await evaluatePositionForTesting(
      "r3k2r/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/R3K2R w KQkq - 0 5",
    );
    const gaveUpCastling = await evaluatePositionForTesting(
      "r3k2r/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/R3K2R w kq - 0 5",
    );

    expect(canStillCastle).toBeGreaterThan(gaveUpCastling);
  });

  it("penalizes an early king move that gives up castling", async () => {
    const kingAtHome = await evaluatePositionForTesting(
      "r3k2r/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/R3K2R w - - 0 5",
    );
    const kingMovedToF1 = await evaluatePositionForTesting(
      "r3k2r/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/R4K1R w - - 0 5",
    );

    expect(kingAtHome).toBeGreaterThan(kingMovedToF1);
  });

  it("recognizes a threefold draw supplied by the game history", async () => {
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 8 5";
    const key = fen.split(" ").slice(0, 4).join(" ");
    const result = await calculateAIMove(fen, { positionCounts: { [key]: 3 } });

    expect(result.result).toBe("1/2-1/2");
    expect(result.termination).toBe("threefold repetition");
    expect(result.move).toBeUndefined();
  });

  it("reuses transpositions across different fullmove counters", () => {
    const first = "8/8/8/8/8/8/6k1/6KR w - - 12 20";
    const second = "8/8/8/8/8/8/6k1/6KR w - - 12 27";

    expect(transpositionKeyForTesting(first)).toBe(transpositionKeyForTesting(second));
  });

  it(
    "completes at least depth three before the time budget can stop search",
    async () => {
      const result = await calculateAIMove(
        "r1bq1rk1/pp2bppp/2n1pn2/2pp4/3P4/2P1PN2/PP1NBPPP/R2Q1RK1 w - - 2 9",
        { maxDepth: 7, timeLimitMs: 10 },
      );

      expect(result.search?.depth).toBeGreaterThanOrEqual(3);
    },
    15_000,
  );

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

  it(
    "reuses quiet-cutoff history for the original side to move",
    async () => {
      const result = await calculateAIMove(
        "rn1qkb1r/p1p1pppp/3p3n/1p6/1P1P1P2/1bP5/P3P1PP/RNBQKBNR w KQkq - 1 6",
        { maxDepth: 4, timeLimitMs: 30_000, nodeLimit: 500_000 },
      );

      expect(["axb3", "Qxb3"]).toContain(result.move?.san);
      expect(result.search?.depth).toBe(4);
      expect(result.search?.nodes).toBeLessThanOrEqual(10_000);
    },
    15_000,
  );
});
