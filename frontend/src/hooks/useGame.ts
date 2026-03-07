import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Chess, Square } from "chess.js";
import { playMoveSound } from "@/utils/sounds";
import {
  createGameSocket,
  sendMessage,
  type GameStartedMessage,
  type AIMoveMessage,
  type GameEndedMessage,
  type ErrorMessage,
} from "@/lib/websocket";

export type PlayerColor = "white" | "black";

const START_TIME_MS = 60 * 1000;
const HORIZONTAL = ["a", "b", "c", "d", "e", "f", "g", "h"];
const VERTICAL_WHITE = ["8", "7", "6", "5", "4", "3", "2", "1"];
const VERTICAL_BLACK = ["1", "2", "3", "4", "5", "6", "7", "8"];

function computeResult(game: Chess): string {
  if (!game.isGameOver()) return "*";
  if (game.isCheckmate()) {
    const winner = game.turn() === "w" ? "b" : "w";
    return winner === "w" ? "1-0" : "0-1";
  }
  return "1/2-1/2";
}

function clamp(ms: number): number {
  return ms < 0 ? 0 : ms;
}

export interface UseGameOptions {
  gameId: string | null;
  initialMinutes?: number;
  initialColor?: PlayerColor;
  initialGameState?: { fen: string; timeControlMs: number; playerColor: PlayerColor };
  onGameCreated?: (gameId: string, gameState: { fen: string; timeControlMs: number; playerColor: PlayerColor }) => void;
}

export function useGame(options?: UseGameOptions) {
  const {
    gameId = null,
    initialMinutes = 5,
    initialColor,
    initialGameState,
    onGameCreated,
  } = options ?? {};

  const [chess] = useState(() => new Chess());
  const [boardState, setBoardState] = useState(chess.board());
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [validMoves, setValidMoves] = useState<string[]>([]);

  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [lastFenForRetry, setLastFenForRetry] = useState<string | null>(null);

  const [endgameOpen, setEndgameOpen] = useState(false);
  const [endgameResult, setEndgameResult] = useState("");
  const [endgameReason, setEndgameReason] = useState("");

  const [promotionOpen, setPromotionOpen] = useState(false);
  const [pendingPromotionFrom, setPendingPromotionFrom] = useState<string | null>(null);
  const [pendingPromotionTo, setPendingPromotionTo] = useState<string | null>(null);

  const [playerTimeMs, setPlayerTimeMs] = useState(START_TIME_MS);
  const [aiTimeMs, setAiTimeMs] = useState(START_TIME_MS);
  const [initialTimeMs, setInitialTimeMs] = useState(START_TIME_MS);
  const [aiThinking, setAiThinking] = useState(false);
  const [playerHasMoved, setPlayerHasMoved] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  const [startOpen, setStartOpen] = useState(!initialColor && !initialGameState);
  const [selectedMinutes] = useState(initialMinutes);
  const [playerColor, setPlayerColor] = useState<PlayerColor>(initialColor ?? initialGameState?.playerColor ?? "white");

  const [fenInput, setFenInput] = useState("");
  const isAdmin = typeof window !== "undefined" && window.location.pathname === "/admin";

  const wsRef = useRef<WebSocket | null>(null);
  const currentGameIdRef = useRef<string | null>(gameId);
  const onGameCreatedRef = useRef(onGameCreated);
  onGameCreatedRef.current = onGameCreated;

  const apiBase = useMemo(() => `${import.meta.env.VITE_backend}`, []);

  const playerTurn = playerColor === "white" ? "w" : "b";
  const aiTurn = playerColor === "white" ? "b" : "w";

  const openEndgame = useCallback((result: string, reason: string) => {
    setEndgameResult(result);
    setEndgameReason(reason);
    setEndgameOpen(true);
    setGameEnded(true);
    setAiThinking(false);
    setGameStarted(false);
  }, []);

  const callAIViaRest = useCallback(
    async (fen: string) => {
      setAiThinking(true);
      setLastFenForRetry(fen);
      try {
        const res = await fetch(`${apiBase}?value=${encodeURIComponent(fen)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) throw new Error(`Backend error: ${res.status}`);
        const data = await res.json();
        if (data.updated_fen) {
          chess.load(data.updated_fen);
          setBoardState(chess.board());
          setPlayerHasMoved(true);
          playMoveSound();
        }
        if (data.result && data.result !== "*") {
          openEndgame(data.result, "checkmate");
        }
      } catch (err) {
        setErrorMessage((err as Error)?.message || "Failed to contact backend");
        setErrorOpen(true);
      } finally {
        setAiThinking(false);
      }
    },
    [apiBase, chess, openEndgame]
  );

  const sendPlayerMove = useCallback(
    (fen: string, san?: string, from?: string, to?: string) => {
      if (isAdmin) {
        callAIViaRest(fen);
        return;
      }
      const gid = currentGameIdRef.current;
      if (!gid || gid === "new") return;
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        setErrorMessage("WebSocket not connected");
        setErrorOpen(true);
        return;
      }
      setAiThinking(true);
      setLastFenForRetry(fen);
      sendMessage(ws, {
        type: "player_move",
        gameId: gid,
        fen,
        san,
        from,
        to,
      });
    },
    [isAdmin, callAIViaRest]
  );

  const sendPromotionMove = useCallback(
    (fen: string, from: string, to: string, promotion: "q" | "r" | "b" | "n") => {
      if (isAdmin) {
        callAIViaRest(fen);
        return;
      }
      const gid = currentGameIdRef.current;
      if (!gid || gid === "new") return;
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        setErrorMessage("WebSocket not connected");
        setErrorOpen(true);
        return;
      }
      setAiThinking(true);
      setLastFenForRetry(fen);
      sendMessage(ws, {
        type: "promotion_move",
        gameId: gid,
        fen,
        from,
        to,
        promotion,
      });
    },
    [isAdmin, callAIViaRest]
  );

  const handleRetry = useCallback(() => {
    if (lastFenForRetry && !gameEnded) {
      setErrorOpen(false);
      sendPlayerMove(lastFenForRetry);
    } else setErrorOpen(false);
  }, [lastFenForRetry, gameEnded, sendPlayerMove]);

  const handlePromotionPick = useCallback(
    (piece: "q" | "r" | "b" | "n") => {
      if (!pendingPromotionFrom || !pendingPromotionTo) {
        setPromotionOpen(false);
        return;
      }
      const move = chess.move({
        from: pendingPromotionFrom as Square,
        to: pendingPromotionTo as Square,
        promotion: piece,
      });
      setPromotionOpen(false);
      setPendingPromotionFrom(null);
      setPendingPromotionTo(null);
      if (!move) return;
      setBoardState(chess.board());
      setSelectedSquare(null);
      setValidMoves([]);
      if (!playerHasMoved) setPlayerHasMoved(true);
      playMoveSound();
      if (chess.isGameOver()) {
        openEndgame(computeResult(chess), "checkmate");
        return;
      }
      const fen = chess.fen();
      const from = (move as { from: string }).from;
      const to = (move as { to: string }).to;
      sendPromotionMove(fen, from, to, piece);
    },
    [chess, pendingPromotionFrom, pendingPromotionTo, playerHasMoved, openEndgame, sendPromotionMove]
  );

  const isPromotionSquare = useCallback(
    (squareName: string) => {
      if (playerColor === "white") return squareName.endsWith("8");
      return squareName.endsWith("1");
    },
    [playerColor]
  );

  const handleTileClick = useCallback(
    (squareName: string) => {
      if (aiThinking || chess.isGameOver() || gameEnded) return;
      if (!isAdmin && !gameStarted) return;
      if (chess.turn() !== playerTurn) return;

      if (!selectedSquare) {
        const moves = chess.moves({ square: squareName as Square, verbose: true }).map((m: { to: string }) => m.to);
        if (moves.length > 0) {
          setSelectedSquare(squareName);
          setValidMoves(moves);
        }
        return;
      }

      if (selectedSquare === squareName) {
        setSelectedSquare(null);
        setValidMoves([]);
        return;
      }

      const verboseMoves = chess.moves({ square: selectedSquare as Square, verbose: true }) as {
        to: string;
        piece: string;
        from: string;
        san: string;
      }[];
      const targetMove = verboseMoves.find((m) => m.to === squareName);

      if (!targetMove) {
        const altMoves = chess.moves({ square: squareName as Square, verbose: true }).map((m: { to: string }) => m.to);
        if (altMoves.length > 0) {
          setSelectedSquare(squareName);
          setValidMoves(altMoves);
        } else {
          setSelectedSquare(null);
          setValidMoves([]);
        }
        return;
      }

      if (targetMove.piece === "p" && isPromotionSquare(squareName)) {
        setPendingPromotionFrom(selectedSquare);
        setPendingPromotionTo(squareName);
        setPromotionOpen(true);
        return;
      }

      const move = chess.move({ from: selectedSquare as Square, to: squareName as Square });
      setSelectedSquare(null);
      setValidMoves([]);
      if (!move) return;
      setBoardState(chess.board());
      if (!playerHasMoved) setPlayerHasMoved(true);
      playMoveSound();
      if (chess.isGameOver()) {
        openEndgame(computeResult(chess), "checkmate");
        return;
      }
      const fen = chess.fen();
      const from = (move as { from: string }).from;
      const to = (move as { to: string }).to;
      const san = (move as { san: string }).san;
      sendPlayerMove(fen, san, from, to);
    },
    [
      chess,
      selectedSquare,
      aiThinking,
      gameEnded,
      gameStarted,
      isAdmin,
      playerHasMoved,
      openEndgame,
      sendPlayerMove,
      playerTurn,
      isPromotionSquare,
    ]
  );

  const startNewGameViaWebSocket = useCallback(
    (minutes: number, color: PlayerColor) => {
      setPlayerColor(color);
      setStartOpen(false);
      setPlayerHasMoved(color === "white");
      setGameEnded(false);
      setGameStarted(true);

      const ws = createGameSocket(
        (msg) => {
          if (msg.type === "game_started") {
            const m = msg as GameStartedMessage;
            currentGameIdRef.current = m.gameId;
            setPlayerTimeMs(m.timeControlMs);
            setAiTimeMs(m.timeControlMs);
            setInitialTimeMs(m.timeControlMs);
            try {
              chess.load(m.fen);
            } catch {
              chess.reset();
            }
            setBoardState(chess.board());
            setSelectedSquare(null);
            setValidMoves([]);
            onGameCreatedRef.current?.(m.gameId, {
              fen: m.fen,
              timeControlMs: m.timeControlMs,
              playerColor: color,
            });
            if (color === "black") {
              sendMessage(wsRef.current!, {
                type: "request_ai_move",
                gameId: m.gameId,
                fen: m.fen,
              });
              setAiThinking(true);
            }
          } else if (msg.type === "ai_move") {
            const m = msg as AIMoveMessage;
            setAiThinking(false);
            if (m.updatedFen) {
              try {
                chess.load(m.updatedFen);
                setBoardState(chess.board());
                setPlayerHasMoved(true);
                playMoveSound();
              } catch {
                // ignore
              }
            }
            if (m.result && m.result !== "*") {
              openEndgame(m.result, "checkmate");
            }
          } else if (msg.type === "game_ended") {
            const m = msg as GameEndedMessage;
            setAiThinking(false);
            if (m.updatedFen) {
              try {
                chess.load(m.updatedFen);
                setBoardState(chess.board());
                playMoveSound();
              } catch {
                // ignore
              }
            }
            openEndgame(m.result, m.termination);
          } else if (msg.type === "error") {
            setAiThinking(false);
            setErrorMessage((msg as ErrorMessage).message);
            setErrorOpen(true);
          }
        },
        () => {
          // onOpen - send start_game
          sendMessage(wsRef.current!, {
            type: "start_game",
            timeControlMs: minutes * 60 * 1000,
            playerColor: color,
          });
        }
      );
      wsRef.current = ws;
    },
    [chess, openEndgame]
  );

  const connectToExistingGame = useCallback(
    (gid: string, gameState: { fen: string; timeControlMs: number; playerColor: PlayerColor }) => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      currentGameIdRef.current = gid;
      setPlayerTimeMs(gameState.timeControlMs);
      setAiTimeMs(gameState.timeControlMs);
      setInitialTimeMs(gameState.timeControlMs);
      setPlayerColor(gameState.playerColor);
      setGameStarted(true);
      setGameEnded(false);
      setStartOpen(false);
      try {
        chess.load(gameState.fen);
      } catch {
        chess.reset();
      }
      setBoardState(chess.board());
      setSelectedSquare(null);
      setValidMoves([]);
      setPlayerHasMoved(true);

      const ws = createGameSocket((msg) => {
        if (msg.type === "ai_move") {
          const m = msg as AIMoveMessage;
          setAiThinking(false);
          if (m.updatedFen) {
            try {
              chess.load(m.updatedFen);
              setBoardState(chess.board());
              setPlayerHasMoved(true);
              playMoveSound();
            } catch {
              // ignore
            }
          }
          if (m.result && m.result !== "*") {
            openEndgame(m.result, "checkmate");
          }
        } else if (msg.type === "game_ended") {
          const m = msg as GameEndedMessage;
          setAiThinking(false);
          if (m.updatedFen) {
            try {
              chess.load(m.updatedFen);
              setBoardState(chess.board());
              playMoveSound();
            } catch {
              // ignore
            }
          }
          openEndgame(m.result, m.termination);
        } else if (msg.type === "error") {
          setAiThinking(false);
          setErrorMessage((msg as ErrorMessage).message);
          setErrorOpen(true);
        }
      });
      wsRef.current = ws;
    },
    [chess, openEndgame]
  );

  const loadFenAndMaybeAI = useCallback(
    async (fen: string, callAI = true) => {
      try {
        chess.load(fen);
      } catch (e) {
        setErrorMessage(`Invalid FEN: ${e instanceof Error ? e.message : "Unknown"}`);
        setErrorOpen(true);
        return;
      }
      setBoardState(chess.board());
      setSelectedSquare(null);
      setValidMoves([]);
      if (isAdmin) {
        setGameStarted(true);
        setPlayerHasMoved(true);
      }
      if (callAI && !chess.isGameOver() && !gameEnded && isAdmin && chess.turn() === aiTurn) {
        setAiThinking(true);
        try {
          const res = await fetch(`${apiBase}?value=${encodeURIComponent(fen)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });
          if (!res.ok) throw new Error(`Backend error: ${res.status}`);
          const data = await res.json();
          if (data.updated_fen) {
            chess.load(data.updated_fen);
            setBoardState(chess.board());
            playMoveSound();
          }
          if (data.result && data.result !== "*") {
            openEndgame(data.result, "checkmate");
          }
        } catch (err) {
          setErrorMessage((err as Error)?.message || "Failed to contact backend");
          setErrorOpen(true);
        } finally {
          setAiThinking(false);
        }
      }
    },
    [chess, isAdmin, gameEnded, apiBase, openEndgame, aiTurn]
  );

  const handleNewGame = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    currentGameIdRef.current = null;
    setAiThinking(false);
    chess.reset();
    setBoardState(chess.board());
    setSelectedSquare(null);
    setValidMoves([]);
    setGameStarted(false);
    setPlayerHasMoved(false);
    setGameEnded(false);
    setStartOpen(true);
  }, [chess]);

  const handleNewGameFromEndgame = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    currentGameIdRef.current = null;
    chess.reset();
    setBoardState(chess.board());
    setSelectedSquare(null);
    setValidMoves([]);
    setGameStarted(false);
    setPlayerHasMoved(false);
    setGameEnded(false);
    setAiThinking(false);
    setEndgameOpen(false);
    setStartOpen(true);
  }, [chess]);

  useEffect(() => {
    currentGameIdRef.current = gameId;
  }, [gameId]);

  useEffect(() => {
    if (gameId && gameId !== "new" && initialGameState) {
      connectToExistingGame(gameId, initialGameState);
      return () => {
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
      };
    }
  }, [gameId, connectToExistingGame, initialGameState?.fen]);

  useEffect(() => {
    if (isAdmin || chess.isGameOver() || gameEnded) return;
    if (chess.turn() !== playerTurn || !playerHasMoved || !gameStarted || aiThinking) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      setPlayerTimeMs((t) => clamp(t - (now - last)));
      last = now;
    }, 100);
    return () => window.clearInterval(id);
  }, [boardState, aiThinking, playerHasMoved, gameEnded, gameStarted, isAdmin, chess, playerTurn]);

  useEffect(() => {
    if (isAdmin || !aiThinking || chess.isGameOver() || gameEnded || !gameStarted) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      setAiTimeMs((t) => {
        const newTime = clamp(t - (now - last));
        if (newTime <= 0 && t > 0) {
          openEndgame(aiTurn === "w" ? "0-1" : "1-0", "timeout");
          setAiThinking(false);
        }
        return newTime;
      });
      last = now;
    }, 100);
    return () => window.clearInterval(id);
  }, [aiThinking, gameEnded, gameStarted, isAdmin, chess, openEndgame, aiTurn]);

  useEffect(() => {
    if (isAdmin || chess.isGameOver() || gameEnded || !playerHasMoved || !gameStarted || aiThinking) return;
    if (playerTimeMs <= 0 && chess.turn() === playerTurn) openEndgame(playerTurn === "w" ? "0-1" : "1-0", "timeout");
    else if (aiTimeMs <= 0 && chess.turn() === aiTurn) openEndgame(aiTurn === "w" ? "0-1" : "1-0", "timeout");
  }, [playerTimeMs, aiTimeMs, playerHasMoved, aiThinking, gameEnded, gameStarted, isAdmin, chess, openEndgame, playerTurn, aiTurn]);

  const isPlayersTurn = chess.turn() === playerTurn && !aiThinking && (gameStarted || isAdmin);

  const VERTICAL = playerColor === "white" ? VERTICAL_WHITE : VERTICAL_BLACK;

  const capturedPieces = useMemo(() => {
    const history = chess.history({ verbose: true });
    const byWhite: string[] = [];
    const byBlack: string[] = [];
    history.forEach((move, i) => {
      const m = move as { captured?: string };
      if (m.captured) {
        if (i % 2 === 0) byWhite.push(m.captured);
        else byBlack.push(m.captured);
      }
    });
    return { byWhite, byBlack };
  }, [chess, boardState]);

  const startNewGameWithTimeRest = useCallback(
    async (minutes: number, color: PlayerColor) => {
      const baseMs = minutes * 60 * 1000;
      setPlayerTimeMs(baseMs);
      setAiTimeMs(baseMs);
      setInitialTimeMs(baseMs);
      setPlayerColor(color);
      setGameStarted(true);
      setPlayerHasMoved(color === "white");
      if (color === "black") {
        await callAIViaRest(chess.fen());
      }
    },
    [chess, callAIViaRest]
  );

  const onStartGame = useCallback(
    (color: PlayerColor) => {
      setStartOpen(false);
      if (isAdmin) {
        startNewGameWithTimeRest(selectedMinutes, color);
      } else {
        startNewGameViaWebSocket(selectedMinutes, color);
      }
    },
    [selectedMinutes, isAdmin, startNewGameViaWebSocket, startNewGameWithTimeRest]
  );

  return {
    boardState,
    selectedSquare,
    validMoves,
    HORIZONTAL,
    VERTICAL,
    playerColor,
    gameEnded,
    startOpen,
    onStartGame,
    promotionOpen,
    handlePromotionPick,
    onPromotionClose: () => setPromotionOpen(false),
    endgameOpen,
    endgameResult,
    endgameReason,
    onEndgameClose: () => setEndgameOpen(false),
    handleNewGameFromEndgame,
    errorOpen,
    errorMessage,
    onErrorClose: () => setErrorOpen(false),
    handleRetry,
    hasRetry: !!lastFenForRetry,
    onTileClick: handleTileClick,
    playerTimeMs,
    aiTimeMs,
    initialTimeMs,
    isPlayersTurn,
    handleNewGame,
    isAdmin,
    fenInput,
    setFenInput,
    capturedPieces,
    onLoadFen: () => {
      if (!fenInput.trim()) {
        setErrorMessage("Please enter a FEN string");
        setErrorOpen(true);
        return;
      }
      loadFenAndMaybeAI(fenInput.trim());
    },
  };
}
