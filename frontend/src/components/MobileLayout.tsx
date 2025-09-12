import ChessBoard from "./ChessBoard";

interface MobileLayoutProps {
  // Board props
  boardState: any[][];
  selectedSquare: string | null;
  validMoves: string[];
  gameEnded: boolean;
  startOpen: boolean;
  onTileClick: (squareName: string) => void;

  // Timer props
  aiTimeMs: number;
  playerTimeMs: number;
  isPlayersTurn: boolean;

  // Actions
  onNewGame: () => void;
}

const MobileLayout = ({
  boardState,
  selectedSquare,
  validMoves,
  gameEnded,
  startOpen,
  onTileClick,
  aiTimeMs,
  playerTimeMs,
  isPlayersTurn,
  onNewGame
}: MobileLayoutProps) => {
  const formatClock = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, "0");
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  };

  return (
    <div className="lg:hidden flex flex-col h-screen">
      {/* AI Timer at Top */}
      <div className="bg-gray-800 p-2 border-b border-gray-700 flex-shrink-0">
        <div className="text-center">
          {/* Timer Section */}
          <div className="p-3 rounded-lg bg-gray-700">
            <div className={`text-3xl font-mono font-bold mb-1 transition-colors duration-300 ${!isPlayersTurn ? 'text-green-400' : 'text-white'}`}>
              {formatClock(aiTimeMs)}
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className={`w-3 h-3 rounded-full transition-all duration-300 ${!isPlayersTurn ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-gray-500'}`}></div>
              <span className={`text-sm font-medium transition-colors duration-300 ${!isPlayersTurn ? 'text-green-400' : 'text-gray-300'}`}>Gambitron</span>
            </div>
          </div>
        </div>
      </div>


      {/* Board Container - Takes remaining space */}
      <div className="flex-1 flex items-center justify-center p-2 bg-gray-850 min-h-0">
        <ChessBoard
          boardState={boardState}
          selectedSquare={selectedSquare}
          validMoves={validMoves}
          gameEnded={gameEnded}
          startOpen={startOpen}
          onTileClick={onTileClick}
        />
      </div>

      {/* Player Timer at Bottom */}
      <div className="bg-gray-800 p-2 border-t border-gray-700 flex-shrink-0">
        <div className="text-center">
          {/* Timer Section */}
          <div className="p-3 rounded-lg mb-4 bg-gray-700">
            <div className={`text-3xl font-mono font-bold mb-1 transition-colors duration-300 ${isPlayersTurn ? 'text-green-400' : 'text-white'}`}>
              {formatClock(playerTimeMs)}
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className={`w-3 h-3 rounded-full transition-all duration-300 ${isPlayersTurn ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-gray-500'}`}></div>
              <span className={`text-sm font-medium transition-colors duration-300 ${isPlayersTurn ? 'text-green-400' : 'text-gray-300'}`}>You</span>
            </div>
          </div>
          
          {/* Modern New Game Button */}
          <button 
            className="px-6 py-3 text-white text-sm font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 active:scale-95" 
            style={{
              background: 'linear-gradient(to right, #2563eb, #1d4ed8)',
              border: 'none'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(to right, #1d4ed8, #1e40af)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(to right, #2563eb, #1d4ed8)';
            }}
            onClick={onNewGame}
          >
            New Game
          </button>
        </div>
      </div>
    </div>
  );
};

export default MobileLayout;
