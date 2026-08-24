import { describe, expect, it } from "vitest";
import { buildReplayMoves, type LocalMoveInput } from "./localHistory";

describe("buildReplayMoves", () => {
  it.each(["q", "r", "b", "n"] as const)(
    "preserves a %s promotion in reconstructed history",
    (promotion) => {
      const history: LocalMoveInput[] = [
        { color: "w", from: "a7", to: "a8", promotion },
      ];

      const [move] = buildReplayMoves(history, "8/P6k/8/8/8/8/8/K7 w - - 0 1");

      expect(move.san).toContain(`=${promotion.toUpperCase()}`);
      expect(move.promotion).toBe(promotion);
    },
  );

  it("rejects an illegal move instead of silently truncating a replay", () => {
    const history: LocalMoveInput[] = [
      { color: "w", from: "e2", to: "e5" },
    ];

    expect(() => buildReplayMoves(history)).toThrow(/ply 1/i);
  });
});
