const PIECE_ORDER = ["q", "r", "b", "n", "p"] as const;

interface CaptureDisplayProps {
  pieces: string[];
  pieceColor: "white" | "black";
  materialDiff?: number;
}

export function CaptureDisplay({ pieces, pieceColor, materialDiff = 0 }: CaptureDisplayProps) {
  const counts: Record<string, number> = {};
  pieces.forEach((p) => { counts[p] = (counts[p] || 0) + 1; });

  const sorted = PIECE_ORDER.flatMap((key) =>
    Array.from({ length: counts[key] || 0 }, (_, i) => ({ piece: key, key: `${key}-${i}` }))
  );

  if (sorted.length === 0 && !materialDiff) return <div className="captures" />;

  return (
    <div className="captures">
      {sorted.map(({ piece, key }) => (
        <span key={key} className="cap-piece">
          <img
            src={`/pieces/${piece}-${pieceColor}.svg`}
            alt={`captured ${pieceColor} ${piece}`}
            draggable={false}
          />
        </span>
      ))}
      {materialDiff > 0 && (
        <span className="material-diff">+{materialDiff}</span>
      )}
    </div>
  );
}
