interface ChessPieceProps {
  piece: string;
  color: "white" | "black";
}

const ChessPiece = ({ piece, color }: ChessPieceProps) => {
  const pieceFileName = `${piece.toLowerCase()}-${color === 'white' ? 'white' : 'black'}.svg`;
  
  return (
    <div className="flex items-center justify-center select-none">
      <img 
        src={`/pieces/${pieceFileName}`} 
        alt={`${color} ${piece}`}
        className="w-12 h-12"
      />
    </div>
  )
}

export default ChessPiece;
