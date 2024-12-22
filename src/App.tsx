import React from 'react';
import Board from './components/Board';

const App: React.FC = () => {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        height: '100vh',
        backgroundColor: '#161512'
      }}
    >
      <Board />
    </div>
  );
};

export default App;
