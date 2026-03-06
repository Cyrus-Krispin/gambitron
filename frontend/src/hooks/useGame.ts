import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Chess, Square } from "chess.js";
import { playMoveSound } from "@/utils/sounds";

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

export function useGame(initialMinutes?: number, initialColor?: PlayerColor) {
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
  const [newGameRequested, setNewGameRequested] = useState(false);
  const [aiAbortController, setAiAbortController] = useState<AbortController | null>(null);

  const [startOpen, setStartOpen] = useState(!initialColor);
  const [selectedMinutes] = useState(initialMinutes ?? 5);
  const [playerColor, setPlayerColor] = useState<PlayerColor>(initialColor ?? "white");

  const [fenInput, setFenInput] = useState("");
  const isAdmin = typeof window !== "undefined" && window.location.pathname === "/admin";

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

  const callAIMove = useCallback(
    async (fen: string) => {
      if (gameEnded || newGameRequested) return;
      if (aiAbortController) aiAbortController.abort();
      const controller = new AbortController();
      setAiAbortController(controller);
      setLastFenForRetry(fen);
      setAiThinking(true);
      try {
        const res = await fetch(`${apiBase}?value=${encodeURIComponent(fen)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Backend error: ${res.status}`);
        const data = await res.json();
        if (gameEnded || newGameRequested) return;
        if (data.updated_fen && !gameEnded && !newGameRequested && !chess.isGameOver()) {
          chess.load(data.updated_fen);
          setBoardState(chess.board());
          setPlayerHasMoved(true);
          playMoveSound();
        }
        if (!gameEnded && !newGameRequested) {
          if (data.result && data.result !== "*") openEndgame(data.result, "checkmate");
          else if (chess.isGameOver()) openEndgame(computeResult(chess), "checkmate");
        }
      } catch (err: unknown) {
        if ((err as Error).name !== "AbortError") {
          setErrorMessage((err as Error)?.message || "Failed to contact backend");
          setErrorOpen(true);
        }
      } finally {
        setAiThinking(false);
        setAiAbortController(null);
      }
    },
    [apiBase, chess, gameEnded, newGameRequested, openEndgame, aiAbortController]
  );

  const handleRetry = useCallback(() => {
    if (lastFenForRetry && !gameEnded) {
      setErrorOpen(false);
      callAIMove(lastFenForRetry);
    } else setErrorOpen(false);
  }, [lastFenForRetry, gameEnded, callAIMove]);

  const handlePromotionPick = useCallback(
    async (piece: "q" | "r" | "b" | "n") => {
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
      await callAIMove(fen);
    },
    [chess, pendingPromotionFrom, pendingPromotionTo, playerHasMoved, openEndgame, callAIMove]
  );

  const isPromotionSquare = useCallback(
    (squareName: string) => {
      if (playerColor === "white") return squareName.endsWith("8");
      return squareName.endsWith("1");
    },
    [playerColor]
  );

  const handleTileClick = useCallback(
    async (squareName: string) => {
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

      const verboseMoves = chess.moves({ square: selectedSquare as Square, verbose: true }) as { to: string; piece: string }[];
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
      await callAIMove(chess.fen());
    },
    [chess, selectedSquare, aiThinking, gameEnded, gameStarted, isAdmin, playerHasMoved, openEndgame, callAIMove, playerTurn, isPromotionSquare]
  );

  const startNewGameWithTime = useCallback(
    async (minutes: number, color: PlayerColor) => {
      const baseMs = minutes * 60 * 1000;
      setPlayerTimeMs(baseMs);
      setAiTimeMs(baseMs);
      setInitialTimeMs(baseMs);
      setPlayerColor(color);
      setGameStarted(true);
      setNewGameRequested(false);
      setPlayerHasMoved(color === "white");
      if (color === "black") {
        await callAIMove(chess.fen());
      }
    },
    [chess, callAIMove]
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
      if (callAI && !chess.isGameOver() && !gameEnded) {
        if (isAdmin || chess.turn() === aiTurn) {
          await callAIMove(chess.fen());
        }
      }
    },
    [chess, isAdmin, gameEnded, callAIMove, aiTurn]
  );

  const handleNewGame = useCallback(() => {
    if (aiAbortController) aiAbortController.abort();
    setNewGameRequested(true);
    setAiThinking(false);
    setAiAbortController(null);
    chess.reset();
    setBoardState(chess.board());
    setSelectedSquare(null);
    setValidMoves([]);
    setGameStarted(false);
    setPlayerHasMoved(false);
    setGameEnded(false);
    setStartOpen(true);
  }, [chess, aiAbortController]);

  const handleNewGameFromEndgame = useCallback(() => {
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

  const initialStartDone = useRef(false);
  useEffect(() => {
    if (initialColor && initialMinutes && !initialStartDone.current) {
      initialStartDone.current = true;
      setStartOpen(false);
      startNewGameWithTime(initialMinutes, initialColor);
    } else if (!initialColor) {
      setStartOpen(true);
    }
  }, [initialColor, initialMinutes, startNewGameWithTime]);

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
          if (aiAbortController) aiAbortController.abort();
          openEndgame(aiTurn === "w" ? "0-1" : "1-0", "timeout");
          setAiThinking(false);
        }
        return newTime;
      });
      last = now;
    }, 100);
    return () => window.clearInterval(id);
  }, [aiThinking, gameEnded, gameStarted, aiAbortController, isAdmin, chess, openEndgame, aiTurn]);

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

  return {
    boardState,
    selectedSquare,
    validMoves,
    HORIZONTAL,
    VERTICAL,
    playerColor,
    gameEnded,
    startOpen,
    onStartGame: async (color: PlayerColor) => {
      setStartOpen(false);
      await startNewGameWithTime(selectedMinutes, color);
    },
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
