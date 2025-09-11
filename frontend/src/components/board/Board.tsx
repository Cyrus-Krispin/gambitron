import { useEffect, useMemo, useState } from "react";
import { Chess, Square } from "chess.js";
import ChessPiece from "../ChessPiece";
import { Button, Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert, ToggleButtonGroup, ToggleButton, TextField, Paper } from "@mui/material";

const horizontal = ["a", "b", "c", "d", "e", "f", "g", "h"];
const vertical = ["1", "2", "3", "4", "5", "6", "7", "8"];

const chess = new Chess();

function computeResult(game: Chess): string {
  if (!game.isGameOver()) return "*";
  if (game.isCheckmate()) {
    const winner = game.turn() === "w" ? "b" : "w";
    return winner === "w" ? "1-0" : "0-1";
  }
  if (game.isStalemate()) {
    return "1/2-1/2";
  }
  if (game.isDraw()) {
    return "1/2-1/2";
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
  const [initialTimeMs, setInitialTimeMs] = useState<number>(START_TIME_MS);
  const [aiThinking, setAiThinking] = useState<boolean>(false);
  const [playerHasMoved, setPlayerHasMoved] = useState<boolean>(false);
  const [gameEnded, setGameEnded] = useState<boolean>(false);

  // Start game configuration
  const [startOpen, setStartOpen] = useState<boolean>(false);
  const [selectedMinutes, setSelectedMinutes] = useState<number>(5);

  // Admin test panel
  const [adminOpen, setAdminOpen] = useState<boolean>(false);
  const [fenInput, setFenInput] = useState<string>("");

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
        // Assume game already started if resuming from a saved position
        setPlayerHasMoved(true);
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
    if (!savedFen) {
      setStartOpen(true);
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
    if (chess.isGameOver() || gameEnded) return;
    const isPlayersTurn = chess.turn() === "w"; // human plays White
    if (!playerHasMoved) return; // don't start clock until first move is made
    if (!isPlayersTurn || aiThinking) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const delta = now - last;
      last = now;
      setPlayerTimeMs((t) => clampNonNegative(t - delta));
    }, 100);
    return () => window.clearInterval(id);
  }, [boardState, aiThinking, playerHasMoved, gameEnded]);

  // Run AI clock only while thinking
  useEffect(() => {
    if (!aiThinking || chess.isGameOver() || gameEnded) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const delta = now - last;
      last = now;
      setAiTimeMs((t) => {
        const newTime = clampNonNegative(t - delta);
        // Check if AI ran out of time while thinking
        if (newTime <= 0 && t > 0) {
          openEndgame("1-0"); // Player wins by AI timeout
          setAiThinking(false);
        }
        return newTime;
      });
    }, 100);
    return () => window.clearInterval(id);
  }, [aiThinking, gameEnded]);

  // Check for time-based endgames
  useEffect(() => {
    if (chess.isGameOver() || gameEnded) return;
    if (!playerHasMoved) return; // don't check time until game starts
    if (aiThinking) return; // don't check timeouts while AI is thinking
    
    if (playerTimeMs <= 0 && chess.turn() === "w") {
      // Player ran out of time
      openEndgame("0-1");
    } else if (aiTimeMs <= 0 && chess.turn() === "b") {
      // AI ran out of time
      openEndgame("1-0");
    }
  }, [playerTimeMs, aiTimeMs, playerHasMoved, aiThinking, gameEnded]);

  const apiUrlBase = useMemo(() => `${import.meta.env.VITE_backend}`, []);
  const adminKeyEnv = useMemo(() => `${import.meta.env.VITE_admin_key || ""}`.trim(), []);

  const saveFen = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("gambitron_fen", chess.fen());
    }
  };

  // Reveal admin panel via URL key match ?adminKey=... and optional ?fen=...; default to White to move
  useEffect(() => {
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const key = params.get("adminKey");
        const fenParam = params.get("fen");
        const keepTurn = params.get("keepTurn");
        const preserveTurn = keepTurn === "1" || keepTurn === "true";
        if (adminKeyEnv && key && key === adminKeyEnv) {
          setAdminOpen(true);
          if (fenParam && fenParam.length > 0) {
            setFenInput(fenParam);
            const fenToLoad = preserveTurn ? fenParam : forceWhiteToMoveFen(fenParam);
            await loadFenAndMaybeAI(fenToLoad, /*callAIWhenBlack*/ preserveTurn);
            setPlayerHasMoved(false);
            // Remove FEN from URL after loading
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete("fen");
            newUrl.searchParams.delete("keepTurn");
            window.history.replaceState({}, "", newUrl.toString());
          }
        }
      } catch (_) {
        // ignore URL parse issues
      }
    })();
  }, [adminKeyEnv]);

  const openEndgame = (result: string) => {
    setEndgameResult(result);
    setEndgameOpen(true);
    setGameEnded(true);
    setAiThinking(false);
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
      
      // Check if game ended due to timeout while waiting for response
      if (gameEnded) {
        return; // Game already ended due to timeout, don't process response
      }
      
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
      if (!playerHasMoved) setPlayerHasMoved(true);

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
    if (!playerHasMoved) setPlayerHasMoved(true);

    if (chess.isGameOver()) {
      openEndgame(computeResult(chess));
      return;
    }

    await callAIMove(chess.fen());
  };

  const isPlayersTurn = chess.turn() === "w" && !aiThinking;

  const handleReset = () => {
    setStartOpen(true);
  };

  const startNewGameWithTime = (minutes: number) => {
    const baseMs = Math.max(0.1, minutes) * 60 * 1000;
    
    // Clear all game state first
    setGameEnded(true); // Stop all timers immediately
    setAiThinking(false);
    setSelectedSquare(null);
    setValidMoves([]);
    
    // Reset chess game
    chess.reset();
    setBoardState(chess.board());
    
    // Set new game state
    setPlayerTimeMs(baseMs);
    setAiTimeMs(baseMs);
    setInitialTimeMs(baseMs);
    setPlayerHasMoved(false);
    setGameEnded(false); // Now allow timers to start again
    
    if (typeof window !== "undefined") {
      localStorage.removeItem("gambitron_fen");
      localStorage.setItem("gambitron_clock_player", String(baseMs));
      localStorage.setItem("gambitron_clock_ai", String(baseMs));
    }
  };

  const loadFenAndMaybeAI = async (fen: string, callAIWhenBlack: boolean = true) => {
    try {
      chess.load(fen);
    } catch (e) {
      setErrorMessage("Invalid FEN");
      setErrorOpen(true);
      return;
    }
    setBoardState(chess.board());
    setSelectedSquare(null);
    setValidMoves([]);
    saveFen();
    // If it's black to move, call AI immediately
    if (callAIWhenBlack && chess.turn() === "b" && !chess.isGameOver()) {
      await callAIMove(chess.fen());
    }
  };

  const forceWhiteToMoveFen = (fen: string): string => {
    const parts = fen.trim().split(/\s+/);
    if (parts.length < 2) return fen;
    parts[1] = "w";
    return parts.join(" ");
  };

  // Randomization removed per request

  return (
    <>
      {/* LEFT SIDEBAR */}
      <div className="bg-gray-800 p-4 border-r border-gray-700">
        <div className="space-y-4">
          {/* Game Info Section */}
          <div className="bg-gray-700 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-gray-600 rounded flex items-center justify-center">♔</div>
              <div>
                <div className="text-sm font-medium">
                  {Math.floor(initialTimeMs / (60 * 1000))} min • 
                  {Math.floor(initialTimeMs / (60 * 1000)) < 3 ? ' Bullet' : 
                   Math.floor(initialTimeMs / (60 * 1000)) < 10 ? ' Blitz' : 
                   Math.floor(initialTimeMs / (60 * 1000)) < 30 ? ' Rapid' : ' Classical'}
                </div>
                <div className="text-xs text-gray-400">vs Gambitron</div>
              </div>
            </div>

            {/* Current Turn Indicator */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isPlayersTurn ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                <span className="text-sm">{isPlayersTurn ? 'Your turn' : 'AI turn'}</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* CHESS BOARD CONTAINER */}
      <div className="flex items-center justify-center p-8 bg-gray-850">
        <div className="chess-board-container">
          <div className="grid grid-cols-8 border-2 border-gray-600 rounded-lg overflow-hidden shadow-2xl">
            {vertical
              .slice()
              .reverse()
              .map((row, y) =>
                horizontal.map((col, x) => {
                  const square = boardState[y][x];
                  const isLight = (y + x) % 2 === 0;
                  const squareColor = isLight ? "bg-white" : "bg-gray-600";
                  const squareName = `${col}${row}`;
                  const isHighlighted = validMoves.includes(squareName);
                  const isSelected = selectedSquare === squareName;
                  const pieceColor: "white" | "black" = square?.color === "w" ? "white" : "black";

                  return (
                    <div
                      key={squareName}
                      className={`
                        flex items-center justify-center 
                        cursor-pointer 
                        transition-colors duration-150
                        relative
                        ${isSelected ? 'bg-blue-200' : squareColor}
                      `}
                      style={{ width: "80px", height: "80px" }}
                      onClick={() => handleTileClick(squareName)}
                    >
                      {/* Move indicator dot for all available moves */}
                      {isHighlighted && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                        </div>
                      )}
                      
                      {square && <ChessPiece piece={square.type} color={pieceColor} />}
                    </div>
                  );
                })
              )}
          </div>
        </div>
      </div>

      {/* RIGHT SIDEBAR */}
      <div className="bg-gray-800 p-4 border-l border-gray-700 flex items-center justify-center">
        <div className="space-y-4">
          {/* Gambitron Timer */}
          <div className="text-center">
            <div className="text-4xl font-mono font-bold mb-2">{formatClock(aiTimeMs)}</div>
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className={`w-2 h-2 rounded-full ${!isPlayersTurn ? 'bg-green-500' : 'bg-gray-500'}`}></div>
              <span className="text-sm">Gambitron</span>
            </div>
            <div className={`text-white px-3 py-2 rounded text-sm mb-4 ${aiThinking ? 'bg-blue-600' : 'bg-green-600'}`}>
              {aiThinking ? "AI is thinking..." : "Your turn"}
            </div>
          </div>

          {/* Player Timer */}
          <div className="text-center">
            <div className="text-4xl font-mono font-bold mb-2">{formatClock(playerTimeMs)}</div>
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className={`w-2 h-2 rounded-full ${isPlayersTurn ? 'bg-green-500' : 'bg-gray-500'}`}></div>
              <span className="text-sm">You</span>
            </div>
          </div>


          {/* Reset Button */}
          <div className="flex justify-center">
            <button className="p-2 bg-gray-700 rounded hover:bg-gray-600" onClick={handleReset}>☰</button>
          </div>
        </div>
      </div>


      {/* Promotion Dialog */}
      <Dialog open={promotionOpen} onClose={() => setPromotionOpen(false)}>
        <DialogTitle>Choose promotion</DialogTitle>
        <DialogContent style={{ display: "flex", gap: 12, marginTop: 8, justifyContent: "center" }}>
          <Button variant="contained" onClick={() => handlePromotionPick("q")} style={{ padding: 8, minWidth: 60, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <img src="/pieces/q-white.svg" alt="Queen" style={{ width: 32, height: 32, marginBottom: 4 }} />
            <span style={{ fontSize: 12 }}>Queen</span>
          </Button>
          <Button variant="contained" onClick={() => handlePromotionPick("r")} style={{ padding: 8, minWidth: 60, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <img src="/pieces/r-white.svg" alt="Rook" style={{ width: 32, height: 32, marginBottom: 4 }} />
            <span style={{ fontSize: 12 }}>Rook</span>
          </Button>
          <Button variant="contained" onClick={() => handlePromotionPick("b")} style={{ padding: 8, minWidth: 60, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <img src="/pieces/b-white.svg" alt="Bishop" style={{ width: 32, height: 32, marginBottom: 4 }} />
            <span style={{ fontSize: 12 }}>Bishop</span>
          </Button>
          <Button variant="contained" onClick={() => handlePromotionPick("n")} style={{ padding: 8, minWidth: 60, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <img src="/pieces/n-white.svg" alt="Knight" style={{ width: 32, height: 32, marginBottom: 4 }} />
            <span style={{ fontSize: 12 }}>Knight</span>
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPromotionOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Start Game Dialog */}
      <Dialog open={startOpen} onClose={() => setStartOpen(false)}>
        <DialogTitle>Start New Game</DialogTitle>
        <DialogContent>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontWeight: 600 }}>Time Control</div>
            <ToggleButtonGroup
              exclusive
              value={selectedMinutes}
              onChange={(_, v) => { if (typeof v === "number") setSelectedMinutes(v); }}
              color="primary"
            >
              <ToggleButton value={1}>1</ToggleButton>
              <ToggleButton value={3}>3</ToggleButton>
              <ToggleButton value={5}>5</ToggleButton>
              <ToggleButton value={10}>10</ToggleButton>
              <ToggleButton value={15}>15</ToggleButton>
              <ToggleButton value={0.167}>10s</ToggleButton>
            </ToggleButtonGroup>
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStartOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => { startNewGameWithTime(selectedMinutes); setStartOpen(false); }}>Start</Button>
        </DialogActions>
      </Dialog>

      {/* Admin Testing Panel */}
      {adminOpen && (
        <div style={{ position: "fixed", top: 16, left: 16, zIndex: 1000, display: "flex", flexDirection: "column", gap: 8, width: 360 }}>
          <Paper elevation={8} style={{ 
            padding: 16, 
            background: "rgba(15, 20, 40, 0.95)", 
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 12,
            backdropFilter: "blur(10px)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)"
          }}>
            <div style={{ 
              fontWeight: 700, 
              marginBottom: 12, 
              color: "#ffffff",
              fontSize: 16
            }}>Admin: Position Tools</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <Button 
                variant="outlined" 
                size="small" 
                onClick={() => setAdminOpen(false)}
                style={{ 
                  color: "#ffffff", 
                  borderColor: "rgba(255,255,255,0.3)"
                }}
              >Hide</Button>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <TextField 
                size="small" 
                label="FEN" 
                fullWidth 
                value={fenInput} 
                onChange={(e) => setFenInput(e.target.value)}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    color: "#ffffff",
                    "& fieldset": { borderColor: "rgba(255,255,255,0.3)" },
                    "&:hover fieldset": { borderColor: "rgba(255,255,255,0.5)" },
                    "&.Mui-focused fieldset": { borderColor: "#1976d2" }
                  },
                  "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.7)" },
                  "& .MuiInputLabel-root.Mui-focused": { color: "#1976d2" }
                }}
              />
              <Button 
                variant="contained" 
                size="small" 
                onClick={async () => { await loadFenAndMaybeAI(fenInput); setPlayerHasMoved(true); }}
                style={{ 
                  background: "#1976d2"
                }}
              >Load</Button>
            </div>
          </Paper>
        </div>
      )}

      {/* Endgame Dialog */}
      <Dialog 
        open={endgameOpen} 
        onClose={() => setEndgameOpen(false)}
        PaperProps={{
          style: {
            backgroundColor: '#1f2937',
            color: 'white',
            borderRadius: '12px',
            border: '1px solid #374151'
          }
        }}
      >
        <DialogTitle style={{ color: 'white', textAlign: 'center', fontSize: '24px', fontWeight: 'bold' }}>
          {endgameResult === "1-0" ? "🎉 You Win!" : 
           endgameResult === "0-1" ? "😔 You Lose" : 
           "🤝 Draw"}
        </DialogTitle>
        <DialogContent style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ fontSize: '16px', marginBottom: '16px' }}>
            {endgameResult === "1-0" && chess.isCheckmate() && "Checkmate! You outplayed Gambitron!"}
            {endgameResult === "1-0" && !chess.isCheckmate() && "Gambitron ran out of time!"}
            {endgameResult === "0-1" && chess.isCheckmate() && "Checkmate! Gambitron got you!"}
            {endgameResult === "0-1" && !chess.isCheckmate() && "You ran out of time!"}
            {endgameResult === "1/2-1/2" && chess.isStalemate() && "Stalemate! No legal moves available."}
            {endgameResult === "1/2-1/2" && !chess.isStalemate() && "Draw! The game ends in a tie."}
          </div>
          <div style={{ fontSize: '14px', color: '#9ca3af' }}>
            Result: {endgameResult}
          </div>
        </DialogContent>
        <DialogActions style={{ justifyContent: 'center', padding: '20px' }}>
          <Button 
            onClick={() => {
              setEndgameOpen(false);
              setStartOpen(true);
            }}
            style={{ 
              backgroundColor: '#3b82f6', 
              color: 'white',
              padding: '10px 24px',
              borderRadius: '8px',
              fontWeight: 'bold'
            }}
          >
            New Game
          </Button>
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
