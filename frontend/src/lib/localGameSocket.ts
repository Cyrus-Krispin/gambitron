import { Chess } from "chess.js";
import { calculateAIMove } from "@/lib/wasmEngine";
import { getGameOutcome } from "@/lib/gameOutcome";
import type { ClientMessage, GameMoveMessage, ServerMessage } from "@/lib/websocket";

type LocalSocket = WebSocket & {
  readyState: number;
};

export interface LocalGameState {
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
  moves: GameMoveMessage[];
  positionCounts: Record<string, number>;
  persistedAt: number;
}

const ACTIVE_GAMES_STORAGE_KEY = "gambitron.activeGames.v1";
const localGames = new Map<string, LocalGameState>();
const subscribers = new Map<string, Set<(msg: ServerMessage) => void>>();

function readStoredGames(): unknown[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ACTIVE_GAMES_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function positionKey(fen: string): string {
  return fen.split(" ").slice(0, 4).join(" ");
}

function isSquare(value: unknown): value is string {
  return typeof value === "string" && /^[a-h][1-8]$/.test(value);
}

function isGameMove(value: unknown): value is GameMoveMessage {
  if (!value || typeof value !== "object") return false;
  const move = value as Record<string, unknown>;
  if (move.color !== "w" && move.color !== "b") return false;
  if (move.san !== undefined && (typeof move.san !== "string" || move.san.length > 32)) return false;
  if (move.from !== undefined && !isSquare(move.from)) return false;
  if (move.to !== undefined && !isSquare(move.to)) return false;
  if (!move.san && (!isSquare(move.from) || !isSquare(move.to))) return false;
  if (move.captured !== undefined && (typeof move.captured !== "string" || !/^[pnbrq]$/.test(move.captured))) return false;
  if (move.promotion !== undefined && !["q", "r", "b", "n"].includes(String(move.promotion))) return false;
  return true;
}

export function rebuildPositionCounts(
  moves: GameMoveMessage[],
): { counts: Record<string, number>; fen: string; moves: GameMoveMessage[] } | null {
  const game = new Chess();
  const counts: Record<string, number> = { [positionKey(game.fen())]: 1 };
  const canonicalMoves: GameMoveMessage[] = [];
  try {
    for (const entry of moves) {
      if (!isGameMove(entry)) return null;
      const played = entry.san
        ? game.move(entry.san)
        : game.move({ from: entry.from!, to: entry.to!, promotion: entry.promotion ?? "q" });
      if (!played || played.color !== entry.color) return null;
      if (entry.san !== undefined && entry.san !== played.san) return null;
      if (entry.from !== undefined && entry.from !== played.from) return null;
      if (entry.to !== undefined && entry.to !== played.to) return null;
      if (entry.captured !== played.captured) return null;
      if (entry.promotion !== played.promotion) return null;
      canonicalMoves.push({
        color: played.color,
        san: played.san,
        from: played.from,
        to: played.to,
        captured: played.captured,
        promotion:
          played.promotion === "q" || played.promotion === "r" ||
          played.promotion === "b" || played.promotion === "n"
            ? played.promotion
            : undefined,
      });
      const key = positionKey(game.fen());
      counts[key] = (counts[key] ?? 0) + 1;
    }
  } catch {
    return null;
  }
  return { counts, fen: game.fen(), moves: canonicalMoves };
}

export function parseStoredGame(value: unknown, expectedGameId: string): LocalGameState | null {
  if (!value || typeof value !== "object") return null;
  const stored = value as Record<string, unknown>;
  const activeClock = stored.activeClock;
  const finite = (candidate: unknown): candidate is number =>
    typeof candidate === "number" && Number.isFinite(candidate);
  if (stored.gameId !== expectedGameId || expectedGameId.length > 128) return null;
  if (stored.playerColor !== "white" && stored.playerColor !== "black") return null;
  if (activeClock !== "player" && activeClock !== "ai" && activeClock !== null) return null;
  if (!finite(stored.timeControlMs) || stored.timeControlMs <= 0 || stored.timeControlMs > 86_400_000) return null;
  if (!finite(stored.incrementMs) || stored.incrementMs < 0 || stored.incrementMs > 3_600_000) return null;
  if (!finite(stored.playerTimeMs) || stored.playerTimeMs < 0 || stored.playerTimeMs > 604_800_000) return null;
  if (!finite(stored.aiTimeMs) || stored.aiTimeMs < 0 || stored.aiTimeMs > 604_800_000) return null;
  if (!finite(stored.persistedAt) || stored.persistedAt <= 0) return null;
  if (!Array.isArray(stored.moves) || stored.moves.length > 1_000 || !stored.moves.every(isGameMove)) return null;
  const allowedTerminations = new Set([
    "checkmate", "stalemate", "insufficient material", "threefold repetition",
    "fifty-move rule", "draw", "timeout",
  ]);
  if (stored.result !== undefined && !["1-0", "0-1", "1/2-1/2"].includes(String(stored.result))) return null;
  if (stored.termination !== undefined && (typeof stored.termination !== "string" || !allowedTerminations.has(stored.termination))) return null;
  if ((stored.result === undefined) !== (stored.termination === undefined)) return null;
  if (typeof stored.fen !== "string") return null;

  try {
    new Chess(stored.fen);
  } catch {
    return null;
  }
  const rebuilt = rebuildPositionCounts(stored.moves);
  if (!rebuilt || rebuilt.fen !== stored.fen) return null;
  const rebuiltGame = new Chess();
  for (const move of rebuilt.moves) rebuiltGame.move(move.san!);
  const outcome = getGameOutcome(rebuiltGame);
  let restoredResult = stored.result as string | undefined;
  let restoredTermination = stored.termination as string | undefined;
  if (restoredTermination === "timeout") {
    if (stored.playerTimeMs > 0 && stored.aiTimeMs > 0) return null;
  } else if (restoredResult !== undefined) {
    if (outcome.result !== restoredResult || outcome.termination !== restoredTermination) return null;
  } else if (outcome.result !== "*") {
    restoredResult = outcome.result;
    restoredTermination = outcome.termination;
  }

  return {
    gameId: expectedGameId,
    fen: stored.fen,
    playerColor: stored.playerColor,
    timeControlMs: stored.timeControlMs,
    incrementMs: stored.incrementMs,
    playerTimeMs: stored.playerTimeMs,
    aiTimeMs: stored.aiTimeMs,
    activeClock: restoredResult ? null : activeClock,
    lastTick: performance.now(),
    result: restoredResult,
    termination: restoredTermination,
    moves: rebuilt.moves,
    positionCounts: rebuilt.counts,
    persistedAt: stored.persistedAt,
  };
}

function persistGame(state: LocalGameState, force = false): void {
  const now = Date.now();
  if (!force && now - state.persistedAt < 1_000) return;
  state.persistedAt = now;
  try {
    const games = readStoredGames().filter(
      (game) => !game || typeof game !== "object" || (game as { gameId?: unknown }).gameId !== state.gameId,
    );
    window.localStorage.setItem(
      ACTIVE_GAMES_STORAGE_KEY,
      JSON.stringify([state, ...games].slice(0, 10)),
    );
  } catch {
    // A live game remains playable in memory when storage is unavailable.
  }
}

function restoreGame(gameId: string): LocalGameState | null {
  const stored = readStoredGames().find(
    (game) => !!game && typeof game === "object" && (game as { gameId?: unknown }).gameId === gameId,
  );
  const state = parseStoredGame(stored, gameId);
  if (!state) return null;
  const elapsed = Math.max(0, Date.now() - state.persistedAt);
  if (!state.result && state.activeClock === "player") state.playerTimeMs -= elapsed;
  if (!state.result && state.activeClock === "ai") state.aiTimeMs -= elapsed;
  if (!state.result && (state.playerTimeMs <= 0 || state.aiTimeMs <= 0)) {
    state.result = timeoutResult(state);
    state.termination = "timeout";
    state.activeClock = null;
  }
  state.playerTimeMs = Math.max(0, state.playerTimeMs);
  state.aiTimeMs = Math.max(0, state.aiTimeMs);
  localGames.set(gameId, state);
  persistGame(state, true);
  return state;
}

function recordPosition(state: LocalGameState, fen: string): number {
  const game = new Chess(fen);
  state.fen = game.fen();
  const key = positionKey(state.fen);
  state.positionCounts[key] = (state.positionCounts[key] ?? 0) + 1;
  return state.positionCounts[key];
}

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
    persistGame(state);
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
      const repetitions = ai.move && ai.updated_fen ? recordPosition(state, ai.updated_fen) : 0;
      const aiResult = repetitions >= 3 ? "1/2-1/2" : ai.result;
      const aiTermination = repetitions >= 3 ? "threefold repetition" : ai.termination;
      if (aiResult && aiResult !== "*") {
        state.result = aiResult;
        state.termination = aiTermination ?? "checkmate";
        state.activeClock = null;
      } else {
        state.aiTimeMs += state.incrementMs;
        state.activeClock = "player";
      }
      state.lastTick = performance.now();
      if (ai.move) {
        state.moves.push({
          captured: ai.captured,
          color: state.playerColor === "white" ? "b" : "w",
          from: ai.move.from,
          to: ai.move.to,
          san: ai.move.san,
          promotion:
            ai.move.promotion === "q" || ai.move.promotion === "r" ||
            ai.move.promotion === "b" || ai.move.promotion === "n"
              ? ai.move.promotion
              : undefined,
        });
      }
      persistGame(state, true);
      publishToGame(state.gameId, {
        type: "ai_move",
        updatedFen: state.fen,
        result: aiResult,
        san: ai.move?.san,
        fromSquare: ai.move?.from,
        toSquare: ai.move?.to,
        captured: ai.captured,
        termination: aiTermination,
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
          moves: [],
          positionCounts: { [positionKey(game.fen())]: 1 },
          persistedAt: 0,
        };
        localGames.set(gameId, state);
        persistGame(state, true);
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
        let played;
        let nextGame: Chess;
        try {
          nextGame = new Chess(state.fen);
          played = msg.type === "player_move" && msg.san
            ? nextGame.move(msg.san)
            : nextGame.move({
                from: msg.from!,
                to: msg.to!,
                promotion: msg.type === "promotion_move" ? msg.promotion : "q",
              });
          const submittedFen = new Chess(msg.fen).fen();
          const playerTurn = state.playerColor === "white" ? "w" : "b";
          if (!played || played.color !== playerTurn || nextGame.fen() !== submittedFen) throw new Error("mismatch");
        } catch {
          dispatch({ type: "error", message: "The move did not match the active game." });
          return;
        }
        state.moves.push({
          captured: played.captured,
          color: played.color,
          from: played.from,
          to: played.to,
          san: played.san,
          promotion:
            played.promotion === "q" || played.promotion === "r" ||
            played.promotion === "b" || played.promotion === "n"
              ? played.promotion
              : undefined,
        });
        const repetitions = recordPosition(state, nextGame.fen());
        const outcome = getGameOutcome(nextGame);
        state.playerTimeMs += state.incrementMs;
        state.activeClock = repetitions >= 3 || outcome.result !== "*" ? null : "ai";
        state.lastTick = performance.now();
        if (repetitions >= 3) {
          state.result = "1/2-1/2";
          state.termination = "threefold repetition";
        } else if (outcome.result !== "*") {
          state.result = outcome.result;
          state.termination = outcome.termination ?? "draw";
        }
        persistGame(state, true);
        if (state.result) {
          publishToGame(state.gameId, {
            type: "game_ended",
            gameId: state.gameId,
            result: state.result,
            termination: state.termination!,
            updatedFen: state.fen,
          });
          return;
        }
        void runAIMove();
      } else if (msg.type === "request_ai_move") {
        if (!state) return;
        try {
          if (new Chess(msg.fen).fen() !== state.fen) throw new Error("mismatch");
        } catch {
          dispatch({ type: "error", message: "The requested position did not match the active game." });
          return;
        }
        void runAIMove();
      } else if (msg.type === "subscribe") {
        state = localGames.get(msg.gameId) ?? restoreGame(msg.gameId) ?? state;
        if (!state || state.gameId !== msg.gameId) {
          dispatch({ type: "error", message: "This game is no longer available. Start a new game." });
          return;
        }
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
          moves: state.moves,
        });
        if (!state.result && state.activeClock === "ai") {
          void runAIMove();
        }
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
