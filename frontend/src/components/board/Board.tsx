import { useState } from "react";
import { Chess, Square } from "chess.js";
import Tile from "../tile/tile";
import "./Board.css";

const horizontal = ["a", "b", "c", "d", "e", "f", "g", "h"];
const vertical = ["1", "2", "3", "4", "5", "6", "7", "8"];

const chess = new Chess();

export default function Board() {
  const [boardState, setBoardState] = useState(chess.board());
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [validMoves, setValidMoves] = useState<string[]>([]);

  const handleTileClick = async (square: string) => {
    if (selectedSquare) {
      if (selectedSquare === square) {
        setSelectedSquare(null);
        setValidMoves([]);
        return;
      }

      const selectedPiece = chess.get(selectedSquare as Square);
      const newPiece = chess.get(square as Square);
      if (newPiece && newPiece.color === selectedPiece?.color) {
        setSelectedSquare(square);
        const moves = chess
          .moves({ square: square as Square, verbose: true })
          .map((m) => m.to);
        setValidMoves(moves);
        return;
      }

      if (!validMoves.includes(square)) {
        setSelectedSquare(null);
        setValidMoves([]);
        return;
      }

      let promotion = "q";

      if (
        selectedPiece?.type === "p" &&
        (square[1] === "1" || square[1] === "8")
      ) {
        promotion = prompt("Promote to (q, r, b, n):", "q") || "q";
        if (!["q", "r", "b", "n"].includes(promotion)) {
          promotion = "q";
        }
      }

      const move = chess.move({
        from: selectedSquare as Square,
        to: square as Square,
        promotion: promotion,
      });

      if (move) {
        setBoardState(chess.board());
        setSelectedSquare(null);
        setValidMoves([]);

        const apiUrl = `${
          import.meta.env.VITE_backend
        }?value=${encodeURIComponent(chess.fen())}`;

        if (chess.isGameOver()) {
          alert("YOU WIN!");
          return;
        }

        try {
          const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (response.ok) {
            const data = await response.json();
            console.log(data);
            if (data.updated_fen) {
              chess.load(data.updated_fen);
              setBoardState(chess.board());
            }
            if (chess.isGameOver()) {
              alert("YOU LOSE!");
            }
          }
        } catch (error) {
          console.error("Error communicating with backend:", error);
        }
      } else {
        setSelectedSquare(null);
        setValidMoves([]);
      }
    } else {
      setSelectedSquare(square);
      const moves = chess
        .moves({ square: square as Square, verbose: true })
        .map((m) => m.to);
      setValidMoves(moves);
    }
  };

  return (
    <>
      <div className="board-container">
        <div className="chess-board">
          {vertical
            .slice()
            .reverse()
            .map((row, y) =>
              horizontal.map((col, x) => {
                const square = boardState[y][x];
                const tileColor = (x + y) % 2 === 0 ? "white" : "black";
                const squareName = `${col}${row}`;
                const isHighlighted = validMoves.includes(squareName);

                return (
                  <Tile
                    key={squareName}
                    tileColor={tileColor}
                    piece={
                      square?.type ? `${square.color}${square.type}` : undefined
                    }
                    onClick={() => handleTileClick(squareName)}
                    isHighlighted={isHighlighted}
                  />
                );
              })
            )}
        </div>
      </div>
    </>
  );
}
