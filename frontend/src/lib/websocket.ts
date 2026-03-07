/** WebSocket client for Gambitron game communication. */

export interface StartGamePayload {
  type: "start_game";
  timeControlMs: number;
  playerColor: "white" | "black";
}

export interface PlayerMovePayload {
  type: "player_move";
  gameId: string;
  fen: string;
  san?: string;
  from?: string;
  to?: string;
}

export interface PromotionMovePayload {
  type: "promotion_move";
  gameId: string;
  fen: string;
  from: string;
  to: string;
  promotion: "q" | "r" | "b" | "n";
}

export interface RequestAIMovePayload {
  type: "request_ai_move";
  gameId: string;
  fen: string;
}

export interface PingPayload {
  type: "ping";
}

export type ClientMessage =
  | StartGamePayload
  | PlayerMovePayload
  | PromotionMovePayload
  | RequestAIMovePayload
  | PingPayload;

export interface GameStartedMessage {
  type: "game_started";
  gameId: string;
  fen: string;
  timeControlMs: number;
}

export interface AIMoveMessage {
  type: "ai_move";
  updatedFen: string;
  result: string;
  san?: string;
  fromSquare?: string;
  toSquare?: string;
}

export interface GameEndedMessage {
  type: "game_ended";
  gameId: string;
  result: string;
  termination: string;
  updatedFen?: string;
  aiSan?: string;
  aiFromSquare?: string;
  aiToSquare?: string;
}

export interface ErrorMessage {
  type: "error";
  message: string;
}

export interface PongMessage {
  type: "pong";
}

export type ServerMessage =
  | GameStartedMessage
  | AIMoveMessage
  | GameEndedMessage
  | ErrorMessage
  | PongMessage;

const DEFAULT_WS_URL = "ws://localhost:8000/ws";
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY_MS = 1000;

export function getWsUrl(): string {
  const url = import.meta.env.VITE_WS_URL || DEFAULT_WS_URL;
  console.log("[WS] getWsUrl:", url, "VITE_WS_URL:", import.meta.env.VITE_WS_URL);
  return url;
}

export function createGameSocket(
  onMessage: (msg: ServerMessage) => void,
  onOpen?: () => void,
  onClose?: () => void,
  onError?: (err: Event) => void
): WebSocket {
  const url = getWsUrl();
  console.log("[WS] createGameSocket connecting to:", url);
  const ws = new WebSocket(url);

  ws.onopen = () => {
    console.log("[WS] onopen - connected to", url);
    onOpen?.();
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data) as ServerMessage;
      console.log("[WS] onmessage:", msg.type, msg);
      onMessage(msg);
    } catch {
      console.warn("[WS] onmessage parse error:", event.data);
    }
  };

  ws.onclose = (event) => {
    console.log("[WS] onclose", event.code, event.reason || "(no reason)");
    onClose?.();
  };

  ws.onerror = (err) => {
    console.error("[WS] onerror", err);
    onError?.(err);
  };

  return ws;
}

export function sendMessage(ws: WebSocket, msg: ClientMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    console.log("[WS] sendMessage", msg.type, msg);
    ws.send(JSON.stringify(msg));
  } else {
    console.warn("[WS] sendMessage skipped - not OPEN, readyState:", ws.readyState);
  }
}

export function createReconnectingSocket(
  onMessage: (msg: ServerMessage) => void,
  onOpen?: () => void,
  onClose?: () => void,
  onError?: (err: Event) => void
): { ws: WebSocket; reconnect: () => void; close: () => void } {
  let ws: WebSocket;
  let attempt = 0;
  let closed = false;

  const connect = () => {
    if (closed) return;
    ws = createGameSocket(onMessage, onOpen, () => {
      onClose?.();
      if (!closed && attempt < MAX_RECONNECT_ATTEMPTS) {
        attempt++;
        const delay = INITIAL_RECONNECT_DELAY_MS * Math.pow(2, attempt - 1);
        setTimeout(connect, delay);
      }
    }, onError);
  };

  connect();

  return {
    get ws() {
      return ws;
    },
    reconnect: () => {
      attempt = 0;
      if (ws?.readyState !== WebSocket.OPEN) {
        connect();
      }
    },
    close: () => {
      closed = true;
      ws?.close();
    },
  };
}
