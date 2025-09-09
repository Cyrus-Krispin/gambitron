import { useEffect, useMemo, useState } from "react";
import { Chess, Square } from "chess.js";
import Tile from "../tile/tile";
import "./Board.css";
import { Button, Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert } from "@mui/material";

const horizontal = ["a", "b", "c", "d", "e", "f", "g", "h"];
const vertical = ["1", "2", "3", "4", "5", "6", "7", "8"];

const chess = new Chess();

function computeResult(game: Chess): string {
  if (!game.isGameOver()) return "*";
  if (game.isCheckmate()) {
    const winner = game.turn() === "w" ? "b" : "w";
    return winner === "w" ? "1-0" : "0-1";
  }
  return "1/2-1/2";
}

function clampNonNegative(ms: number): number {
  return ms < 0 ? 0 : ms;
}

function formatClock(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

const START_TIME_MS = 1 * 60 * 1000; // 1 minute

export default function Board() {
  const [boardState, setBoardState] = useState(chess.board());
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [validMoves, setValidMoves] = useState<string[]>([]);

  // Error handling UI
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [lastFenForRetry, setLastFenForRetry] = useState<string | null>(null);

  // Endgame dialog
  const [endgameOpen, setEndgameOpen] = useState(false);
  const [endgameResult, setEndgameResult] = useState<string>("");

  // Promotion dialog state
  const [promotionOpen, setPromotionOpen] = useState(false);
  const [pendingPromotionFrom, setPendingPromotionFrom] = useState<string | null>(null);
  const [pendingPromotionTo, setPendingPromotionTo] = useState<string | null>(null);

  // Clocks
  const [playerTimeMs, setPlayerTimeMs] = useState<number>(START_TIME_MS);
  const [aiTimeMs, setAiTimeMs] = useState<number>(START_TIME_MS);
  const [aiThinking, setAiThinking] = useState<boolean>(false);

  // Persisted load on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedFen = localStorage.getItem("gambitron_fen");
    const savedPlayer = localStorage.getItem("gambitron_clock_player");
    const savedAi = localStorage.getItem("gambitron_clock_ai");
    if (savedFen) {
      try {
        chess.load(savedFen);
        setBoardState(chess.board());
      } catch (_) {
        localStorage.removeItem("gambitron_fen");
      }
    }
    if (savedPlayer) {
      const v = parseInt(savedPlayer, 10);
      if (!Number.isNaN(v)) setPlayerTimeMs(v);
    }
    if (savedAi) {
      const v = parseInt(savedAi, 10);
      if (!Number.isNaN(v)) setAiTimeMs(v);
    }
  }, []);

  // Persist clocks
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("gambitron_clock_player", String(playerTimeMs));
  }, [playerTimeMs]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("gambitron_clock_ai", String(aiTimeMs));
  }, [aiTimeMs]);

  // Run player clock when it's player's turn and game not over
  useEffect(() => {
    if (chess.isGameOver()) return;
    const isPlayersTurn = chess.turn() === "w"; // human plays White
    if (!isPlayersTurn || aiThinking) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const delta = now - last;
      last = now;
      setPlayerTimeMs((t) => clampNonNegative(t - delta));
    }, 100);
    return () => window.clearInterval(id);
  }, [boardState, aiThinking]);

  // Run AI clock only while thinking
  useEffect(() => {
    if (!aiThinking || chess.isGameOver()) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const delta = now - last;
      last = now;
      setAiTimeMs((t) => clampNonNegative(t - delta));
    }, 100);
    return () => window.clearInterval(id);
  }, [aiThinking]);

  const apiUrlBase = useMemo(() => `${import.meta.env.VITE_backend}`, []);

  const saveFen = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("gambitron_fen", chess.fen());
    }
  };

  const openEndgame = (result: string) => {
    setEndgameResult(result);
    setEndgameOpen(true);
  };

  const callAIMove = async (fenToSend: string) => {
    const apiUrl = `${apiUrlBase}?value=${encodeURIComponent(fenToSend)}`;
    setLastFenForRetry(fenToSend);
    setAiThinking(true);
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Backend error: ${response.status}`);
      }

      const data = await response.json();
      if (data.updated_fen) {
        chess.load(data.updated_fen);
        setBoardState(chess.board());
        saveFen();
      }

      if (data.result && data.result !== "*") {
        openEndgame(data.result);
      } else if (chess.isGameOver()) {
        openEndgame(computeResult(chess));
      }
    } catch (error: any) {
      setErrorMessage(error?.message || "Failed to contact backend");
      setErrorOpen(true);
    } finally {
      setAiThinking(false);
    }
  };

  const handleRetry = async () => {
    if (lastFenForRetry) {
      setErrorOpen(false);
      await callAIMove(lastFenForRetry);
    } else {
      setErrorOpen(false);
    }
  };

  const handlePromotionPick = async (piece: "q" | "r" | "b" | "n") => {
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

    if (move) {
      setBoardState(chess.board());
      setSelectedSquare(null);
      setValidMoves([]);
      saveFen();

      if (chess.isGameOver()) {
        openEndgame(computeResult(chess));
        return;
      }

      await callAIMove(chess.fen());
    }
  };

  const handleTileClick = async (squareName: string) => {
    if (aiThinking || chess.isGameOver()) return;
    const playersTurn = chess.turn() === "w";
    if (!playersTurn) return;

    // First click: select and show legal targets
    if (!selectedSquare) {
      const moves = chess
        .moves({ square: squareName as Square, verbose: true })
        .map((m: any) => m.to);
      if (moves.length > 0) {
        setSelectedSquare(squareName);
        setValidMoves(moves);
      } else {
        setSelectedSquare(null);
        setValidMoves([]);
      }
      return;
    }

    // Clicking the same square cancels selection
    if (selectedSquare === squareName) {
      setSelectedSquare(null);
      setValidMoves([]);
      return;
    }

    // Determine if the intended move is legal
    const verboseMoves: any[] = chess.moves({ square: selectedSquare as Square, verbose: true }) as any[];
    const targetMove = verboseMoves.find((m: any) => m.to === squareName);

    // If not a legal move but a different own piece, switch selection
    if (!targetMove) {
      const altMoves = chess
        .moves({ square: squareName as Square, verbose: true })
        .map((m: any) => m.to);
      if (altMoves.length > 0) {
        setSelectedSquare(squareName);
        setValidMoves(altMoves);
      } else {
        setSelectedSquare(null);
        setValidMoves([]);
      }
      return;
    }

    // Handle promotion (white pawn reaching 8th rank)
    const isPromotion = targetMove.piece === "p" && squareName.endsWith("8");
    if (isPromotion) {
      setPendingPromotionFrom(selectedSquare);
      setPendingPromotionTo(squareName);
      setPromotionOpen(true);
      return;
    }

    // Make the move
    const move = chess.move({ from: selectedSquare as Square, to: squareName as Square });
    setSelectedSquare(null);
    setValidMoves([]);
    if (!move) return;

    setBoardState(chess.board());
    saveFen();

    if (chess.isGameOver()) {
      openEndgame(computeResult(chess));
      return;
    }

    await callAIMove(chess.fen());
  };

  const inCheck = chess.inCheck();
  const aiInCheck = chess.turn() === "b" && inCheck;
  const playerInCheck = chess.turn() === "w" && inCheck;

  const isPlayersTurn = chess.turn() === "w" && !aiThinking;
  const aiBarActive = !isPlayersTurn;
  const playerBarActive = isPlayersTurn;

  const handleReset = () => {
    chess.reset();
    setBoardState(chess.board());
    setSelectedSquare(null);
    setValidMoves([]);
    setPlayerTimeMs(START_TIME_MS);
    setAiTimeMs(START_TIME_MS);
    if (typeof window !== "undefined") {
      localStorage.removeItem("gambitron_fen");
      localStorage.removeItem("gambitron_clock_player");
      localStorage.removeItem("gambitron_clock_ai");
    }
  };

  return (
    <>
      <div className="board-root">
        <div className="left-panel">
          <Button variant="contained" color="primary" onClick={handleReset}>New Game</Button>
        </div>
        <div className="board-area">
          <div className="chess-board">
            {vertical
              .slice()
              .reverse()
              .map((row, y) =>
                horizontal.map((col, x) => {
                  const square = boardState[y][x];
                  const tileColor = (x + y) % 2 === 0 ? "white" : "black";
                  const squareName = `${col}${row}`;
                  const isHighlighted = validMoves.includes(squareName);

                  return (
                    <Tile
                      key={squareName}
                      tileColor={tileColor}
                      piece={
                        square?.type ? `${square.color}${square.type}` : undefined
                      }
                      onClick={() => handleTileClick(squareName)}
                      isHighlighted={isHighlighted}
                    />
                  );
                })
              )}
          </div>
        </div>
        <div className="side-panel">
          <div className={`clock ${aiBarActive ? "active" : ""}`}>
            <div className="label">
              <span>Gambitron</span>
              {aiThinking && <span className="badge">Thinking</span>}
              {aiInCheck && <span className="badge danger">Check</span>}
            </div>
            <div className={`time ${!aiBarActive ? "dimmed" : ""}`}>{formatClock(aiTimeMs)}</div>
          </div>
          <div className={`clock ${playerBarActive ? "active" : ""}`}>
            <div className="label">
              <span>You</span>
              {playerInCheck && <span className="badge danger">Check</span>}
            </div>
            <div className={`time ${!playerBarActive ? "dimmed" : ""}`}>{formatClock(playerTimeMs)}</div>
          </div>
        </div>
      </div>


      {/* Promotion Dialog */}
      <Dialog open={promotionOpen} onClose={() => setPromotionOpen(false)}>
        <DialogTitle>Choose promotion</DialogTitle>
        <DialogContent style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <Button variant="contained" onClick={() => handlePromotionPick("q")}>Queen</Button>
          <Button variant="contained" onClick={() => handlePromotionPick("r")}>Rook</Button>
          <Button variant="contained" onClick={() => handlePromotionPick("b")}>Bishop</Button>
          <Button variant="contained" onClick={() => handlePromotionPick("n")}>Knight</Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPromotionOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Endgame Dialog */}
      <Dialog open={endgameOpen} onClose={() => setEndgameOpen(false)}>
        <DialogTitle>Game Over</DialogTitle>
        <DialogContent>
          <div style={{ marginTop: 8 }}>Result: {endgameResult}</div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEndgameOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Error Snackbar */}
      <Snackbar
        open={errorOpen}
        autoHideDuration={6000}
        onClose={() => setErrorOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setErrorOpen(false)}
          severity="error"
          action={
            lastFenForRetry ? (
              <Button color="inherit" size="small" onClick={handleRetry}>
                Retry
              </Button>
            ) : undefined
          }
          sx={{ width: "100%" }}
        >
          {errorMessage}
        </Alert>
      </Snackbar>
    </>
  );
}
