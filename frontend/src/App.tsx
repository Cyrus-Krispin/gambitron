import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Board from "./components/board/Board";
import { Analytics } from "@vercel/analytics/react";

const App: React.FC = () => {
  return (
    <Router>
      <div className="min-h-screen bg-gray-900 text-white">
        <Routes>
          <Route path="/" element={<Board />} />
          <Route path="/admin" element={<Board />} />
        </Routes>
        <Analytics />
      </div>
    </Router>
  );
};

export default App;
