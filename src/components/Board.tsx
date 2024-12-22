import React from "react";
import Piece from "./Piece";
import { PieceType } from "./types/pieces";

const Board: React.FC = () => {
  const board: (PieceType | null)[][] = [
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
  ];

  const renderSquare = (row: number, col: number) => {
    const piece = board[row][col];
    return (
      <div
        key={`${row}-${col}`}
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: (row + col) % 2 === 1 ? "#B58863" : "#F0D9B5",
        }}
      >
        {piece ? <Piece piece={piece} /> : null}
      </div>
    );
  };

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
