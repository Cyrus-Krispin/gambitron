import React, { useEffect, useState } from "react";
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
}: ChessBoardProps) {
  const [size, setSize] = useState(320);
  const labelSize = 18;

  useEffect(() => {
    const update = () => {
      const vv = window.visualViewport;
      const vw = vv ? vv.width : window.innerWidth;
      const vh = vv ? vv.height : window.innerHeight;
      // Reserve: header 56px, padding 32px, capture ~50px, controls ~56px, gaps ~24px
      const reservedH = 64;
      const reservedV = 220;
      const availW = vw - reservedH;
      const availH = vh - reservedV;
      // Board + labels: width = size + labelSize, height = size + labelSize (file labels only on bottom)
      const maxByW = availW - labelSize;
      const maxByH = availH - labelSize;
      const maxSize = Math.min(maxByW, maxByH);
      const clamped = Math.max(200, Math.min(maxSize, 560));
      setSize(Math.floor(clamped));
    };
    update();
    const viewport = window.visualViewport;
    if (viewport) {
      viewport.addEventListener("resize", update);
      viewport.addEventListener("scroll", update);
      return () => {
        viewport.removeEventListener("resize", update);
        viewport.removeEventListener("scroll", update);
      };
    }
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const tileSize = size / 8;
  const flipped = orientation === "black";
  const fileLabels = flipped ? [...HORIZONTAL].reverse() : HORIZONTAL;

  const gap = labelSize;

  return (
    <div className="relative">
      <div
        className="relative transition-opacity duration-300 font-mono text-xs text-muted-foreground"
        style={{
          display: "grid",
          gridTemplateColumns: `${gap}px repeat(8, ${tileSize}px)`,
          gridTemplateRows: `repeat(8, ${tileSize}px) ${gap}px`,
          width: size + gap,
          minHeight: size + gap,
          opacity: startOpen ? 0.5 : 1,
          pointerEvents: startOpen ? "none" : "auto",
        }}
      >
        {/* Rank labels + board rows */}
        {VERTICAL.map((row, rowIdx) => (
          <React.Fragment key={row}>
            {/* Rank label (1-8) - centered on board row */}
            <div
              className="flex items-center justify-center"
              style={{ gridColumn: 1, gridRow: rowIdx + 1 }}
            >
              {row}
            </div>
            {/* Board squares */}
            {fileLabels.map((col, colIdx) => {
              const boardColIdx = flipped ? 7 - colIdx : colIdx;
              const squareName = `${col}${row}`;
              const boardRowIdx = flipped ? 7 - rowIdx : rowIdx;
              const piece = boardState[boardRowIdx]?.[boardColIdx] as PieceInfo | null | undefined;
              const isLight = (rowIdx + colIdx) % 2 === 0;
              const isSelected = selectedSquare === squareName;
              const isHighlight = validMoves.includes(squareName);

              return (
                <button
                  key={squareName}
                  type="button"
                  onClick={() => !gameEnded && onTileClick(squareName)}
                  className={`
                    relative flex items-center justify-center
                    transition-colors duration-150
                    ${isLight ? "bg-[var(--board-light)]" : "bg-[var(--board-dark)]"}
                    ${isSelected ? "bg-[#CDD26A] ring-2 ring-inset ring-primary/40" : ""}
                    ${isHighlight && !piece ? "" : ""}
                    ${isHighlight && piece ? "ring-2 ring-inset ring-primary/50" : ""}
                  `}
                  style={{ gridColumn: colIdx + 2, gridRow: rowIdx + 1, width: tileSize, height: tileSize }}
                >
                  {isHighlight && !piece && (
                    <div className="absolute w-1/4 h-1/4 rounded-full bg-foreground/20" />
                  )}
                  {piece && (
                    <ChessPiece
                      piece={piece.type}
                      color={piece.color === "w" ? "white" : "black"}
                      isSelected={isSelected}
                      size={tileSize * 0.85}
                    />
                  )}
                </button>
              );
            })}
          </React.Fragment>
        ))}

        {/* Bottom-left corner: empty */}
        <div style={{ gridColumn: 1, gridRow: 9 }} />
        {/* File labels (a-h) - only on bottom, flipped when black */}
        {fileLabels.map((col, i) => (
          <div
            key={`file-${col}`}
            className="flex items-center justify-center"
            style={{ gridColumn: i + 2, gridRow: 9 }}
          >
            {col}
          </div>
        ))}
      </div>

      {/* Board border - overlay on the 8x8 grid area */}
      <div
        className="absolute pointer-events-none overflow-hidden rounded-md shadow-lg border border-border/60"
        style={{
          left: gap,
          top: 0,
          width: size,
          height: size,
        }}
        aria-hidden
      />

      {startOpen && (
        <div className="absolute inset-0 z-10 pointer-events-auto" aria-hidden />
      )}
    </div>
  );
}
