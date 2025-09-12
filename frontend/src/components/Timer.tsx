interface TimerProps {
  timeMs: number;
  label: string;
  isActive: boolean;
  isThinking?: boolean;
  thinkingText?: string;
  activeText?: string;
}

const Timer = ({ timeMs, label, isActive, isThinking = false, thinkingText = "AI is thinking...", activeText = "Your turn" }: TimerProps) => {
  const formatClock = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, "0");
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  };

  return (
    <div className="text-center">
      <div className="text-3xl font-mono font-bold mb-1">{formatClock(timeMs)}</div>
      <div className="flex items-center justify-center gap-2 mb-1">
        <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500' : 'bg-gray-500'}`}></div>
        <span className="text-sm">{label}</span>
      </div>
      {isThinking !== undefined && (
        <div className={`text-white px-3 py-1 rounded text-sm inline-block ${isThinking ? 'bg-blue-600' : 'bg-green-600'}`}>
          {isThinking ? thinkingText : activeText}
        </div>
      )}
    </div>
  );
};

export default Timer;
