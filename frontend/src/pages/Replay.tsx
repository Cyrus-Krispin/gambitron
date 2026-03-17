import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { Chess } from "chess.js";
import { ChevronLeft, ChevronRight, RotateCcw, RotateCw } from "lucide-react";
import { ChessBoard } from "@/components/ChessBoard";
import { Button } from "@/components/ui/button";

const HORIZONTAL = ["a", "b", "c", "d", "e", "f", "g", "h"];
const VERTICAL_WHITE = ["8", "7", "6", "5", "4", "3", "2", "1"];
const VERTICAL_BLACK = ["1", "2", "3", "4", "5", "6", "7", "8"];

interface MoveInfo {
  ply: number;
  fen: string;
  san: string;
  from_square?: string;
  to_square?: string;
  captured?: string;
}

function fenToBoardState(fen: string): { type: string; color: "w" | "b" }[][] {
  const chess = new Chess(fen);
  const board = chess.board();
  return board.map((row) =>
    row.map((sq) =>
      sq ? { type: sq.type, color: sq.color } : null
    )
  ) as { type: string; color: "w" | "b" }[][];
}

/** Group moves into PGN-style pairs: 1. e4 e5 2. Nf3 ... */
function buildMovePairs(moves: MoveInfo[]): { num: number; white?: string; black?: string }[] {
  const pairs: { num: number; white?: string; black?: string }[] = [];
  for (let i = 0; i < moves.length; i++) {
    const ply = moves[i].ply;
    const moveNum = Math.ceil(ply / 2);
    if (ply % 2 === 1) {
      pairs.push({ num: moveNum, white: moves[i].san });
    } else {
      const last = pairs[pairs.length - 1];
      if (last) last.black = moves[i].san;
      else pairs.push({ num: moveNum, black: moves[i].san });
    }
  }
  return pairs;
}

export default function Replay() {
  const { gameId } = useParams<{ gameId: string }>();
  const [game, setGame] = useState<{ player_color: string; result?: string } | null>(null);
  const [moves, setMoves] = useState<MoveInfo[]>([]);
  const [currentPly, setCurrentPly] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiBase = `${import.meta.env.VITE_backend}`;

  useEffect(() => {
    if (!gameId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`${apiBase}/games/${gameId}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`${apiBase}/games/${gameId}/moves`).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([g, m]) => {
        if (cancelled) return;
        if (!g || !m?.moves?.length) {
          setError("Game not found or has no moves");
          return;
        }
        setGame(g);
        setMoves(m.moves);
        setCurrentPly(0);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiBase, gameId]);

  const startFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const currentFen = currentPly === 0 ? startFen : moves.find((m) => m.ply === currentPly)?.fen ?? startFen;
  const boardState = useMemo(() => fenToBoardState(currentFen), [currentFen]);
  const orientation = (game?.player_color === "black" ? "black" : "white") as "white" | "black";
  const VERTICAL = orientation === "white" ? VERTICAL_WHITE : VERTICAL_BLACK;

  const goToStart = useCallback(() => setCurrentPly(0), []);
  const goBack = useCallback(() => setCurrentPly((p) => Math.max(0, p - 1)), []);
  const goForward = useCallback(
    () => setCurrentPly((p) => Math.min(moves.length, p + 1)),
    [moves.length]
  );
  const goToEnd = useCallback(() => setCurrentPly(moves.length), [moves.length]);

  const goToPly = useCallback((ply: number) => setCurrentPly(ply), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (loading || error) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          goBack();
          break;
        case "ArrowRight":
          e.preventDefault();
          goForward();
          break;
        case "Home":
          e.preventDefault();
          goToStart();
          break;
        case "End":
          e.preventDefault();
          goToEnd();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loading, error, goBack, goForward, goToStart, goToEnd]);

  const movePairs = useMemo(() => buildMovePairs(moves), [moves]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
        <p className="text-destructive">{error}</p>
        <Button variant="outline" asChild>
          <Link to="/history">← Back to history</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      {/* Board area */}
      <div className="flex flex-1 flex-col items-center justify-center p-4 lg:p-6 min-h-0">
        <div className="flex flex-col items-center gap-4">
          <ChessBoard
            boardState={boardState}
            selectedSquare={null}
            validMoves={[]}
            gameEnded={true}
            startOpen={false}
            orientation={orientation}
            onTileClick={() => {}}
            HORIZONTAL={HORIZONTAL}
            VERTICAL={VERTICAL}
          />
          {/* Navigation buttons */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={goToStart} title="Start (Home)">
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={goBack} title="Previous (←)">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[4rem] text-center text-sm text-muted-foreground">
              {currentPly === 0 ? "Start" : `${currentPly}/${moves.length}`}
            </span>
            <Button variant="outline" size="icon" onClick={goForward} title="Next (→)">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={goToEnd} title="End (End)">
              <RotateCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* PGN / Move list sidebar */}
      <aside className="w-full border-t border-border/60 bg-card/40 lg:w-80 lg:border-l lg:border-t-0 lg:overflow-auto">
        <div className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Moves</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Click a move to jump. Use ← → or Home/End.
          </p>
          <div className="font-mono text-sm leading-relaxed">
            {movePairs.map((pair) => {
              const whitePly = (pair.num - 1) * 2 + 1;
              const blackPly = pair.num * 2;
              return (
                <span key={pair.num} className="inline">
                  <span className="text-muted-foreground">{pair.num}.</span>{" "}
                  {pair.white && (
                    <button
                      type="button"
                      onClick={() => goToPly(whitePly)}
                      className={`rounded px-0.5 py-0.5 hover:bg-primary/20 ${
                        currentPly === whitePly ? "bg-primary/30 font-medium text-primary" : ""
                      }`}
                    >
                      {pair.white}
                    </button>
                  )}
                  {pair.white && " "}
                  {pair.black && (
                    <button
                      type="button"
                      onClick={() => goToPly(blackPly)}
                      className={`rounded px-0.5 py-0.5 hover:bg-primary/20 ${
                        currentPly === blackPly ? "bg-primary/30 font-medium text-primary" : ""
                      }`}
                    >
                      {pair.black}
                    </button>
                  )}
                  {" "}
                </span>
              );
            })}
          </div>
        </div>
        <div className="border-t border-border/60 p-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/history">← Back to history</Link>
          </Button>
        </div>
      </aside>
    </div>
  );
}
