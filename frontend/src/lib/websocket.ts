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
  captured?: string;
}

export interface PromotionMovePayload {
  type: "promotion_move";
  gameId: string;
  fen: string;
  from: string;
  to: string;
  promotion: "q" | "r" | "b" | "n";
  captured?: string;
}

export interface RequestAIMovePayload {
  type: "request_ai_move";
  gameId: string;
  fen: string;
}

export interface PingPayload {
  type: "ping";
}

export interface SubscribePayload {
  type: "subscribe";
  gameId: string;
}

export type ClientMessage =
  | StartGamePayload
  | PlayerMovePayload
  | PromotionMovePayload
  | RequestAIMovePayload
  | SubscribePayload
  | PingPayload;

export interface GameStartedMessage {
  type: "game_started";
  gameId: string;
  fen: string;
  timeControlMs: number;
  playerTimeMs?: number;
  aiTimeMs?: number;
}

export interface TimeUpdateMessage {
  type: "time_update";
  gameId: string;
  playerTimeMs: number;
  aiTimeMs: number;
}

export interface GameStateMessage {
  type: "game_state";
  gameId: string;
  fen: string | null;
  playerTimeMs: number;
  aiTimeMs: number;
  timeControlMs: number;
  playerColor: "white" | "black";
  result?: string;
  termination?: string;
}

export interface AIMoveMessage {
  type: "ai_move";
  updatedFen: string;
  result: string;
  san?: string;
  fromSquare?: string;
  toSquare?: string;
  captured?: string;
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
  captured?: string;
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
  | TimeUpdateMessage
  | GameStateMessage
  | AIMoveMessage
  | GameEndedMessage
  | ErrorMessage
  | PongMessage;

const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY_MS = 1000;

export function getWsUrl(): string {
  return import.meta.env.VITE_WS_URL;
}

export function createGameSocket(
  onMessage: (msg: ServerMessage) => void,
  onOpen?: () => void,
  onClose?: () => void,
  onError?: (err: Event) => void
): WebSocket {
  const url = getWsUrl();
  const ws = new WebSocket(url);

  ws.onopen = () => {
    onOpen?.();
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data) as ServerMessage;
      onMessage(msg);
    } catch {
      // ignore parse errors
    }
  };

  ws.onclose = () => {
    onClose?.();
  };

  ws.onerror = (err) => {
    onError?.(err);
  };

  return ws;
}

export function sendMessage(ws: WebSocket, msg: ClientMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

export interface ReconnectingSocketController {
  getWs: () => WebSocket | undefined;
  reconnect: () => void;
  close: () => void;
}

export function createReconnectingSocket(
  onMessage: (msg: ServerMessage) => void,
  onOpen?: () => void,
  onClose?: () => void,
  onError?: (err: Event) => void,
  wsRef?: { current: WebSocket | null }
): ReconnectingSocketController {
  let ws: WebSocket | undefined;
  let attempt = 0;
  let closed = false;

  const connect = () => {
    if (closed) return;
    ws = createGameSocket(
      onMessage,
      () => {
        if (wsRef) wsRef.current = ws ?? null;
        onOpen?.();
      },
      () => {
        onClose?.();
        if (!closed && attempt < MAX_RECONNECT_ATTEMPTS) {
          attempt++;
          const delay = INITIAL_RECONNECT_DELAY_MS * Math.pow(2, attempt - 1);
          setTimeout(connect, delay);
        }
      },
      onError
    );
    if (wsRef) wsRef.current = ws;
  };

  connect();

  return {
    getWs: () => ws,
    reconnect: () => {
      attempt = 0;
      if (ws?.readyState !== WebSocket.OPEN) {
        connect();
      }
    },
    close: () => {
      closed = true;
      ws?.close();
      if (wsRef) wsRef.current = null;
    },
  };
}
