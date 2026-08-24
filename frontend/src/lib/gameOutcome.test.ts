import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { getGameOutcome } from "./gameOutcome";

describe("getGameOutcome", () => {
  it("identifies checkmate and its winner", () => {
    const game = new Chess("7k/6Q1/6K1/8/8/8/8/8 b - - 0 1");

    expect(getGameOutcome(game)).toEqual({ result: "1-0", termination: "checkmate" });
  });

  it("distinguishes stalemate from checkmate", () => {
    const game = new Chess("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");

    expect(getGameOutcome(game)).toEqual({ result: "1/2-1/2", termination: "stalemate" });
  });

  it("identifies insufficient material", () => {
    const game = new Chess("8/8/8/8/8/8/8/K6k w - - 0 1");

    expect(getGameOutcome(game)).toEqual({
      result: "1/2-1/2",
      termination: "insufficient material",
    });
  });

  it("identifies the fifty-move rule", () => {
    const game = new Chess("8/8/8/8/8/8/R7/K6k w - - 100 51");

    expect(getGameOutcome(game)).toEqual({
      result: "1/2-1/2",
      termination: "fifty-move rule",
    });
  });

  it("identifies threefold repetition", () => {
    const game = new Chess();
    for (let cycle = 0; cycle < 2; cycle += 1) {
      game.move("Nf3");
      game.move("Nf6");
      game.move("Ng1");
      game.move("Ng8");
    }

    expect(getGameOutcome(game)).toEqual({
      result: "1/2-1/2",
      termination: "threefold repetition",
    });
  });

  it("returns an unfinished result for a live position", () => {
    expect(getGameOutcome(new Chess())).toEqual({ result: "*" });
  });
});
