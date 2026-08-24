import { useRef, useState } from "react";
import { ChessPiece } from "./ChessPiece";
import type { PlayerColor } from "@/hooks/useGame";
import { getKeyboardTarget } from "@/lib/boardKeyboard";

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
  highlightedSquares?: Array<{ square: string; className: string }>;
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
  highlightedSquares,
}: ChessBoardProps) {
  const flipped = orientation === "black";
  const fileLabels = flipped ? [...HORIZONTAL].reverse() : HORIZONTAL;
  const [focusedSquare, setFocusedSquare] = useState(orientation === "white" ? "e2" : "e7");
  const squareRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const rows = VERTICAL;

  return (
    <div
      className="board"
      role="grid"
      aria-label="Chess board"
      aria-rowcount={8}
      aria-colcount={8}
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
          const highlight = highlightedSquares?.find((h) => h.square === squareName);

          const showFile = flipped ? rowIdx === 0 : rowIdx === 7;
          const showRank = flipped ? colIdx === 7 : colIdx === 0;

          const cls = [
            "square",
            dark ? "dark" : "light",
            isSelected ? "selected" : "",
            isLastFrom ? "last-from" : "",
            isLastTo ? "last-to" : "",
            hasPiece ? "has-piece" : "",
            highlight?.className ?? "",
          ]
            .filter(Boolean)
            .join(" ");

          const pieceIsDraggable =
            piece &&
            isPlayersTurn &&
            !gameEnded &&
            ((playerColor === "white" && piece.color === "w") ||
              (playerColor === "black" && piece.color === "b"));

          const pieceColor = piece?.color === "w" ? "white" : "black";
          const pieceNames: Record<string, string> = {
            p: "pawn",
            n: "knight",
            b: "bishop",
            r: "rook",
            q: "queen",
            k: "king",
          };
          const squareLabel = [
            squareName,
            piece ? `${pieceColor} ${pieceNames[piece.type.toLowerCase()] ?? piece.type}` : "empty",
            isSelected ? "selected" : "",
            isLegal ? "legal move" : "",
          ]
            .filter(Boolean)
            .join(", ");

          return (
            <button
              type="button"
              key={squareName}
              ref={(node) => {
                squareRefs.current[squareName] = node;
              }}
              className={cls}
              onClick={() => !gameEnded && onTileClick(squareName)}
              onFocus={() => setFocusedSquare(squareName)}
              onKeyDown={(event) => {
                if (event.key === "Escape" && selectedSquare) {
                  event.preventDefault();
                  onTileClick(selectedSquare);
                  return;
                }
                const target = getKeyboardTarget(squareName, event.key, orientation);
                if (target !== squareName) {
                  event.preventDefault();
                  setFocusedSquare(target);
                  squareRefs.current[target]?.focus();
                }
              }}
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
              aria-label={squareLabel}
              aria-selected={isSelected}
              tabIndex={focusedSquare === squareName ? 0 : -1}
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
            </button>
          );
        })
      )}
    </div>
  );
}
