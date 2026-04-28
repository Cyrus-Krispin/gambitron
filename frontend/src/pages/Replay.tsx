import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { Chess } from "chess.js";
import { ChessBoard } from "@/components/ChessBoard";

const HORIZONTAL = ["a", "b", "c", "d", "e", "f", "g", "h"];
const VERTICAL_WHITE = ["8", "7", "6", "5", "4", "3", "2", "1"];
const VERTICAL_BLACK = ["1", "2", "3", "4", "5", "6", "7", "8"];

interface MoveInfo {
  ply: number;
  fen: string;
  san: string;
  from_square?: string;
  to_square?: string;
}

function fenToBoardState(fen: string) {
  const chess = new Chess(fen);
  return chess.board().map((row) =>
    row.map((sq) => (sq ? { type: sq.type, color: sq.color } : null))
  ) as { type: string; color: "w" | "b" }[][];
}

function buildMovePairs(moves: MoveInfo[]) {
  const pairs: { num: number; white?: { san: string; ply: number }; black?: { san: string; ply: number } }[] = [];
  for (let i = 0; i < moves.length; i++) {
    const ply = moves[i].ply;
    const moveNum = Math.ceil(ply / 2);
    if (ply % 2 === 1) {
      pairs.push({ num: moveNum, white: { san: moves[i].san, ply } });
    } else {
      const last = pairs[pairs.length - 1];
      if (last) last.black = { san: moves[i].san, ply };
      else pairs.push({ num: moveNum, black: { san: moves[i].san, ply } });
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
        if (!g || !m?.moves?.length) { setError("Game not found or has no moves"); return; }
        setGame(g);
        setMoves(m.moves);
        setCurrentPly(0);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [apiBase, gameId]);

  const startFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const currentFen = currentPly === 0 ? startFen : (moves.find((m) => m.ply === currentPly)?.fen ?? startFen);
  const boardState = useMemo(() => fenToBoardState(currentFen), [currentFen]);
  const orientation = (game?.player_color === "black" ? "black" : "white") as "white" | "black";
  const VERTICAL = orientation === "white" ? VERTICAL_WHITE : VERTICAL_BLACK;

  const currentMove = moves.find((m) => m.ply === currentPly);
  const lastMove = currentMove
    ? { from: currentMove.from_square, to: currentMove.to_square }
    : undefined;

  const goToStart = useCallback(() => setCurrentPly(0), []);
  const goBack = useCallback(() => setCurrentPly((p) => Math.max(0, p - 1)), []);
  const goForward = useCallback(() => setCurrentPly((p) => Math.min(moves.length, p + 1)), [moves.length]);
  const goToEnd = useCallback(() => setCurrentPly(moves.length), [moves.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (loading || error) return;
      switch (e.key) {
        case "ArrowLeft": e.preventDefault(); goBack(); break;
        case "ArrowRight": e.preventDefault(); goForward(); break;
        case "Home": e.preventDefault(); goToStart(); break;
        case "End": e.preventDefault(); goToEnd(); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loading, error, goBack, goForward, goToStart, goToEnd]);

  const movePairs = useMemo(() => buildMovePairs(moves), [moves]);

  if (loading) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--mono)",
          fontSize: 11,
          letterSpacing: "0.14em",
          color: "var(--ink-faint)",
          textTransform: "uppercase",
        }}
      >
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
        }}
      >
        <p style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--accent)" }}>{error}</p>
        <Link to="/history" className="btn-ghost">← Back to history</Link>
      </div>
    );
  }

  return (
    <div className="replay fade-in">
      {/* Board */}
      <div className="board-wrap">
        <div className="player-strip">
          <div className="who">
            <div className="avatar">G</div>
            <div className="meta">
              <div className="name">Gambit</div>
              <div className="sub">
                Bot · {orientation === "white" ? "black" : "white"}
              </div>
            </div>
          </div>
        </div>

        <div className="board-frame">
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
            lastMove={lastMove}
          />
          <div className="replay-controls">
            <button type="button" onClick={goToStart} title="Start (Home)">⏮</button>
            <button type="button" onClick={goBack} title="Prev (←)">‹</button>
            <span className="pos">{currentPly === 0 ? "Start" : `${currentPly} / ${moves.length}`}</span>
            <button type="button" onClick={goForward} title="Next (→)">›</button>
            <button type="button" onClick={goToEnd} title="End (End)">⏭</button>
          </div>
        </div>

        <div className="player-strip">
          <div className="who">
            <div className="avatar">Y</div>
            <div className="meta">
              <div className="name">You</div>
              <div className="sub">Player · {orientation}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Rail */}
      <aside className="rail">
        <section className="card">
          <div className="card-head">
            <span className="title">Replay</span>
            {game?.result && (
              <span
                className={`result-tag ${
                  (game.result === "1-0" && orientation === "white") ||
                  (game.result === "0-1" && orientation === "black")
                    ? "win"
                    : (game.result === "1/2-1/2")
                    ? "draw"
                    : "loss"
                }`}
              >
                {(game.result === "1-0" && orientation === "white") ||
                (game.result === "0-1" && orientation === "black")
                  ? "Won"
                  : game.result === "1/2-1/2"
                  ? "Draw"
                  : "Lost"}
              </span>
            )}
          </div>
          <div className="card-body">
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 11,
                color: "var(--ink-faint)",
                letterSpacing: "0.06em",
              }}
            >
              Use ← → to step. Esc to exit.
            </div>
          </div>
        </section>

        <section className="card" style={{ flex: 1 }}>
          <div className="card-head">
            <span className="title">Move list</span>
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: 11,
                color: "var(--ink-faint)",
              }}
            >
              {currentPly}/{moves.length}
            </span>
          </div>
          <div className="card-body">
            <div className="move-list">
              {movePairs.length === 0 && (
                <div className="empty">No moves recorded.</div>
              )}
              {movePairs.map((pair) => (
                <div key={pair.num} style={{ display: "contents" }}>
                  <span className="num">{pair.num}.</span>
                  <span
                    className={"mv" + (pair.white && currentPly === pair.white.ply ? " current" : "")}
                    onClick={() => pair.white && setCurrentPly(pair.white.ply)}
                    style={{ cursor: pair.white ? "pointer" : "default" }}
                  >
                    {pair.white?.san ?? ""}
                  </span>
                  <span
                    className={"mv" + (pair.black && currentPly === pair.black.ply ? " current" : "")}
                    onClick={() => pair.black && setCurrentPly(pair.black.ply)}
                    style={{ cursor: pair.black ? "pointer" : "default" }}
                  >
                    {pair.black?.san ?? ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <Link to="/history" className="btn-ghost" style={{ padding: "12px 4px" }}>
          ← Back to history
        </Link>
      </aside>
    </div>
  );
}
