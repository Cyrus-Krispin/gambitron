import { Link } from "react-router-dom";

const FLOW = [
  {
    num: "01",
    title: "Start a session",
    body: "React starts a browser-local game session with the selected time control and side. A local socket shim preserves the real-time flow without a backend service.",
  },
  {
    num: "02",
    title: "Play a move",
    body: "The board uses chess.js for move rules and instant feedback. When you move, the local runtime records the FEN, SAN, and square data in memory.",
  },
  {
    num: "03",
    title: "Let the engine think",
    body: "The browser updates clock state, then runs the minimax search against a tiny WebAssembly-backed evaluation core.",
  },
  {
    num: "04",
    title: "Reply and remember",
    body: "The AI move returns through the local socket API with clock updates. Completed games are saved to Supabase and cached locally for History and Replay.",
  },
];

const STEPS = [
  {
    num: "01",
    title: "Choose a tempo",
    body: "Eight time controls span Bullet (1+0) through Classical (30+0). The format m+i means m minutes per side with i seconds added back after each move. Pick what suits the night.",
  },
  {
    num: "02",
    title: "Pick a side",
    body: "White, black, or random. The board orients to your colour automatically — your pieces always sit at the bottom. The engine takes whatever you leave behind.",
  },
  {
    num: "03",
    title: "Move a piece",
    body: "Tap a piece to lift it. Legal squares appear as small dots; squares with an enemy piece show a ring. Tap a target square to commit. Tap your piece again to deselect.",
  },
  {
    num: "04",
    title: "Read the board",
    body: "The square a piece left is shaded ochre; the square it landed on is shaded brighter. File and rank coordinates sit on the outer edge in italic.",
  },
  {
    num: "05",
    title: "Watch the clocks",
    body: "The active player's clock is filled in. Below 30 seconds it shows tenths. Increments are added the instant a move is played, on time controls that have them.",
  },
  {
    num: "06",
    title: "Track captures",
    body: "Pieces you've captured cluster next to your name. A small +N shows your material edge in points (Q=9, R=5, B/N=3, P=1).",
  },
  {
    num: "07",
    title: "Minimax engine",
    body: "Gambitron uses a browser-local minimax search with alpha-beta pruning and a WebAssembly material evaluator. No server is needed to play.",
  },
  {
    num: "08",
    title: "Replay past games",
    body: "The History tab lists finished games. Open one to step through it move-by-move with the on-screen controls or the keyboard: ← → to step, Home/End to jump.",
  },
];

const CREDITS = [
  { key: "Engine", val: "Minimax · αβ pruning · piece-square tables" },
  { key: "Runtime", val: "WebAssembly · local socket shim" },
  { key: "Storage", val: "Supabase · local fallback" },
  { key: "Frontend", val: "React · TypeScript · Vite" },
  { key: "Type", val: "DM Serif Display · Inter · JetBrains Mono" },
];

export default function About() {
  return (
    <div className="about fade-in">
      <section className="about-hero">
        <div className="about-hero-text">
          <div className="section-label">About</div>
          <h2>
            A homemade chess engine,<br />
            and a board to <em>face it on.</em>
          </h2>
          <p className="about-lede">
            Gambitron is a chess engine built from scratch using minimax with alpha-beta pruning,
            wrapped in a browser-local WebAssembly runtime. Pick a tempo, pick a colour, and try to beat it.
            No accounts, no ladders — just you, the engine, and the clock.
          </p>
        </div>

        <aside className="profile-card grain">
          <div className="profile-avatar">
            <span>C</span>
          </div>
          <div className="profile-name">Cyrus Krispin</div>
          <div className="profile-role">Engineer · Builder · Patzer</div>
          <p className="profile-bio">
            Built Gambitron — the engine and the board around it. Finds endgames meditative.
          </p>
          <ul className="profile-links">
            <li>
              <a href="https://github.com/Cyrus-Krispin" target="_blank" rel="noreferrer">
                <span className="lk-key">Github</span>
                <span className="lk-val">Cyrus-Krispin ↗</span>
              </a>
            </li>
            <li>
              <a href="https://www.linkedin.com/in/cyruskrispin/" target="_blank" rel="noreferrer">
                <span className="lk-key">LinkedIn</span>
                <span className="lk-val">cyruskrispin ↗</span>
              </a>
            </li>
            <li>
              <a href="https://leetcode.com/u/cyrus-krispin/" target="_blank" rel="noreferrer">
                <span className="lk-key">LeetCode</span>
                <span className="lk-val">cyrus-krispin ↗</span>
              </a>
            </li>
          </ul>
        </aside>
      </section>

      <section className="about-block">
        <div className="section-label">Architecture</div>
        <div className="architecture-copy">
          <h3>A small real-time system around a chess engine.</h3>
          <p>
            Gambitron keeps the board, clock, and engine in the browser. The
            client handles interaction and legal-move hints while a local socket-compatible
            runtime owns game sessions and AI turns. Supabase stores completed games for
            History and Replay.
          </p>
        </div>

        <figure className="architecture-figure">
          <img
            src="/gambitron-architecture.svg"
            alt="Gambitron architecture diagram"
          />
          <figcaption>
            <span>Editable Draw.io source</span>
            <a href="/gambitron-architecture.drawio" download>
              Download .drawio
            </a>
          </figcaption>
        </figure>

        <div className="flow-grid" aria-label="Application flow">
          {FLOW.map((s) => (
            <article key={s.num} className="flow-step">
              <div className="step-num">{s.num}</div>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="about-block">
        <div className="section-label">How to play</div>
        <div className="about-steps">
          {STEPS.map((s) => (
            <article key={s.num} className="step">
              <div className="step-num">{s.num}</div>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="about-block">
        <div className="section-label">Credits &amp; tech</div>
        <ul className="credits">
          {CREDITS.map((c) => (
            <li key={c.key}>
              <span className="cr-key">{c.key}</span>
              <span className="cr-val">{c.val}</span>
            </li>
          ))}
        </ul>
      </section>

      <footer className="about-foot">
        <span>© 2026 Gambitron</span>
        <Link to="/" style={{ color: "var(--ink-faint)" }}>Play →</Link>
      </footer>
    </div>
  );
}
