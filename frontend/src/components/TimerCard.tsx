interface TimerCardProps {
  timeMs: number;
  isActive: boolean;
  isLow?: boolean;
}

export function TimerCard({ timeMs, isActive, isLow }: TimerCardProps) {
  const total = Math.max(0, timeMs);
  const m = Math.floor(total / 60000);
  const s = Math.floor((total % 60000) / 1000);

  let display: string;
  if (total < 20000) {
    const tenths = Math.floor((total % 1000) / 100);
    display = `${m}:${String(s).padStart(2, "0")}.${tenths}`;
  } else {
    display = `${m}:${String(s).padStart(2, "0")}`;
  }

  const cls = [
    "clock",
    isActive ? "active" : "",
    isLow ? "low" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={cls}>{display}</div>;
}
