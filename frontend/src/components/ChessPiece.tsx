interface ChessPieceProps {
  piece: string;
  color: "white" | "black";
}

export function ChessPiece({ piece, color }: ChessPieceProps) {
  const src = `/pieces/${piece.toLowerCase()}-${color}.svg`;
  return (
    <div className="piece">
      <img src={src} alt={`${color} ${piece}`} draggable={false} />
    </div>
  );
}
