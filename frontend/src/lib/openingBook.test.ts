import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { getOpeningBookMove } from "./openingBook";

describe("getOpeningBookMove", () => {
  it("returns a legal main-line move for a known opening position", () => {
    const game = new Chess();
    const move = getOpeningBookMove(game, () => 0);

    expect(move).toBeDefined();
    expect(game.moves({ verbose: true })).toContainEqual(move);
  });

  it("hands play to search after eight plies", () => {
    const game = new Chess();
    for (const uci of ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5", "a7a6", "b5a4", "g8f6"]) {
      game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4) });
    }

    expect(getOpeningBookMove(game, () => 0)).toBeUndefined();
  });
});
