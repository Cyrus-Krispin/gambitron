import { BrowserRouter as Router, Route, Switch, Redirect } from "react-router-dom";
import { Layout } from "./components/Layout";
import Landing from "./pages/Landing";
import Play from "./pages/Play";
import About from "./pages/About";
import Game from "./pages/Game";
import History from "./pages/History";
import Replay from "./pages/Replay";
import { Analytics } from "@vercel/analytics/react";
import NotFound from "./pages/NotFound";
import { ErrorBoundary } from "./components/ErrorBoundary";

export default function App() {
  return (
    <Router>
      <ErrorBoundary>
        <Layout>
          <Switch>
            <Route exact path="/" component={Landing} />
            <Route exact path="/play" render={() => <Redirect to="/" />} />
            <Route exact path="/play/:gameId" component={Play} />
            <Route exact path="/about" component={About} />
            <Route exact path="/history" component={History} />
            <Route exact path="/history/:gameId" component={Replay} />
            <Route exact path="/admin" component={Game} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </ErrorBoundary>
      <Analytics />
    </Router>
  );
}
