import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";

import { parseStoredGame, rebuildPositionCounts } from "./localGameSocket";
import type { GameMoveMessage } from "./websocket";

describe("active local game state", () => {
  it("rebuilds threefold repetition counts from persisted moves", () => {
    const moves: GameMoveMessage[] = [
      { color: "w", san: "Nf3" }, { color: "b", san: "Nf6" },
      { color: "w", san: "Ng1" }, { color: "b", san: "Ng8" },
      { color: "w", san: "Nf3" }, { color: "b", san: "Nf6" },
      { color: "w", san: "Ng1" }, { color: "b", san: "Ng8" },
    ];
    const rebuilt = rebuildPositionCounts(moves);
    const initialKey = new Chess().fen().split(" ").slice(0, 4).join(" ");

    expect(rebuilt?.fen.split(" ").slice(0, 4).join(" ")).toBe(initialKey);
    expect(rebuilt?.counts[initialKey]).toBe(3);

    const restored = parseStoredGame({
      gameId: "repeated-game",
      fen: rebuilt!.fen,
      playerColor: "white",
      timeControlMs: 300_000,
      incrementMs: 0,
      playerTimeMs: 250_000,
      aiTimeMs: 250_000,
      activeClock: "player",
      lastTick: 0,
      moves,
      persistedAt: Date.now(),
    }, "repeated-game");
    expect(restored?.result).toBe("1/2-1/2");
    expect(restored?.termination).toBe("threefold repetition");
    expect(restored?.activeClock).toBeNull();
  });

  it("rejects corrupt FENs, clocks, and move histories", () => {
    const valid = {
      gameId: "game-1",
      fen: new Chess().fen(),
      playerColor: "white",
      timeControlMs: 300_000,
      incrementMs: 0,
      playerTimeMs: 299_000,
      aiTimeMs: 300_000,
      activeClock: "player",
      lastTick: 0,
      moves: [],
      persistedAt: Date.now(),
    };

    expect(parseStoredGame(valid, "game-1")).not.toBeNull();
    expect(parseStoredGame({ ...valid, fen: "not a fen" }, "game-1")).toBeNull();
    expect(parseStoredGame({ ...valid, playerTimeMs: Number.NaN }, "game-1")).toBeNull();
    expect(parseStoredGame({ ...valid, activeClock: "attacker" }, "game-1")).toBeNull();
    expect(parseStoredGame({ ...valid, moves: [{ color: "w", san: "not-a-move" }] }, "game-1")).toBeNull();
    const e4 = new Chess();
    e4.move("e4");
    expect(parseStoredGame({
      ...valid,
      fen: e4.fen(),
      moves: [{ color: "w", san: "e4", from: "a1", to: "a8", captured: "q" }],
    }, "game-1")).toBeNull();
    expect(parseStoredGame({
      ...valid,
      result: "1-0",
      termination: "checkmate",
      activeClock: null,
    }, "game-1")).toBeNull();
  });
});
