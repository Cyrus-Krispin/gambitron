import { useParams, useLocation, useHistory } from "react-router-dom";
import { useGame } from "@/hooks/useGame";
import { ChessBoard } from "@/components/ChessBoard";
import { CaptureDisplay } from "@/components/CaptureDisplay";
import { TimerCard } from "@/components/TimerCard";
import { Dialogs } from "@/components/Dialogs";

const VALID_MINUTES = [1, 2, 3, 5, 10, 15, 30];

function MoveList({ moves }: { moves: Array<{ from?: string; to?: string; color: "w" | "b"; san?: string }> }) {
  if (moves.length === 0) {
    return (
      <div className="move-list">
        <div className="empty">— awaiting first move —</div>
      </div>
    );
  }

  const pairs: [typeof moves[0], typeof moves[0] | undefined][] = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push([moves[i], moves[i + 1]]);
  }

  return (
    <div className="move-list">
      {pairs.map(([w, b], i) => {
        const wText = w?.san || (w?.from && w?.to ? `${w.from}${w.to}` : "—");
        const bText = b ? (b.san || (b.from && b.to ? `${b.from}${b.to}` : "—")) : "";
        return (
          <div key={i} style={{ display: "contents" }}>
            <span className="num">{i + 1}.</span>
            <span className="mv">{wText}</span>
            <span className="mv">{bText}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function Play() {
  const { gameId } = useParams<{ gameId: string }>();
  const location = useLocation();
  const history = useHistory();
  const search = new URLSearchParams(location.search);
  const minutesParam = search.get("minutes");
  const parsed = minutesParam ? parseInt(minutesParam, 10) : NaN;
  const initialMinutes = VALID_MINUTES.includes(parsed) ? parsed : 5;
  const colorParam = search.get("color");
  const initialColor =
    colorParam === "white" || colorParam === "black" ? colorParam : undefined;
  const initialGameState = (
    location.state as {
      gameState?: { fen: string; timeControlMs: number; playerColor: "white" | "black" };
    }
  )?.gameState;

  const game = useGame({
    gameId: gameId ?? null,
    initialMinutes,
    initialColor,
    initialGameState,
    onGameCreated: (id, state) => {
      history.replace(`/play/${id}`, { gameState: state });
    },
  });

  const playerColor = game.playerColor;
  const botColor = playerColor === "white" ? "black" : "white";

  const botTimeMs = game.aiTimeMs;
  const myTimeMs = game.playerTimeMs;
  const isBotActive = !game.isPlayersTurn && !game.gameEnded;
  const isMyActive = game.isPlayersTurn && !game.gameEnded;
  const myLow = myTimeMs < 30000;
  const botLow = botTimeMs < 30000;

  const myCaptures =
    playerColor === "white"
      ? game.capturedPieces.byWhite
      : game.capturedPieces.byBlack;
  const botCaptures =
    playerColor === "white"
      ? game.capturedPieces.byBlack
      : game.capturedPieces.byWhite;

  return (
    <div className="game fade-in">
      {/* Left: board area */}
      <div className="board-wrap">
        {/* Opponent strip */}
        <div className="player-strip">
          <div className="who">
            <div className="avatar">G</div>
            <div className="meta">
              <div className="name">Gambitron</div>
              <div className="sub">Bot · 1420 · {botColor}</div>
            </div>
          </div>
          <CaptureDisplay
            pieces={botCaptures}
            pieceColor={botColor}
          />
          <TimerCard
            timeMs={botTimeMs}
            isActive={isBotActive}
            isLow={botLow}
          />
        </div>

        {/* Board */}
        <div className="board-frame">
          <ChessBoard
            boardState={game.boardState}
            selectedSquare={game.selectedSquare}
            validMoves={game.validMoves}
            gameEnded={game.gameEnded}
            startOpen={game.startOpen}
            orientation={playerColor}
            onTileClick={game.onTileClick}
            HORIZONTAL={game.HORIZONTAL}
            VERTICAL={game.VERTICAL}
            lastMove={game.lastMove}
          />

          {/* Color picker overlay when startOpen */}
          {game.startOpen && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: "oklch(0.18 0.008 60 / 0.85)",
                backdropFilter: "blur(2px)",
                gap: 16,
              }}
            >
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "var(--ink-faint)",
                  marginBottom: 8,
                }}
              >
                Play as
              </div>
              <div style={{ display: "flex", gap: 1, background: "var(--line-soft)" }}>
                {(["white", "black"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => game.onStartGame(c)}
                    style={{
                      background: "var(--bg-card)",
                      padding: "18px 28px",
                      fontFamily: "var(--mono)",
                      fontSize: 11,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: "var(--ink-dim)",
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <img src={`/pieces/k-${c}.svg`} alt={c} style={{ width: 40, height: 40 }} />
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Your strip */}
        <div className="player-strip">
          <div className="who">
            <div className="avatar">Y</div>
            <div className="meta">
              <div className="name">You</div>
              <div className="sub">Player · {playerColor}</div>
            </div>
          </div>
          <CaptureDisplay
            pieces={myCaptures}
            pieceColor={playerColor}
            materialDiff={game.materialDiff > 0 ? game.materialDiff : 0}
          />
          <TimerCard
            timeMs={myTimeMs}
            isActive={isMyActive}
            isLow={myLow}
          />
        </div>
      </div>

      {/* Right rail */}
      <aside className="rail">
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
              {game.moveHistory.length}
            </span>
          </div>
          <div className="card-body">
            <MoveList moves={game.moveHistory} />
          </div>
        </section>
      </aside>

      <Dialogs
        promotionOpen={game.promotionOpen}
        onPromotionClose={game.onPromotionClose}
        onPromotionPick={game.handlePromotionPick}
        playerColor={game.playerColor}
        endgameOpen={game.endgameOpen}
        endgameResult={game.endgameResult}
        endgameReason={game.endgameReason}
        onEndgameClose={game.onEndgameClose}
        onNewGameFromEndgame={game.handleNewGameFromEndgame}
        errorOpen={game.errorOpen}
        errorMessage={game.errorMessage}
        onErrorClose={game.onErrorClose}
        onRetry={game.handleRetry}
        hasRetry={game.hasRetry}
      />
    </div>
  );
}
