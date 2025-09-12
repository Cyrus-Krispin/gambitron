import { useEffect, useState } from "react";
import ChessPiece from "./ChessPiece";

interface ChessBoardProps {
  boardState: any[][];
  selectedSquare: string | null;
  validMoves: string[];
  gameEnded: boolean;
  startOpen: boolean;
  onTileClick: (squareName: string) => void;
}

const horizontal = ["a", "b", "c", "d", "e", "f", "g", "h"];
const vertical = ["1", "2", "3", "4", "5", "6", "7", "8"];

const ChessBoard = ({ boardState, selectedSquare, validMoves, gameEnded, startOpen, onTileClick }: ChessBoardProps) => {
  const [boardSize, setBoardSize] = useState<number>(320); // Default size

  useEffect(() => {
    const calculateBoardSize = () => {
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const isMobile = vw < 1024; // lg breakpoint
      
      if (isMobile) {
        // Mobile: Use viewport width with some padding, but ensure minimum size
        const availableWidth = vw - 32; // Account for padding
        const size = Math.max(280, Math.min(availableWidth, 400));
        setBoardSize(size);
      } else {
        // Desktop: Use viewport height, accounting for sidebars and padding
        // Reserve space for sidebars (300px each) and padding (80px total for safety)
        const availableHeight = vh - 80; // Account for padding with buffer
        const availableWidth = vw - 600 - 80; // Account for sidebars and padding with buffer
        const size = Math.min(availableHeight, availableWidth);
        setBoardSize(Math.max(400, Math.min(size, 800))); // Min 400px, max 800px
      }
    };

    calculateBoardSize();
    window.addEventListener('resize', calculateBoardSize);
    return () => window.removeEventListener('resize', calculateBoardSize);
  }, []);

  return (
    <div className="chess-board-container relative">
      <div 
        className={`grid grid-cols-8 border-2 border-gray-600 rounded-lg overflow-hidden shadow-2xl mx-auto ${startOpen ? 'opacity-50 pointer-events-none' : ''}`}
        style={{ 
          width: `${boardSize}px`, 
          height: `${boardSize}px` 
        }}
      >
        {vertical
          .slice()
          .reverse()
          .map((row, y) =>
            horizontal.map((col, x) => {
              const square = boardState[y][x];
              const isLight = (y + x) % 2 === 0;
              const squareColor = isLight ? "bg-white" : "bg-gray-600";
              const squareName = `${col}${row}`;
              const isHighlighted = validMoves.includes(squareName);
              const isSelected = selectedSquare === squareName;
              const pieceColor: "white" | "black" = square?.color === "w" ? "white" : "black";

              return (
                <div
                  key={squareName}
                  className={`
                    ${squareColor}
                    flex items-center justify-center 
                    cursor-pointer 
                    transition-colors duration-150
                    relative
                    ${isSelected ? 'bg-blue-200' : ''}
                    aspect-square
                  `}
                  onClick={() => {
                    if (!gameEnded) {
                      onTileClick(squareName);
                    }
                  }}
                >
                  {/* Move indicator dot for all available moves */}
                  {isHighlighted && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                    </div>
                  )}
                  
                  {square && <ChessPiece piece={square.type} color={pieceColor} isSelected={isSelected} />}
                </div>
              );
            })
          )}
      </div>
      {/* Start Dialog Overlay - blocks all interactions */}
      {startOpen && (
        <div className="absolute inset-0 bg-transparent pointer-events-auto z-10"></div>
      )}
    </div>
  );
};

export default ChessBoard;
