import { BrowserRouter as Router, Route, Switch, Redirect } from "react-router-dom";
import { Layout } from "./components/Layout";
import Landing from "./pages/Landing";
import Play from "./pages/Play";
import About from "./pages/About";
import Game from "./pages/Game";
import { Analytics } from "@vercel/analytics/react";

export default function App() {
  return (
    <Router>
      <Layout>
        <Switch>
          <Route exact path="/" component={Landing} />
          <Route exact path="/play" render={() => <Redirect to="/" />} />
          <Route exact path="/play/:gameId" component={Play} />
          <Route
            exact
            path="/play/:minutes"
            render={({ match }) => <Redirect to={`/play/new?minutes=${match.params.minutes}`} />}
          />
          <Route exact path="/about" component={About} />
          <Route exact path="/admin" component={Game} />
        </Switch>
      </Layout>
      <Analytics />
    </Router>
  );
}
