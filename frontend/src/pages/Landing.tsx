import { useState } from "react";
import { useHistory } from "react-router-dom";
import { Minus, Play, Plus, Shuffle } from "lucide-react";

const TIME_MODES = [
  { id: "1+0", minutes: 1, increment: 0 },
  { id: "2+1", minutes: 2, increment: 1 },
  { id: "3+0", minutes: 3, increment: 0 },
  { id: "3+2", minutes: 3, increment: 2 },
  { id: "5+0", minutes: 5, increment: 0 },
  { id: "10+0", minutes: 10, increment: 0 },
  { id: "15+10", minutes: 15, increment: 10 },
  { id: "30+0", minutes: 30, increment: 0 },
];

export default function Landing() {
  const [timeId, setTimeId] = useState("5+0");
  const [side, setSide] = useState<"w" | "rand" | "b">("rand");
  const history = useHistory();
  const selectedIndex = TIME_MODES.findIndex((m) => m.id === timeId);
  const selectedMode = TIME_MODES[selectedIndex] ?? TIME_MODES[4];

  function start() {
    const color =
      side === "rand"
        ? Math.random() < 0.5 ? "white" : "black"
        : side === "w" ? "white" : "black";

    history.push(
      `/play/new?minutes=${selectedMode.minutes}&increment=${selectedMode.increment}&color=${color}`
    );
  }

  function shiftTime(direction: -1 | 1) {
    const next = Math.max(0, Math.min(TIME_MODES.length - 1, selectedIndex + direction));
    setTimeId(TIME_MODES[next].id);
  }

  return (
    <div className="lobby fade-in">
      <section className="lobby-panel" aria-label="Start game">
        <div className="time-stepper" aria-label="Time control">
          <button
            className="icon-button"
            onClick={() => shiftTime(-1)}
            type="button"
            aria-label="Shorter game"
            disabled={selectedIndex <= 0}
          >
            <Minus size={22} />
          </button>

          <div className="time-display">
            <span className="time-number">{selectedMode.minutes}</span>
            <span className="time-unit">min</span>
            {selectedMode.increment > 0 && (
              <span className="time-increment">+{selectedMode.increment}</span>
            )}
          </div>

          <button
            className="icon-button"
            onClick={() => shiftTime(1)}
            type="button"
            aria-label="Longer game"
            disabled={selectedIndex >= TIME_MODES.length - 1}
          >
            <Plus size={22} />
          </button>
        </div>

        <div className="side-row" aria-label="Choose side">
          <button
            className={"side-cell" + (side === "w" ? " active" : "")}
            onClick={() => setSide("w")}
            type="button"
          >
            <span className="side-piece">♙</span>
            <span>White</span>
          </button>
          <button
            className={"side-cell" + (side === "rand" ? " active" : "")}
            onClick={() => setSide("rand")}
            type="button"
          >
            <Shuffle size={18} />
            <span>Random</span>
          </button>
          <button
            className={"side-cell" + (side === "b" ? " active" : "")}
            onClick={() => setSide("b")}
            type="button"
          >
            <span className="side-piece">♟</span>
            <span>Black</span>
          </button>
        </div>

        <button className="btn-primary" onClick={start} type="button">
          <Play size={22} fill="currentColor" />
          <span>Play</span>
        </button>
      </section>
    </div>
  );
}
