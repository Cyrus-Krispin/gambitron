import React, { useState } from "react";
import Piece from "./Piece";
import { PieceType } from "./types/pieces";

const Board: React.FC = () => {
  const [board, setBoard] = useState<(PieceType | null)[][]>([
    [
      { type: "rook", color: "black" },
      { type: "knight", color: "black" },
      { type: "bishop", color: "black" },
      { type: "queen", color: "black" },
      { type: "king", color: "black" },
      { type: "bishop", color: "black" },
      { type: "knight", color: "black" },
      { type: "rook", color: "black" },
    ],
    [
      { type: "pawn", color: "black" },
      { type: "pawn", color: "black" },
      { type: "pawn", color: "black" },
      { type: "pawn", color: "black" },
      { type: "pawn", color: "black" },
      { type: "pawn", color: "black" },
      { type: "pawn", color: "black" },
      { type: "pawn", color: "black" },
    ],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [
      { type: "pawn", color: "white" },
      { type: "pawn", color: "white" },
      { type: "pawn", color: "white" },
      { type: "pawn", color: "white" },
      { type: "pawn", color: "white" },
      { type: "pawn", color: "white" },
      { type: "pawn", color: "white" },
      { type: "pawn", color: "white" },
    ],
    [
      { type: "rook", color: "white" },
      { type: "knight", color: "white" },
      { type: "bishop", color: "white" },
      { type: "queen", color: "white" },
      { type: "king", color: "white" },
      { type: "bishop", color: "white" },
      { type: "knight", color: "white" },
      { type: "rook", color: "white" },
    ],
  ]);

  const [draggedPiece, setDraggedPiece] = useState<{ row: number; col: number } | null>(null);

  // Handle drag start
  const handleDragStart = (row: number, col: number) => {
    const piece = board[row][col];
    console.log(`Dragging piece: ${piece?.type} (${piece?.color}) from (${row}, ${col})`);
    setDraggedPiece({ row, col });
  };

  // Handle drop
  const handleDrop = (row: number, col: number) => {
    if (draggedPiece) {
      if (row == draggedPiece.row && col == draggedPiece.col) {
        return
      }
      const piece = board[draggedPiece.row][draggedPiece.col];
      console.log(`Dropping piece: ${piece?.type} (${piece?.color}) to (${row}, ${col})`);
      const newBoard = [...board];
      newBoard[row][col] = newBoard[draggedPiece.row][draggedPiece.col]; // Move the piece
      newBoard[draggedPiece.row][draggedPiece.col] = null; // Clear the original square
      setBoard(newBoard);
      setDraggedPiece(null); // Reset dragged piece
    }
  };

  // Prevent default dragover behavior
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // Render a single square
  const renderSquare = (row: number, col: number) => {
    const piece = board[row][col];
    return (
      <div
        key={`${row}-${col}`}
        onDragOver={handleDragOver} // Allow dropping
        onDrop={() => handleDrop(row, col)} // Handle drop
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: (row + col) % 2 === 1 ? "#B58863" : "#F0D9B5",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {piece ? (
          <div
            draggable
            onDragStart={() => handleDragStart(row, col)} // Handle drag start
            style={{
              width: "80%",
              height: "80%",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              cursor: "grab",
            }}
          >
            <Piece piece={piece} />
          </div>
        ) : null}
      </div>
    );
  };

  // Render the board
  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: "repeat(8, 1fr)",
        gridTemplateColumns: "repeat(8, 1fr)",
        width: "80vmin",
        height: "80vmin",
        border: "1px solid #000",
      }}
    >
      {Array.from({ length: 8 }, (_, row) =>
        Array.from({ length: 8 }, (_, col) => renderSquare(row, col))
      )}
    </div>
  );
};

export default Board;
