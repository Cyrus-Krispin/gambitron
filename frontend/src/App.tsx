import React, { useState, useEffect } from "react";
import "./index.css";
import { Chess, Square } from "chess.js";

interface PieceProps {
  piece: string;
  square: string;
}

const Piece: React.FC<PieceProps> = ({ piece }) => {
  const pieceName = piece;
  const colorName = pieceName === pieceName.toUpperCase() ? "white" : "black";
  let pieceType: string;
  switch (pieceName.toLowerCase()) {
    case "p":
      pieceType = "pawn";
      break;
    case "n":
      pieceType = "knight";
      break;
    case "b":
      pieceType = "bishop";
      break;
    case "r":
      pieceType = "rook";
      break;
    case "q":
      pieceType = "queen";
      break;
    case "k":
      pieceType = "king";
      break;
    default:
      pieceType = "unknown";
  }

  const imageName = `${pieceType}-${colorName}.svg`;

  const imageUrl = `/pieces/${imageName}`;

  return (
    <div
      className="piece"
      style={{
        backgroundImage: `url(${imageUrl})`,
      }}
    ></div>
  );
};

interface SquareProps {
  square: string;
  piece: string | null;
  isSelected: boolean;
  isPossibleMove: boolean;
  onSquareClick: (square: string) => void;
}

const SquareComponent: React.FC<SquareProps> = ({
  square,
  piece,
  isSelected,
  isPossibleMove,
  onSquareClick,
}) => {
  const isLight = (parseInt(square[1]) + square.charCodeAt(0)) % 2 === 0;
  const squareColor = isLight ? "light" : "dark";
  const style = {
    backgroundColor: isSelected
      ? "lightblue"
      : isPossibleMove
      ? "lightgreen"
      : undefined,
  };
  return (
    <div
      className={`square ${squareColor}`}
      style={style}
      onClick={() => onSquareClick(square)}
    >
      {piece && <Piece piece={piece} square={square} />}
    </div>
  );
};

function App() {
  const [chess] = useState(() => new Chess());
  const [, setBoard] = useState(chess.board());
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<string[]>([]);

  useEffect(() => {
    setBoard(chess.board());
  }, [chess]);

  const handleSquareClick = (square: string) => {
    if (selectedSquare === square) {
      return;
    }
  
    if (selectedSquare) {
      const move = { from: selectedSquare, to: square, promotion: "q" };
      if (chess.move(move)) {
        setSelectedSquare(null);
        setPossibleMoves([]);
        makeAiMove();
      } else {
        setSelectedSquare(null);
        setPossibleMoves([]);
      }
    } else {
      setSelectedSquare(square as Square);
      const moves = chess.moves({ square: square as Square });
      setPossibleMoves(moves.map((move) => move.slice(-2)));
    }
  };
  

  const makeAiMove = async () => {
    try {
      const fen = chess.fen(); // Get the current FEN string from the chess instance
      const apiUrl = `${
        import.meta.env.VITE_backend
      }?value=${encodeURIComponent(fen)}`;

      const response = await fetch(apiUrl, {
        // Use the constructed URL
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log(data);
        const updatedFen = data.updated_fen; // Assuming the updated FEN string is in the first element of the returned array
        const moveResult = data.result; // Assuming the result (like 1-0, 0-1, or 1/2-1/2) is in the second element

        chess.load(updatedFen); // Update the chess instance with the new FEN string
        setBoard(chess.board()); // Update the board state in the UI

        console.log("Move result:", moveResult); // Optional: log the game result
      } else {
        console.error("Failed to fetch best move:", response.statusText);
      }
    } catch (error) {
      console.error("Error during AI move:", error);
    }
  };

  const renderBoard = () => {
    const boardRows = [];
    for (let row = 7; row >= 0; row--) {
      const rowSquares = [];
      for (let col = 0; col < 8; col++) {
        const square = String.fromCharCode(97 + col) + (row + 1);
        const piece = chess.get(square as Square)?.type
          ? chess.get(square as Square)?.color === "w"
            ? chess.get(square as Square)?.type.toUpperCase()
            : chess.get(square as Square)?.type.toLowerCase()
          : null;
        const isSelected = selectedSquare === square;
        const isPossibleMove = possibleMoves.includes(square);
        rowSquares.push(
          <SquareComponent
            key={square}
            square={square}
            piece={piece || null}
            isSelected={isSelected}
            isPossibleMove={isPossibleMove}
            onSquareClick={handleSquareClick}
          />
        );
      }
      boardRows.push(
        <div key={row} className="board-row">
          {rowSquares}
        </div>
      );
    }
    return boardRows;
  };

  return (
    <div className="board-container">
      <div className="board">{renderBoard()}</div>
    </div>
  );
}

export default App;
