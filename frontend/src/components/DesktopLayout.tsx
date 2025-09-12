import ChessBoard from "./ChessBoard";
import GameInfo from "./GameInfo";

interface DesktopLayoutProps {
  // Board props
  boardState: any[][];
  selectedSquare: string | null;
  validMoves: string[];
  gameEnded: boolean;
  startOpen: boolean;
  onTileClick: (squareName: string) => void;

  // Game info props
  initialTimeMs: number;
  isPlayersTurn: boolean;
  onNewGame: () => void;

  // Timer props
  aiTimeMs: number;
  playerTimeMs: number;
  aiThinking: boolean;
}

const DesktopLayout = ({
  boardState,
  selectedSquare,
  validMoves,
  gameEnded,
  startOpen,
  onTileClick,
  initialTimeMs,
  isPlayersTurn,
  onNewGame,
  aiTimeMs,
  playerTimeMs,
  aiThinking
}: DesktopLayoutProps) => {
  return (
    <div className="hidden lg:block">
      <div className="grid grid-cols-[300px_1fr_300px] min-h-screen">
        {/* Left Sidebar */}
        <div className="hidden lg:block bg-gray-800 p-4 border-r border-gray-700">
          <GameInfo
            initialTimeMs={initialTimeMs}
            isPlayersTurn={isPlayersTurn}
            onNewGame={onNewGame}
          />
        </div>

        {/* Chess Board Container */}
        <div className="flex items-center justify-center p-4 lg:p-8 bg-gray-850">
          <ChessBoard
            boardState={boardState}
            selectedSquare={selectedSquare}
            validMoves={validMoves}
            gameEnded={gameEnded}
            startOpen={startOpen}
            onTileClick={onTileClick}
          />
        </div>

        {/* Right Sidebar - Both Timers */}
        <div className="hidden lg:block bg-gray-800 p-4 border-l border-gray-700 flex items-center justify-center">
          <div className="flex flex-col items-center justify-center space-y-6 h-full">
            {/* AI Timer */}
            <div className="text-center">
              <div className={`text-4xl font-mono font-bold mb-2 transition-colors duration-300 ${!isPlayersTurn ? 'text-green-400' : 'text-white'}`}>
                {Math.floor(aiTimeMs / 60000).toString().padStart(2, "0")}:{Math.floor((aiTimeMs % 60000) / 1000).toString().padStart(2, "0")}
              </div>
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className={`w-3 h-3 rounded-full transition-all duration-300 ${!isPlayersTurn ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-gray-500'}`}></div>
                <span className={`text-sm font-medium transition-colors duration-300 ${!isPlayersTurn ? 'text-green-400' : 'text-gray-300'}`}>Gambitron</span>
              </div>
            </div>
            
            
            {/* Player Timer */}
            <div className="text-center">
              <div className={`text-4xl font-mono font-bold mb-2 transition-colors duration-300 ${isPlayersTurn ? 'text-green-400' : 'text-white'}`}>
                {Math.floor(playerTimeMs / 60000).toString().padStart(2, "0")}:{Math.floor((playerTimeMs % 60000) / 1000).toString().padStart(2, "0")}
              </div>
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className={`w-3 h-3 rounded-full transition-all duration-300 ${isPlayersTurn ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-gray-500'}`}></div>
                <span className={`text-sm font-medium transition-colors duration-300 ${isPlayersTurn ? 'text-green-400' : 'text-gray-300'}`}>You</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DesktopLayout;
