import { Link } from "react-router-dom";

const FACTS = [
  { key: "Engine", val: "Minimax + alpha beta" },
  { key: "Board", val: "React + chess.js" },
  { key: "Server", val: "FastAPI + WebSocket" },
  { key: "Archive", val: "PGN history" },
];

const LINKS = [
  { label: "GitHub", href: "https://github.com/Cyrus-Krispin" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/cyruskrispin/" },
  { label: "LeetCode", href: "https://leetcode.com/u/cyrus-krispin/" },
];

export default function About() {
  return (
    <div className="about fade-in">
      <section className="about-minimal">
        <div>
          <p className="eyebrow">About</p>
          <h2>Gambitron</h2>
        </div>

        <div className="fact-list">
          {FACTS.map((fact) => (
            <div className="fact-row" key={fact.key}>
              <span>{fact.key}</span>
              <strong>{fact.val}</strong>
            </div>
          ))}
        </div>

        <div className="link-row" aria-label="External links">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
              {link.label}
            </a>
          ))}
        </div>

        <Link to="/" className="btn-ghost">
          Play
        </Link>
      </section>
    </div>
  );
}
