import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Scene from "./components/scene/Scene";
import Board from "./components/board/Board";

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Scene />} />
        <Route path="/board" element={<Board />} />
      </Routes>
    </Router>
  );
};

export default App;
