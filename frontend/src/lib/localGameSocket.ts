import { Chess } from "chess.js";
import { calculateAIMove } from "@/lib/wasmEngine";
import type { ClientMessage, ServerMessage } from "@/lib/websocket";

type LocalSocket = WebSocket & {
  readyState: number;
};

interface LocalGameState {
  gameId: string;
  fen: string;
  playerColor: "white" | "black";
  timeControlMs: number;
  incrementMs: number;
  playerTimeMs: number;
  aiTimeMs: number;
  activeClock: "player" | "ai" | null;
  lastTick: number;
  result?: string;
  termination?: string;
}

const localGames = new Map<string, LocalGameState>();
const subscribers = new Map<string, Set<(msg: ServerMessage) => void>>();

function createGameId(): string {
  return crypto.randomUUID();
}

function timeoutResult(state: LocalGameState): string {
  const playerIsWhite = state.playerColor === "white";
  if (state.activeClock === "player") return playerIsWhite ? "0-1" : "1-0";
  return playerIsWhite ? "1-0" : "0-1";
}

export function createLocalGameSocket(
  onMessage: (msg: ServerMessage) => void,
  onOpen?: () => void,
  onClose?: () => void
): WebSocket {
  let state: LocalGameState | null = null;
  let timer: number | null = null;
  let subscribedGameId: string | null = null;

  const dispatch = (msg: ServerMessage) => {
    window.setTimeout(() => onMessage(msg), 0);
  };

  const subscribeToGame = (gameId: string) => {
    if (subscribedGameId && subscribedGameId !== gameId) {
      subscribers.get(subscribedGameId)?.delete(dispatch);
    }
    subscribedGameId = gameId;
    const gameSubscribers = subscribers.get(gameId) ?? new Set<(msg: ServerMessage) => void>();
    gameSubscribers.add(dispatch);
    subscribers.set(gameId, gameSubscribers);
  };

  const publishToGame = (gameId: string, msg: ServerMessage) => {
    const gameSubscribers = subscribers.get(gameId);
    if (!gameSubscribers || gameSubscribers.size === 0) {
      dispatch(msg);
      return;
    }
    for (const subscriber of gameSubscribers) subscriber(msg);
  };

  const publishTime = () => {
    if (!state) return;
    publishToGame(state.gameId, {
      type: "time_update",
      gameId: state.gameId,
      playerTimeMs: Math.max(0, state.playerTimeMs),
      aiTimeMs: Math.max(0, state.aiTimeMs),
    });
  };

  const applyClock = () => {
    if (!state || !state.activeClock || state.result) return;
    const now = performance.now();
    const elapsed = now - state.lastTick;
    state.lastTick = now;
    if (state.activeClock === "player") state.playerTimeMs -= elapsed;
    else state.aiTimeMs -= elapsed;

    if (state.playerTimeMs <= 0 || state.aiTimeMs <= 0) {
      state.result = timeoutResult(state);
      state.termination = "timeout";
      state.activeClock = null;
      publishToGame(state.gameId, {
        type: "game_ended",
        gameId: state.gameId,
        result: state.result,
        termination: state.termination,
        updatedFen: state.fen,
      });
    }
    publishTime();
  };

  const ensureTimer = () => {
    if (timer) return;
    timer = window.setInterval(applyClock, 250);
  };

  const runAIMove = async () => {
    if (!state || state.result) return;
    applyClock();
    state.activeClock = "ai";
    state.lastTick = performance.now();
    publishTime();

    try {
      const ai = await calculateAIMove(state.fen);
      if (!state || state.result) return;
      applyClock();
      if (ai.updated_fen) state.fen = ai.updated_fen;
      if (ai.result && ai.result !== "*") {
        state.result = ai.result;
        state.termination = ai.termination ?? "checkmate";
        state.activeClock = null;
      } else {
        state.aiTimeMs += state.incrementMs;
        state.activeClock = "player";
      }
      state.lastTick = performance.now();
      publishToGame(state.gameId, {
        type: "ai_move",
        updatedFen: state.fen,
        result: ai.result,
        san: ai.move?.san,
        fromSquare: ai.move?.from,
        toSquare: ai.move?.to,
        captured: ai.captured,
      });
      publishTime();
    } catch (error) {
      dispatch({
        type: "error",
        message: error instanceof Error ? error.message : "Local WASM engine failed",
      });
    }
  };

  const socket = {
    readyState: WebSocket.CONNECTING,
    send(raw: string) {
      const msg = JSON.parse(raw) as ClientMessage;
      if (msg.type === "start_game") {
        const game = new Chess();
        const gameId = createGameId();
        state = {
          gameId,
          fen: game.fen(),
          playerColor: msg.playerColor,
          timeControlMs: msg.timeControlMs,
          incrementMs: msg.incrementMs ?? 0,
          playerTimeMs: msg.timeControlMs,
          aiTimeMs: msg.timeControlMs,
          activeClock: msg.playerColor === "white" ? "player" : "ai",
          lastTick: performance.now(),
        };
        localGames.set(gameId, state);
        subscribeToGame(gameId);
        ensureTimer();
        dispatch({
          type: "game_started",
          gameId: state.gameId,
          fen: state.fen,
          timeControlMs: state.timeControlMs,
          incrementMs: state.incrementMs,
          playerTimeMs: state.playerTimeMs,
          aiTimeMs: state.aiTimeMs,
        });
        publishTime();
      } else if (msg.type === "player_move" || msg.type === "promotion_move") {
        if (!state) return;
        applyClock();
        state.fen = msg.fen;
        state.playerTimeMs += state.incrementMs;
        state.activeClock = "ai";
        state.lastTick = performance.now();
        void runAIMove();
      } else if (msg.type === "request_ai_move") {
        if (!state) return;
        state.fen = msg.fen;
        void runAIMove();
      } else if (msg.type === "subscribe") {
        state = localGames.get(msg.gameId) ?? state;
        if (!state) return;
        subscribeToGame(state.gameId);
        ensureTimer();
        dispatch({
          type: "game_state",
          gameId: state.gameId,
          fen: state.fen,
          playerTimeMs: state.playerTimeMs,
          aiTimeMs: state.aiTimeMs,
          timeControlMs: state.timeControlMs,
          incrementMs: state.incrementMs,
          playerColor: state.playerColor,
          result: state.result,
          termination: state.termination,
        });
      } else if (msg.type === "ping") {
        dispatch({ type: "pong" });
      }
    },
    close() {
      socket.readyState = WebSocket.CLOSED;
      if (subscribedGameId) subscribers.get(subscribedGameId)?.delete(dispatch);
      if (timer) window.clearInterval(timer);
      timer = null;
      onClose?.();
    },
  } as LocalSocket;

  window.setTimeout(() => {
    if (socket.readyState === WebSocket.CONNECTING) {
      socket.readyState = WebSocket.OPEN;
      onOpen?.();
    }
  }, 0);

  return socket;
}
