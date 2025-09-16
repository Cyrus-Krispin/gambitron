import ChessBoard from "./ChessBoard";
import GameInfo from "./GameInfo";
import SocialLinks from "./SocialLinks";

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

  // Admin props
  isAdminRoute: boolean;
  fenInput: string;
  onFenInputChange: (value: string) => void;
  onLoadFen: () => void;
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
  isAdminRoute,
  fenInput,
  onFenInputChange,
  onLoadFen
}: DesktopLayoutProps) => {
  return (
    <div className="hidden lg:block">
      <div className={`grid min-h-screen ${isAdminRoute ? 'grid-cols-[300px_1fr]' : 'grid-cols-[300px_1fr_300px]'}`}>
        {/* Left Sidebar */}
        <div className="hidden lg:block bg-gray-800 p-4 border-r border-gray-700 flex flex-col h-full">
          {/* Social Links - Top Left */}
          <div className="mb-4">
            <SocialLinks />
          </div>
          
          <GameInfo
            initialTimeMs={initialTimeMs}
            isPlayersTurn={isPlayersTurn}
            onNewGame={onNewGame}
            isAdminRoute={isAdminRoute}
          />
          
          {/* Admin Dialog - Only show on /admin route */}
          {isAdminRoute && (
            <div className="mt-4">
              <div className="p-3 bg-gray-700 rounded-lg">
                <div className="text-sm font-medium text-gray-200 mb-2">Admin: Load FEN Position</div>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={fenInput}
                    onChange={(e) => onFenInputChange(e.target.value)}
                    placeholder="Enter FEN string..."
                    className="w-full px-3 py-2 text-sm bg-gray-600 text-white rounded border border-gray-500 focus:border-blue-400 focus:outline-none"
                  />
                  <button
                    onClick={onLoadFen}
                    className="w-full px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors duration-200"
                  >
                    Load Position
                  </button>
                  
                  {/* Example FEN strings */}
                  <div className="mt-3 text-xs text-gray-400">
                    <div className="font-medium mb-1">Example FEN strings:</div>
                    <div className="space-y-1">
                      <button
                        onClick={() => onFenInputChange("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")}
                        className="block w-full text-left hover:text-blue-400 transition-colors"
                      >
                        Starting position
                      </button>
                      <button
                        onClick={() => onFenInputChange("r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 4 4")}
                        className="block w-full text-left hover:text-blue-400 transition-colors"
                      >
                        Mid-game position
                      </button>
                      <button
                        onClick={() => onFenInputChange("8/8/8/8/8/8/4K3/4k3 w - - 0 1")}
                        className="block w-full text-left hover:text-blue-400 transition-colors"
                      >
                        King vs King
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
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

        {/* Right Sidebar - Both Timers (hidden in admin view) */}
        {!isAdminRoute && (
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
        )}
      </div>
    </div>
  );
};

export default DesktopLayout;
