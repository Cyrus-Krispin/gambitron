import React from "react";
import { BrowserRouter as Router, Route, Switch } from "react-router-dom";
import Board from "./components/board/Board";
import { Analytics } from "@vercel/analytics/react";

const App: React.FC = () => {
  return (
    <Router>
      <div className="min-h-screen bg-gray-900 text-white">
        <Switch>
          <Route exact path="/" component={Board} />
          <Route exact path="/admin" component={Board} />
        </Switch>
        <Analytics />
      </div>
    </Router>
  );
};

export default App;
