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
  return (
    <div className="chess-board-container relative">
      <div className={`grid grid-cols-8 border-2 border-gray-600 rounded-lg overflow-hidden shadow-2xl w-full max-w-sm lg:max-w-3xl mx-auto aspect-square ${startOpen ? 'opacity-50 pointer-events-none' : ''}`}>
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
