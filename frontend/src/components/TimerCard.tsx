interface TimerCardProps {
  label: string;
  timeMs: number;
  isActive: boolean;
  compact?: boolean;
}

export function TimerCard({ label, timeMs, isActive, compact }: TimerCardProps) {
  const m = Math.floor(timeMs / 60000);
  const s = Math.floor((timeMs % 60000) / 1000);
  const timeStr = `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;

  return (
    <div className="text-center">
      <div
        className={`font-mono font-bold tabular-nums transition-colors duration-300 ${
          compact ? "text-lg" : "text-2xl sm:text-3xl lg:text-4xl"
        } ${isActive ? "text-primary" : "text-muted-foreground"}`}
      >
        {timeStr}
      </div>
      <div className="flex items-center justify-center gap-2 mt-1">
        <div
          className={`w-2 h-2 rounded-full transition-all duration-300 ${
          isActive ? "bg-primary shadow-[0_0_8px_var(--primary)]" : "bg-muted-foreground"
          }`}
        />
        <span className={`font-medium ${compact ? "text-xs" : "text-sm"} ${isActive ? "text-primary" : "text-muted-foreground"}`}>
          {label}
        </span>
      </div>
    </div>
  );
}
