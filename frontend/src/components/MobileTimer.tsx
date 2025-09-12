import Timer from "./Timer";

interface MobileTimerProps {
  timeMs: number;
  label: string;
  isActive: boolean;
  isThinking?: boolean;
  thinkingText?: string;
  activeText?: string;
  onNewGame?: () => void;
  showNewGameButton?: boolean;
}

const MobileTimer = ({ 
  timeMs, 
  label, 
  isActive, 
  isThinking, 
  thinkingText, 
  activeText, 
  onNewGame, 
  showNewGameButton = false 
}: MobileTimerProps) => {
  return (
    <div className="bg-gray-800 p-2 border-b border-gray-700">
      <Timer 
        timeMs={timeMs}
        label={label}
        isActive={isActive}
        isThinking={isThinking}
        thinkingText={thinkingText}
        activeText={activeText}
      />
      {showNewGameButton && onNewGame && (
        <div className="mt-2">
          <button 
            className="px-4 py-1 bg-gray-700 rounded hover:bg-gray-600 text-sm" 
            onClick={onNewGame}
          >
            New Game
          </button>
        </div>
      )}
    </div>
  );
};

export default MobileTimer;
