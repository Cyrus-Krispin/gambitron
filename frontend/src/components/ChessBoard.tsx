import { ChessPiece } from "./ChessPiece";
import type { PlayerColor } from "@/hooks/useGame";

interface PieceInfo {
  type: string;
  color: "w" | "b";
}

interface ChessBoardProps {
  boardState: (PieceInfo | null)[][];
  selectedSquare: string | null;
  validMoves: string[];
  gameEnded: boolean;
  startOpen: boolean;
  orientation: PlayerColor;
  onTileClick: (square: string) => void;
  HORIZONTAL: string[];
  VERTICAL: string[];
  lastMove?: { from?: string; to?: string } | null;
  playerColor: PlayerColor;
  isPlayersTurn: boolean;
  onDragStart: (square: string) => void;
  onDropPiece: (from: string, to: string) => void;
  onDragEnd: () => void;
}

export function ChessBoard({
  boardState,
  selectedSquare,
  validMoves,
  gameEnded,
  startOpen,
  orientation,
  onTileClick,
  HORIZONTAL,
  VERTICAL,
  lastMove,
  playerColor,
  isPlayersTurn,
  onDragStart,
  onDropPiece,
  onDragEnd,
}: ChessBoardProps) {
  const flipped = orientation === "black";
  const fileLabels = flipped ? [...HORIZONTAL].reverse() : HORIZONTAL;

  const rows = VERTICAL;

  return (
    <div
      className="board"
      role="grid"
      aria-label="Chess board"
      style={{ opacity: startOpen ? 0.5 : 1, pointerEvents: startOpen ? "none" : "auto" }}
    >
      {rows.map((rank, rowIdx) =>
        fileLabels.map((file, colIdx) => {
          const squareName = `${file}${rank}`;
          const boardRowIdx = flipped ? 7 - rowIdx : rowIdx;
          const boardColIdx = flipped ? 7 - colIdx : colIdx;
          const piece = boardState[boardRowIdx]?.[boardColIdx] as PieceInfo | null | undefined;

          const dark = (rowIdx + colIdx) % 2 === 1;
          const isSelected = selectedSquare === squareName;
          const isLegal = validMoves.includes(squareName);
          const isLastFrom = lastMove?.from === squareName;
          const isLastTo = lastMove?.to === squareName;
          const hasPiece = !!piece;

          const showFile = flipped ? rowIdx === 0 : rowIdx === 7;
          const showRank = flipped ? colIdx === 7 : colIdx === 0;

          const cls = [
            "square",
            dark ? "dark" : "light",
            isSelected ? "selected" : "",
            isLastFrom ? "last-from" : "",
            isLastTo ? "last-to" : "",
            hasPiece ? "has-piece" : "",
          ]
            .filter(Boolean)
            .join(" ");

          const pieceIsDraggable =
            piece &&
            isPlayersTurn &&
            !gameEnded &&
            ((playerColor === "white" && piece.color === "w") ||
              (playerColor === "black" && piece.color === "b"));

          return (
            <div
              key={squareName}
              className={cls}
              onClick={() => !gameEnded && onTileClick(squareName)}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => {
                e.preventDefault();
                const fromSquare = e.dataTransfer.getData("text/plain");
                if (fromSquare && !gameEnded) {
                  onDropPiece(fromSquare, squareName);
                }
              }}
              role="gridcell"
              aria-label={squareName}
            >
              {showFile && <span className="coord file">{file}</span>}
              {showRank && <span className="coord rank">{rank}</span>}
              {piece && (
                <ChessPiece
                  piece={piece.type}
                  color={piece.color === "w" ? "white" : "black"}
                  squareName={squareName}
                  draggable={!!pieceIsDraggable}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                />
              )}
              {isLegal && <span className="move-dot" />}
            </div>
          );
        })
      )}
    </div>
  );
}
