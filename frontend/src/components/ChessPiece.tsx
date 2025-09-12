interface ChessPieceProps {
  piece: string;
  color: "white" | "black";
  isSelected?: boolean;
}

const ChessPiece = ({ piece, color, isSelected = false }: ChessPieceProps) => {
  const pieceFileName = `${piece.toLowerCase()}-${color === 'white' ? 'white' : 'black'}.svg`;
  
  return (
    <div className={`flex items-center justify-center select-none ${isSelected ? 'drop-shadow-lg' : ''}`}>
      <img 
        src={`/pieces/${pieceFileName}`} 
        alt={`${color} ${piece}`}
        className={`w-3/4 h-3/4 transition-all duration-200 ${isSelected ? 'brightness-110 scale-105' : ''}`}
      />
    </div>
  )
}

export default ChessPiece;
