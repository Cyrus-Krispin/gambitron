const PIECE_ORDER = ["q", "r", "b", "n", "p"] as const;
const PIECE_NAMES: Record<string, string> = { q: "Queen", r: "Rook", b: "Bishop", n: "Knight", p: "Pawn" };

interface CaptureDisplayProps {
  pieces: string[];
  pieceColor: "white" | "black";
  label: string;
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

export function CaptureDisplay({ pieces, pieceColor, label }: CaptureDisplayProps) {
  const list = renderCapturedList(pieces);

  return (
    <div className="flex flex-col gap-1 min-w-0">
      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </div>
      <div className="min-h-[1.5rem] flex flex-wrap items-center gap-1">
        {list.length === 0 ? (
          <span className="text-xs text-muted-foreground/60">—</span>
        ) : (
          list.map(({ piece, key }) => (
            <img
              key={key}
              src={getPieceImage(piece, pieceColor)}
              alt={PIECE_NAMES[piece] || piece}
              className="w-4 h-4 opacity-90 flex-shrink-0"
              title={PIECE_NAMES[piece]}
            />
          ))
        )}
      </div>
    </div>
  );
}
