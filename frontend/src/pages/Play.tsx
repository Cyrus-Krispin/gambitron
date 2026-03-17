import { useParams, useLocation, useHistory, Link } from "react-router-dom";
import { useGame } from "@/hooks/useGame";
import { ChessBoard } from "@/components/ChessBoard";
import { CaptureDisplay } from "@/components/CaptureDisplay";
import { TimerCard } from "@/components/TimerCard";
import { Dialogs } from "@/components/Dialogs";
import { Button } from "@/components/ui/button";

const VALID_MINUTES = [1, 3, 5, 10, 15, 30];

export default function Play() {
  const { gameId } = useParams<{ gameId: string }>();
  const location = useLocation();
  const history = useHistory();
  const search = new URLSearchParams(location.search);
  const minutesParam = search.get("minutes");
  const parsed = minutesParam ? parseInt(minutesParam, 10) : NaN;
  const initialMinutes = VALID_MINUTES.includes(parsed) ? parsed : 5;
  const colorParam = search.get("color");
  const initialColor = colorParam === "white" || colorParam === "black" ? colorParam : undefined;
  const initialGameState = (location.state as { gameState?: { fen: string; timeControlMs: number; playerColor: "white" | "black" } })?.gameState;

  const game = useGame({
    gameId: gameId ?? null,
    initialMinutes,
    initialColor,
    initialGameState,
    onGameCreated: (id, state) => {
      history.replace(`/play/${id}`, { gameState: state });
    },
  });

  return (
    <div className="min-h-[calc(100dvh-3.5rem)] flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-2 py-4 sm:px-6 sm:py-6 min-h-0">
        <div className="flex flex-col items-center gap-3 sm:gap-4 w-full max-w-[680px] min-w-0">
          {/* Inline color picker - only when no color from URL (e.g. direct /play/5) */}
          {game.startOpen && (
            <div className="flex items-center gap-3 py-2 px-4 rounded-lg bg-muted/60 border border-border/60">
              <span className="text-sm font-medium text-muted-foreground">Play as</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => game.onStartGame("white")}
                  className="gap-1.5"
                >
                  <img src="/pieces/k-white.svg" alt="" className="w-5 h-5" />
                  White
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => game.onStartGame("black")}
                  className="gap-1.5"
                >
                  <img src="/pieces/k-black.svg" alt="" className="w-5 h-5" />
                  Black
                </Button>
              </div>
            </div>
          )}

          {/* Top: AI timer + opponent's captures (their side) */}
          <div className="flex items-center justify-between w-full gap-4">
            <TimerCard
              label="Gambitron"
              timeMs={game.aiTimeMs}
              isActive={!game.isPlayersTurn}
              compact
            />
            <CaptureDisplay
              pieces={game.playerColor === "white" ? game.capturedPieces.byBlack : game.capturedPieces.byWhite}
              pieceColor={game.playerColor === "white" ? "white" : "black"}
            />
          </div>

          {/* Board */}
          <ChessBoard
            boardState={game.boardState}
            selectedSquare={game.selectedSquare}
            validMoves={game.validMoves}
            gameEnded={game.gameEnded}
            startOpen={game.startOpen}
            orientation={game.playerColor}
            onTileClick={game.onTileClick}
            HORIZONTAL={game.HORIZONTAL}
            VERTICAL={game.VERTICAL}
          />

          {/* Bottom: Your timer + your captures + new game */}
          <div className="flex items-center justify-between w-full gap-4">
            <div className="flex items-center gap-6">
              <TimerCard
                label="You"
                timeMs={game.playerTimeMs}
                isActive={game.isPlayersTurn}
                compact
              />
              <CaptureDisplay
                pieces={game.playerColor === "white" ? game.capturedPieces.byWhite : game.capturedPieces.byBlack}
                pieceColor={game.playerColor === "white" ? "black" : "white"}
                materialDiff={game.materialDiff}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to="/">Home</Link>
              </Button>
              <Button size="sm" asChild>
                <Link
                  to={`/play/new?minutes=${Math.max(1, Math.round(game.initialTimeMs / 60000))}${game.playerColor ? `&color=${game.playerColor}` : ""}`}
                >
                  New Game
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

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
