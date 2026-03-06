import { useGame } from "@/hooks/useGame";
import { ChessBoard } from "@/components/ChessBoard";
import { Sidebar } from "@/components/Sidebar";
import { TimerCard } from "@/components/TimerCard";
import { Dialogs } from "@/components/Dialogs";
import { Button } from "@/components/ui/button";

export default function Game() {
  const game = useGame();

  return (
    <div
      className={`min-h-dvh flex flex-col lg:grid lg:grid-rows-1 ${
        game.isAdmin ? "lg:grid-cols-[minmax(200px,280px)_1fr]" : "lg:grid-cols-[minmax(200px,280px)_1fr_minmax(200px,280px)]"
      }`}
    >
      {/* Left sidebar - desktop only */}
      <aside className="hidden lg:flex flex-col p-6 border-r border-border bg-card/30">
        <Sidebar
          initialTimeMs={game.initialTimeMs}
          isPlayersTurn={game.isPlayersTurn}
          playerColor={game.playerColor}
          onNewGame={game.handleNewGame}
          isAdmin={game.isAdmin}
          fenInput={game.fenInput}
          onFenInputChange={game.setFenInput}
          onLoadFen={game.onLoadFen}
        />
      </aside>

      {/* Mobile: AI timer bar */}
      {!game.isAdmin && (
        <div className="lg:hidden flex-shrink-0 px-4 py-3 border-b border-border bg-card/30 flex items-center justify-center gap-6">
          <TimerCard
            label="Gambitron"
            timeMs={game.aiTimeMs}
            isActive={!game.isPlayersTurn}
          />
          <TimerCard
            label="You"
            timeMs={game.playerTimeMs}
            isActive={game.isPlayersTurn}
          />
        </div>
      )}

      {/* Board area */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 min-h-0 overflow-hidden gap-4">
        {game.startOpen && (
          <div className="flex items-center gap-3 py-2 px-4 rounded-lg bg-muted/60 border border-border/60">
            <span className="text-sm font-medium text-muted-foreground">Play as</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => game.onStartGame("white")} className="gap-1.5">
                <img src="/pieces/k-white.svg" alt="" className="w-5 h-5" />
                White
              </Button>
              <Button variant="outline" size="sm" onClick={() => game.onStartGame("black")} className="gap-1.5">
                <img src="/pieces/k-black.svg" alt="" className="w-5 h-5" />
                Black
              </Button>
            </div>
          </div>
        )}
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
      </main>

      {/* Right sidebar - timers, desktop only */}
      {!game.isAdmin && (
        <aside className="hidden lg:flex flex-col items-center justify-center gap-8 p-6 border-l border-border bg-card/30">
          <TimerCard
            label="Gambitron"
            timeMs={game.aiTimeMs}
            isActive={!game.isPlayersTurn}
          />
          <TimerCard
            label="You"
            timeMs={game.playerTimeMs}
            isActive={game.isPlayersTurn}
          />
        </aside>
      )}

      {/* Mobile: bottom bar with New Game */}
      {!game.isAdmin && (
        <div className="lg:hidden flex-shrink-0 p-4 border-t border-border bg-card/50">
          <Button onClick={game.handleNewGame} className="w-full" size="lg">
            New Game
          </Button>
        </div>
      )}

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
