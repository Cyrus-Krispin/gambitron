interface ChessPieceProps {
  piece: string;
  color: "white" | "black";
  isSelected?: boolean;
  size?: number;
}

const pieceMap: Record<string, string> = {
  p: "p",
  n: "n",
  b: "b",
  r: "r",
  q: "q",
  k: "k",
};

export function ChessPiece({ piece, color, isSelected = false, size = 40 }: ChessPieceProps) {
  const src = `/pieces/${pieceMap[piece.toLowerCase()] || piece}-${color}.svg`;

  return (
    <div
      className={`flex items-center justify-center select-none pointer-events-none transition-transform duration-150 ${
        isSelected ? "scale-105 drop-shadow-lg" : ""
      }`}
      style={{ width: size, height: size }}
    >
      <img
        src={src}
        alt={`${color} ${piece}`}
        className="w-full h-full object-contain"
        draggable={false}
      />
    </div>
  );
}
