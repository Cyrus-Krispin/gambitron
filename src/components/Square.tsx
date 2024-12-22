import React from 'react';

interface SquareProps {
  color: string;
  children?: React.ReactNode;
}

const Square: React.FC<SquareProps> = ({ color, children }) => {
  return (
    <div
      style={{
        width: '60px',
        height: '60px',
        backgroundColor: color,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {children}
    </div>
  );
};

export default Square;
