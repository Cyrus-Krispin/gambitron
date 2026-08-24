import type { PlayerColor } from "@/hooks/useGame";

const FILES = "abcdefgh";

export function getKeyboardTarget(
  square: string,
  key: string,
  orientation: PlayerColor
): string {
  const fileIndex = FILES.indexOf(square[0]);
  const rank = Number(square[1]);
  if (fileIndex < 0 || !Number.isInteger(rank)) return square;

  const direction = orientation === "white" ? 1 : -1;
  const deltas: Record<string, [number, number]> = {
    ArrowUp: [0, direction],
    ArrowDown: [0, -direction],
    ArrowLeft: [-direction, 0],
    ArrowRight: [direction, 0],
  };
  const delta = deltas[key];
  if (!delta) return square;

  const nextFile = fileIndex + delta[0];
  const nextRank = rank + delta[1];
  if (nextFile < 0 || nextFile > 7 || nextRank < 1 || nextRank > 8) return square;
  return `${FILES[nextFile]}${nextRank}`;
}
