import { Chess } from "chess.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameStartedMessage, ServerMessage } from "./websocket";

const { calculateAIMove } = vi.hoisted(() => ({
  calculateAIMove: vi.fn(() => new Promise<never>(() => undefined)),
}));

vi.mock("@/lib/wasmEngine", () => ({ calculateAIMove }));

import { createLocalGameSocket } from "./localGameSocket";

describe("local AI scheduling", () => {
  beforeEach(() => {
    calculateAIMove.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lets the browser paint the player's move before starting AI calculation", () => {
    const timeouts: Array<() => void> = [];
    const animationFrames: Array<FrameRequestCallback> = [];
    const messages: ServerMessage[] = [];
    const storedValues = new Map<string, string>();

    vi.stubGlobal("WebSocket", class WebSocketStub {
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSED = 3;
    });
    vi.stubGlobal("window", {
      setTimeout: (callback: () => void) => {
        timeouts.push(callback);
        return timeouts.length;
      },
      setInterval: () => 1,
      clearInterval: () => undefined,
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        animationFrames.push(callback);
        return animationFrames.length;
      },
      localStorage: {
        getItem: (key: string) => storedValues.get(key) ?? null,
        setItem: (key: string, value: string) => storedValues.set(key, value),
      },
    });

    const socket = createLocalGameSocket(
      (message) => messages.push(message),
      () => socket.send(JSON.stringify({
        type: "start_game",
        timeControlMs: 300_000,
        playerColor: "white",
      })),
    );

    timeouts.shift()?.();
    while (timeouts.length > 0) timeouts.shift()?.();

    const started = messages.find(
      (message): message is GameStartedMessage => message.type === "game_started",
    );
    expect(started?.gameId).toBeDefined();

    const game = new Chess(started!.fen);
    const move = game.move("e4");
    socket.send(JSON.stringify({
      type: "player_move",
      gameId: started!.gameId,
      fen: game.fen(),
      san: move.san,
      from: move.from,
      to: move.to,
    }));

    expect(calculateAIMove).not.toHaveBeenCalled();
    expect(animationFrames).toHaveLength(1);

    animationFrames.shift()?.(performance.now());
    expect(calculateAIMove).not.toHaveBeenCalled();

    while (timeouts.length > 0) timeouts.shift()?.();
    expect(calculateAIMove).toHaveBeenCalledOnce();

    socket.close();
  });
});
