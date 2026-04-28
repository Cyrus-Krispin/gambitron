import { Link } from "react-router-dom";

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
    body: "Gambit uses a minimax search with alpha-beta pruning, piece-square tables, and a quiescence search for tactical sharpness. It runs on a FastAPI server via WebSocket.",
  },
  {
    num: "08",
    title: "Replay past games",
    body: "The History tab lists finished games. Open one to step through it move-by-move with the on-screen controls or the keyboard: ← → to step, Home/End to jump.",
  },
];

const CREDITS = [
  { key: "Engine", val: "Minimax · αβ pruning · piece-square tables" },
  { key: "Transport", val: "WebSocket · FastAPI · EC2" },
  { key: "Database", val: "PostgreSQL · game history · PGN" },
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
            wrapped in a real-time WebSocket server. Pick a tempo, pick a colour, and try to beat it.
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
        <div className="section-label">How it works</div>
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
