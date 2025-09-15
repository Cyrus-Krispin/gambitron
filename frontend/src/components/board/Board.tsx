import { useEffect, useMemo, useState } from "react";
import { Chess, Square } from "chess.js";
import MobileLayout from "../MobileLayout";
import DesktopLayout from "../DesktopLayout";
import GameDialogs from "../GameDialogs";

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
  const [endgameReason, setEndgameReason] = useState<string>("");

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
  const [fenInput, setFenInput] = useState<string>("");
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(false);

  // Check if we're on admin route
  useEffect(() => {
    if (typeof window === "undefined") return;
    const path = window.location.pathname;
    setIsAdminRoute(path === "/admin");
  }, []);

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

  // Run player clock when it's player's turn and game not over (disabled for admin)
  useEffect(() => {
    if (isAdminRoute) return; // Disable timers in admin view
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
  }, [boardState, aiThinking, playerHasMoved, gameEnded, gameExplicitlyStarted, isAdminRoute]);

  // Run AI clock only while thinking (disabled for admin)
  useEffect(() => {
    if (isAdminRoute) return; // Disable timers in admin view
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
          // Abort any ongoing AI request when AI times out
          if (aiRequestController) {
            aiRequestController.abort();
            setAiRequestController(null);
          }
          openEndgame("1-0", "timeout"); // Player wins by AI timeout
          setAiThinking(false);
        }
        return newTime;
      });
    }, 100);
    return () => window.clearInterval(id);
  }, [aiThinking, gameEnded, gameExplicitlyStarted, aiRequestController, isAdminRoute]);

  // Check for time-based endgames (disabled for admin)
  useEffect(() => {
    if (isAdminRoute) return; // Disable time checks in admin view
    if (chess.isGameOver() || gameEnded) return;
    if (!playerHasMoved || !gameExplicitlyStarted) return; // don't check time until game is explicitly started
    if (aiThinking) return; // don't check timeouts while AI is thinking
    
    if (playerTimeMs <= 0 && chess.turn() === "w") {
      // Player ran out of time
      openEndgame("0-1", "timeout");
    } else if (aiTimeMs <= 0 && chess.turn() === "b") {
      // AI ran out of time
      openEndgame("1-0", "timeout");
    }
  }, [playerTimeMs, aiTimeMs, playerHasMoved, aiThinking, gameEnded, gameExplicitlyStarted, isAdminRoute]);

  const apiUrlBase = useMemo(() => `${import.meta.env.VITE_backend}`, []);

  const saveFen = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("gambitron_fen", chess.fen());
    }
  };

  const openEndgame = (result: string, reason: string = "") => {
    setEndgameResult(result);
    setEndgameReason(reason);
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
        // Triple-check game hasn't ended and new game not requested before updating board
        // This prevents any pending responses from updating the board after game has ended
        if (!gameEnded && !newGameRequested && !chess.isGameOver()) {
          chess.load(data.updated_fen);
          setBoardState(chess.board());
          saveFen();
        }
      }

      // Only process game results if game hasn't ended and new game not requested
      if (!gameEnded && !newGameRequested) {
        if (data.result && data.result !== "*") {
          openEndgame(data.result, "checkmate");
        } else if (chess.isGameOver()) {
          openEndgame(computeResult(chess), "checkmate");
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
        openEndgame(computeResult(chess), "checkmate");
        return;
      }

      // Only call AI if game hasn't ended
      if (!gameEnded) {
        await callAIMove(chess.fen());
      }
    }
  };

  const handleTileClick = async (squareName: string) => {
    if (aiThinking || chess.isGameOver() || gameEnded) return;
    // In admin view, allow moves without gameExplicitlyStarted
    if (!isAdminRoute && !gameExplicitlyStarted) return;
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
      openEndgame(computeResult(chess), "checkmate");
      return;
    }

    // Only call AI if game hasn't ended
    if (!gameEnded) {
      await callAIMove(chess.fen());
    }
  };

  const isPlayersTurn = chess.turn() === "w" && !aiThinking && (gameExplicitlyStarted || isAdminRoute);

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
    console.log("Loading FEN:", fen); // Debug log
    try {
      chess.load(fen);
      console.log("FEN loaded successfully, turn:", chess.turn()); // Debug log
    } catch (e) {
      console.error("FEN loading error:", e); // Debug log
      setErrorMessage(`Invalid FEN: ${e instanceof Error ? e.message : 'Unknown error'}`);
      setErrorOpen(true);
      return;
    }
    setBoardState(chess.board());
    setSelectedSquare(null);
    setValidMoves([]);
    saveFen();
    
    // For admin view, always set game as started and player as moved
    if (isAdminRoute) {
      setGameExplicitlyStarted(true);
      setPlayerHasMoved(true);
    }
    
    // If it's black to move, call AI immediately
    if (callAIWhenBlack && chess.turn() === "b" && !chess.isGameOver() && !gameEnded) {
      console.log("Calling AI move for black turn"); // Debug log
      await callAIMove(chess.fen());
    }
  };


  const handleNewGame = () => {
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
  };

  const handleNewGameFromEndgame = () => {
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
  };

  return (
    <>
      {/* Mobile Layout */}
      <MobileLayout
        boardState={boardState}
        selectedSquare={selectedSquare}
        validMoves={validMoves}
        gameEnded={gameEnded}
        startOpen={startOpen}
        onTileClick={handleTileClick}
        aiTimeMs={aiTimeMs}
        playerTimeMs={playerTimeMs}
        isPlayersTurn={isPlayersTurn}
        onNewGame={handleNewGame}
      />

      {/* Desktop Layout */}
      <DesktopLayout
        boardState={boardState}
        selectedSquare={selectedSquare}
        validMoves={validMoves}
        gameEnded={gameEnded}
        startOpen={startOpen}
        onTileClick={handleTileClick}
        initialTimeMs={initialTimeMs}
        isPlayersTurn={isPlayersTurn}
        onNewGame={handleNewGame}
        aiTimeMs={aiTimeMs}
        playerTimeMs={playerTimeMs}
        isAdminRoute={isAdminRoute}
        fenInput={fenInput}
        onFenInputChange={setFenInput}
        onLoadFen={async () => { 
          if (!fenInput.trim()) {
            setErrorMessage("Please enter a FEN string");
            setErrorOpen(true);
            return;
          }
          await loadFenAndMaybeAI(fenInput.trim()); 
        }}
      />

      {/* Game Dialogs */}
      <GameDialogs
        promotionOpen={promotionOpen}
        onPromotionClose={() => setPromotionOpen(false)}
        onPromotionPick={handlePromotionPick}
        startOpen={startOpen}
        selectedMinutes={selectedMinutes}
        onMinutesChange={setSelectedMinutes}
        onStartGame={() => { startNewGameWithTime(selectedMinutes); setStartOpen(false); }}
        endgameOpen={endgameOpen}
        endgameResult={endgameResult}
        endgameReason={endgameReason}
        onEndgameClose={() => {
          setEndgameOpen(false);
          // Don't reset the game, just close the dialog to view the final position
        }}
        onNewGameFromEndgame={handleNewGameFromEndgame}
        errorOpen={errorOpen}
        errorMessage={errorMessage}
        onErrorClose={() => setErrorOpen(false)}
        onRetry={handleRetry}
        hasRetry={!!lastFenForRetry}
      />

    </>
  );
}
