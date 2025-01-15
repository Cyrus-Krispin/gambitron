import "./tile.css";

interface TileProps {
  tileColor: string;
  piece?: string;
  onClick: () => void;
  isHighlighted?: boolean;
}

export default function Tile({
  tileColor,
  piece,
  onClick,
  isHighlighted,
}: TileProps) {
  return (
    <div
      className={`tile ${tileColor} ${isHighlighted ? "highlight" : ""}`}
      onClick={onClick}
    >
      {piece && (
        <img
          src={`/pieces/${piece[1].toLowerCase()}-${
            piece[0] === "w" ? "white" : "black"
          }.svg`}
          alt={piece}
        />
      )}
    </div>
  );
}
