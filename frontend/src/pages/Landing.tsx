import { useState } from "react";
import { useHistory } from "react-router-dom";

const TIME_MODES = [
  { id: "1+0",   cat: "Bullet",    val: "1+0",   minutes: 1,  increment: 0,  sub: "1 min" },
  { id: "2+1",   cat: "Bullet",    val: "2+1",   minutes: 2,  increment: 1,  sub: "2 min · +1s" },
  { id: "3+0",   cat: "Blitz",     val: "3+0",   minutes: 3,  increment: 0,  sub: "3 min" },
  { id: "3+2",   cat: "Blitz",     val: "3+2",   minutes: 3,  increment: 2,  sub: "3 min · +2s" },
  { id: "5+0",   cat: "Blitz",     val: "5+0",   minutes: 5,  increment: 0,  sub: "5 min" },
  { id: "10+0",  cat: "Rapid",     val: "10+0",  minutes: 10, increment: 0,  sub: "10 min" },
  { id: "15+10", cat: "Rapid",     val: "15+10", minutes: 15, increment: 10, sub: "15 min · +10s" },
  { id: "30+0",  cat: "Classical", val: "30+0",  minutes: 30, increment: 0,  sub: "30 min" },
];

export default function Landing() {
  const [timeId, setTimeId] = useState("5+0");
  const [side, setSide] = useState<"w" | "rand" | "b">("w");
  const history = useHistory();

  function start() {
    const mode = TIME_MODES.find((m) => m.id === timeId)!;
    let color: "white" | "black";
    if (side === "rand") {
      color = Math.random() < 0.5 ? "white" : "black";
    } else {
      color = side === "w" ? "white" : "black";
    }
    history.push(`/play/new?minutes=${mode.minutes}&increment=${mode.increment}&color=${color}`);
  }

  return (
    <div className="lobby fade-in">
      <div className="lobby-hero">
        <h1>My engine.<br /><em>Your move.</em></h1>
        <p className="lede">
          Pick a tempo, choose a colour, then sit across the board from Gambitron —
          a stubborn, slightly distracted opponent who plays at their own pace.
        </p>
      </div>

      <div className="lobby-grid">
        <div>
          <div className="section-label">Time control</div>
          <div className="time-grid">
            {TIME_MODES.map((m) => (
              <button
                key={m.id}
                className={"time-cell" + (timeId === m.id ? " active" : "")}
                onClick={() => setTimeId(m.id)}
                type="button"
              >
                <span className="cat">{m.cat}</span>
                <span className="val">{m.val}</span>
                <span className="sub">{m.sub}</span>
              </button>
            ))}
          </div>

          <div style={{ marginTop: 36 }}>
            <div className="section-label">Play as</div>
            <div className="side-row">
              <button
                className={"side-cell" + (side === "w" ? " active" : "")}
                onClick={() => setSide("w")}
                type="button"
              >
                <div className="swatch white">♔</div>
                <span className="label">White</span>
              </button>
              <button
                className={"side-cell" + (side === "rand" ? " active" : "")}
                onClick={() => setSide("rand")}
                type="button"
              >
                <div className="swatch random">?</div>
                <span className="label">Random</span>
              </button>
              <button
                className={"side-cell" + (side === "b" ? " active" : "")}
                onClick={() => setSide("b")}
                type="button"
              >
                <div className="swatch black">♚</div>
                <span className="label">Black</span>
              </button>
            </div>
          </div>

          <div className="cta-row">
            <button className="btn-primary" onClick={start} type="button">
              Begin Game <span className="arrow">→</span>
            </button>
          </div>
        </div>

        <aside className="opponent grain">
          <svg className="opp-portrait" viewBox="0 0 45 45" fill="currentColor">
            <path d="M22.5 11.63V6M20 8h5" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5" />
            <path d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-3.5-7.5-13-10.5-16-4-3 6 5 10 5 10V37z" />
          </svg>
          <div className="section-label" style={{ margin: 0 }}>Opponent</div>
          <div className="opp-name">Gambitron</div>
          <div className="opp-rating">Rating · 1420 · House Bot</div>
          <p className="opp-bio">
            Plays an unfussy game. Knows what to do with a knight, gets bored in long endgames,
            and will trade pieces if you let them.
          </p>
        </aside>
      </div>
    </div>
  );
}
