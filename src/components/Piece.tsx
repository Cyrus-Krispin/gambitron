import React from "react";
import { PieceType } from "./types/pieces";

interface ChessPieceProps {
  piece: PieceType;
}

const Piece: React.FC<ChessPieceProps> = ({ piece }) => {
  const { type, color } = piece;

  const imageName = `${type}-${color}.svg`;
  
  return (
    <img
      src={`src/assets/pieces/${imageName}`}
      alt={`${type}-${color}`}
      style={{ width: "100%", height: "100%" }}
    />
  );
};

export default Piece;
