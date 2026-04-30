interface ChessPieceProps {
  piece: string;
  color: "white" | "black";
  squareName: string;
  draggable: boolean;
  onDragStart: (squareName: string) => void;
  onDragEnd: () => void;
}

export function ChessPiece({ piece, color, squareName, draggable, onDragStart, onDragEnd }: ChessPieceProps) {
  const src = `/pieces/${piece.toLowerCase()}-${color}.svg`;
  return (
    <div
      className={`piece${draggable ? " draggable" : ""}`}
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", squareName);
        e.dataTransfer.effectAllowed = "move";
        onDragStart(squareName);
      }}
      onDragEnd={onDragEnd}
    >
      <img src={src} alt={`${color} ${piece}`} draggable={false} />
    </div>
  );
}
