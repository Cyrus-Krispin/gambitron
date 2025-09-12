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
  const [gameExplicitlyStarted, setGameExplicitlyStarted] = useState<boolean>(false);
  const [newGameRequested, setNewGameRequested] = useState<boolean>(false);
  const [aiRequestController, setAiRequestController] = useState<AbortController | null>(null);

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
    if (!playerHasMoved || !gameExplicitlyStarted) return; // don't start clock until game is explicitly started and first move is made
    if (!isPlayersTurn || aiThinking) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const delta = now - last;
      last = now;
      setPlayerTimeMs((t) => clampNonNegative(t - delta));
    }, 100);
    return () => window.clearInterval(id);
  }, [boardState, aiThinking, playerHasMoved, gameEnded, gameExplicitlyStarted]);

  // Run AI clock only while thinking
  useEffect(() => {
    if (!aiThinking || chess.isGameOver() || gameEnded || !gameExplicitlyStarted) return;
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
  }, [aiThinking, gameEnded, gameExplicitlyStarted]);

  // Check for time-based endgames
  useEffect(() => {
    if (chess.isGameOver() || gameEnded) return;
    if (!playerHasMoved || !gameExplicitlyStarted) return; // don't check time until game is explicitly started
    if (aiThinking) return; // don't check timeouts while AI is thinking
    
    if (playerTimeMs <= 0 && chess.turn() === "w") {
      // Player ran out of time
      openEndgame("0-1");
    } else if (aiTimeMs <= 0 && chess.turn() === "b") {
      // AI ran out of time
      openEndgame("1-0");
    }
  }, [playerTimeMs, aiTimeMs, playerHasMoved, aiThinking, gameEnded, gameExplicitlyStarted]);

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
    setGameExplicitlyStarted(false); // Reset the explicit start flag when game ends
  };

  const callAIMove = async (fenToSend: string) => {
    // Don't start AI request if game has already ended or new game requested
    if (gameEnded || newGameRequested) {
      return;
    }
    
    // Cancel any existing request
    if (aiRequestController) {
      aiRequestController.abort();
    }
    
    // Create new AbortController for this request
    const controller = new AbortController();
    setAiRequestController(controller);
    
    const apiUrl = `${apiUrlBase}?value=${encodeURIComponent(fenToSend)}`;
    setLastFenForRetry(fenToSend);
    setAiThinking(true);
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Backend error: ${response.status}`);
      }

      const data = await response.json();
      
      // Check if game ended due to timeout while waiting for response
      if (gameEnded || newGameRequested) {
        return; // Game already ended due to timeout or new game requested, don't process response
      }
      
      if (data.updated_fen) {
        // Double-check game hasn't ended and new game not requested before updating board
        if (!gameEnded && !newGameRequested) {
          chess.load(data.updated_fen);
          setBoardState(chess.board());
          saveFen();
        }
      }

      // Only process game results if game hasn't ended and new game not requested
      if (!gameEnded && !newGameRequested) {
        if (data.result && data.result !== "*") {
          openEndgame(data.result);
        } else if (chess.isGameOver()) {
          openEndgame(computeResult(chess));
        }
      }
    } catch (error: any) {
      // Don't show error if request was aborted (user clicked New Game)
      if (error.name !== 'AbortError') {
        setErrorMessage(error?.message || "Failed to contact backend");
        setErrorOpen(true);
      }
    } finally {
      setAiThinking(false);
      setAiRequestController(null);
    }
  };

  const handleRetry = async () => {
    if (lastFenForRetry && !gameEnded) {
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

      // Only call AI if game hasn't ended
      if (!gameEnded) {
        await callAIMove(chess.fen());
      }
    }
  };

  const handleTileClick = async (squareName: string) => {
    if (aiThinking || chess.isGameOver() || gameEnded || !gameExplicitlyStarted) return;
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

    // Only call AI if game hasn't ended
    if (!gameEnded) {
      await callAIMove(chess.fen());
    }
  };

  const isPlayersTurn = chess.turn() === "w" && !aiThinking && gameExplicitlyStarted;


  const startNewGameWithTime = (minutes: number) => {
    const baseMs = Math.max(0.1, minutes) * 60 * 1000;
    
    // Set new game state (board already reset when New Game was clicked)
    setPlayerTimeMs(baseMs);
    setAiTimeMs(baseMs);
    setInitialTimeMs(baseMs);
    setGameExplicitlyStarted(true); // Mark that game has been explicitly started
    setNewGameRequested(false); // Reset the new game requested flag
    
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
    if (callAIWhenBlack && chess.turn() === "b" && !chess.isGameOver() && !gameEnded) {
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
      {/* MOBILE LAYOUT */}
      <div className="lg:hidden flex flex-col h-screen">
        {/* MOBILE: AI TIMER AT TOP */}
        <div className="bg-gray-800 p-2 border-b border-gray-700 flex-shrink-0">
          <div className="text-center">
            <div className="text-3xl font-mono font-bold mb-1">{formatClock(aiTimeMs)}</div>
            <div className="flex items-center justify-center gap-2 mb-1">
              <div className={`w-2 h-2 rounded-full ${!isPlayersTurn ? 'bg-green-500' : 'bg-gray-500'}`}></div>
              <span className="text-sm">Gambitron</span>
            </div>
            <div className={`text-white px-3 py-1 rounded text-sm inline-block ${aiThinking ? 'bg-blue-600' : 'bg-green-600'}`}>
              {aiThinking ? "AI is thinking..." : "Your turn"}
            </div>
          </div>
        </div>

        {/* MOBILE: BOARD CONTAINER - Takes remaining space */}
        <div className="flex-1 flex items-center justify-center p-2 bg-gray-850 min-h-0">
          <div className="chess-board-container relative w-full h-full flex items-center justify-center">
            <div className={`grid grid-cols-8 border-2 border-gray-600 rounded-lg overflow-hidden shadow-2xl w-full max-w-sm aspect-square ${(gameEnded || startOpen) ? 'opacity-50 pointer-events-none' : ''}`}>
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
                          ${squareColor}
                          flex items-center justify-center 
                          cursor-pointer 
                          transition-colors duration-150
                          relative
                          ${isSelected ? 'bg-blue-200' : ''}
                          aspect-square
                        `}
                        onClick={() => handleTileClick(squareName)}
                      >
                        {/* Move indicator dot for all available moves */}
                        {isHighlighted && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                          </div>
                        )}
                        
                        {square && <ChessPiece piece={square.type} color={pieceColor} isSelected={isSelected} />}
                      </div>
                    );
                  })
                )}
            </div>
            {/* Game Over Overlay - blocks all interactions */}
            {(gameEnded || startOpen) && (
              <div className="absolute inset-0 bg-transparent pointer-events-auto z-10"></div>
            )}
          </div>
        </div>

        {/* MOBILE: PLAYER TIMER AT BOTTOM */}
        <div className="bg-gray-800 p-2 border-t border-gray-700 flex-shrink-0">
          <div className="text-center">
            <div className="text-3xl font-mono font-bold mb-1">{formatClock(playerTimeMs)}</div>
            <div className="flex items-center justify-center gap-2 mb-1">
              <div className={`w-2 h-2 rounded-full ${isPlayersTurn ? 'bg-green-500' : 'bg-gray-500'}`}></div>
              <span className="text-sm">You</span>
            </div>
            <button 
              className="px-4 py-1 bg-gray-700 rounded hover:bg-gray-600 text-sm" 
              onClick={() => {
                // Abort any ongoing AI request
                if (aiRequestController) {
                  aiRequestController.abort();
                }
                
                // Set flag to prevent any pending AI responses
                setNewGameRequested(true);
                setAiThinking(false);
                setAiRequestController(null);
                
                // Reset board immediately when New Game is clicked
                chess.reset();
                setBoardState(chess.board());
                setSelectedSquare(null);
                setValidMoves([]);
                setGameExplicitlyStarted(false);
                setPlayerHasMoved(false);
                setGameEnded(false);
                
                setStartOpen(true);
              }}
            >
              New Game
            </button>
          </div>
        </div>
      </div>

      {/* DESKTOP LAYOUT */}
      <div className="hidden lg:block">
        {/* MAIN CONTENT AREA */}
        <div className="grid grid-cols-[300px_1fr_300px] min-h-screen">
        {/* DESKTOP: LEFT SIDEBAR */}
        <div className="hidden lg:block bg-gray-800 p-4 border-r border-gray-700">
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

          {/* New Game Button */}
          <div className="flex justify-center">
            <button 
              className="w-full px-4 py-3 bg-gray-700 rounded-lg hover:bg-gray-600 text-white font-medium transition-colors duration-200 shadow-lg"
              onClick={() => {
                // Abort any ongoing AI request
                if (aiRequestController) {
                  aiRequestController.abort();
                }
                
                // Set flag to prevent any pending AI responses
                setNewGameRequested(true);
                setAiThinking(false);
                setAiRequestController(null);
                
                // Reset board immediately when New Game is clicked
                chess.reset();
                setBoardState(chess.board());
                setSelectedSquare(null);
                setValidMoves([]);
                setGameExplicitlyStarted(false);
                setPlayerHasMoved(false);
                setGameEnded(false);
                
                setStartOpen(true);
              }}
            >
              New Game
            </button>
          </div>
        </div>
      </div>

      {/* CHESS BOARD CONTAINER */}
      <div className="flex items-center justify-center p-2 lg:p-8 bg-gray-850">
        <div className="chess-board-container relative">
          <div className={`grid grid-cols-8 border-2 border-gray-600 rounded-lg overflow-hidden shadow-2xl w-full max-w-sm lg:max-w-3xl mx-auto aspect-square ${(gameEnded || startOpen) ? 'opacity-50 pointer-events-none' : ''}`}>
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
                        ${squareColor}
                        flex items-center justify-center 
                        cursor-pointer 
                        transition-colors duration-150
                        relative
                        ${isSelected ? 'bg-blue-200' : ''}
                        aspect-square
                      `}
                      onClick={() => handleTileClick(squareName)}
                    >
                      {/* Move indicator dot for all available moves */}
                      {isHighlighted && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                        </div>
                      )}
                      
                      {square && <ChessPiece piece={square.type} color={pieceColor} isSelected={isSelected} />}
                    </div>
                  );
                })
              )}
          </div>
          {/* Game Over Overlay - blocks all interactions */}
          {(gameEnded || startOpen) && (
            <div className="absolute inset-0 bg-transparent pointer-events-auto z-10"></div>
          )}
        </div>
      </div>

        {/* DESKTOP: RIGHT SIDEBAR */}
        <div className="hidden lg:block bg-gray-800 p-4 border-l border-gray-700 flex items-center justify-center">
          <div className="flex flex-col items-center justify-center space-y-6 h-full">
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

          </div>
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
      <Dialog 
        open={startOpen} 
        onClose={() => {}} // Prevent closing by clicking outside
        disableEscapeKeyDown // Prevent closing with Escape key
      >
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
        onClose={() => {}} // Prevent closing by clicking outside
        disableEscapeKeyDown // Prevent closing with Escape key
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
              // Reset board immediately when New Game is clicked
              chess.reset();
              setBoardState(chess.board());
              setSelectedSquare(null);
              setValidMoves([]);
              setGameExplicitlyStarted(false);
              setPlayerHasMoved(false);
              setGameEnded(false);
              setAiThinking(false);
              
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
