const PIECE_ORDER = ["q", "r", "b", "n", "p"] as const;
const PIECE_NAMES: Record<string, string> = { q: "Queen", r: "Rook", b: "Bishop", n: "Knight", p: "Pawn" };

interface CaptureDisplayProps {
  pieces: string[];
  pieceColor: "white" | "black";
  materialDiff?: number;
}

function getPieceImage(piece: string, color: "white" | "black"): string {
  return `/pieces/${piece}-${color}.svg`;
}

function renderCapturedList(pieces: string[]) {
  const counts: Record<string, number> = {};
  pieces.forEach((p) => {
    counts[p] = (counts[p] || 0) + 1;
  });
  return PIECE_ORDER.flatMap((key) =>
    Array.from({ length: counts[key] || 0 }, (_, i) => ({ piece: key, key: `${key}-${i}` }))
  );
}

export function CaptureDisplay({ pieces, pieceColor, materialDiff = 0 }: CaptureDisplayProps) {
  const list = renderCapturedList(pieces);
  const hasContent = list.length > 0 || materialDiff !== 0;

  if (!hasContent) return null;

  return (
    <div className="flex flex-col gap-1 min-w-0">
      <div className="min-h-[1.5rem] flex flex-wrap items-center gap-1.5">
        {list.map(({ piece, key }) => (
          <img
            key={key}
            src={getPieceImage(piece, pieceColor)}
            alt={PIECE_NAMES[piece] || piece}
            className="w-4 h-4 opacity-90 flex-shrink-0"
            title={PIECE_NAMES[piece]}
          />
        ))}
        {materialDiff !== 0 && (
          <span
            className={`text-xs font-medium tabular-nums ${
              materialDiff > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
            }`}
          >
            {materialDiff > 0 ? `+${materialDiff}` : materialDiff}
          </span>
        )}
      </div>
    </div>
  );
}
