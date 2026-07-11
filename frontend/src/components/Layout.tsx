import { Link, useLocation } from "react-router-dom";

export function Layout(props: { children: React.ReactNode }) {
  const location = useLocation();
  const path = location.pathname;

  const isPlay = path === "/" || path.startsWith("/play");
  const isHistory = path.startsWith("/history");
  const isAbout = path === "/about";

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          Gambitron
        </Link>
        <nav>
          <Link to="/" className={"tab" + (isPlay ? " active" : "")}>Play</Link>
          <Link to="/history" className={"tab" + (isHistory ? " active" : "")}>History</Link>
          <Link to="/about" className={"tab" + (isAbout ? " active" : "")}>About</Link>
        </nav>
      </header>
      <main style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {props.children}
      </main>
    </div>
  );
}
