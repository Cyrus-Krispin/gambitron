interface GameInfoProps {
  initialTimeMs: number;
  isPlayersTurn: boolean;
  onNewGame: () => void;
}

const GameInfo = ({ initialTimeMs, isPlayersTurn, onNewGame }: GameInfoProps) => {
  const getTimeControlLabel = (minutes: number) => {
    if (minutes < 3) return 'Bullet';
    if (minutes < 10) return 'Blitz';
    if (minutes < 30) return 'Rapid';
    return 'Classical';
  };

  return (
    <div className="space-y-4">
      {/* Game Info Section */}
      <div className="bg-gray-700 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 bg-gray-600 rounded flex items-center justify-center">♔</div>
          <div>
            <div className="text-sm font-medium">
              {Math.floor(initialTimeMs / (60 * 1000))} min • {getTimeControlLabel(Math.floor(initialTimeMs / (60 * 1000)))}
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
          className="w-full px-6 py-3 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 active:scale-95"
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
  );
};

export default GameInfo;
