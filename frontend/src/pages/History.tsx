import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

interface GameSummary {
  id: string;
  created_at: string;
  time_control_ms: number;
  result: string | null;
  termination: string | null;
  player_color: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTimeControl(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min}+0`;
  return `${min / 60}h`;
}

function resultClass(result: string | null, playerColor: string): string {
  if (!result || result === "*") return "draw";
  const playerWins =
    (result === "1-0" && playerColor === "white") ||
    (result === "0-1" && playerColor === "black");
  const playerLoses =
    (result === "0-1" && playerColor === "white") ||
    (result === "1-0" && playerColor === "black");
  if (playerWins) return "win";
  if (playerLoses) return "loss";
  return "draw";
}

function resultLabel(result: string | null, playerColor: string): string {
  const cls = resultClass(result, playerColor);
  if (cls === "win") return "Won";
  if (cls === "loss") return "Lost";
  return "Draw";
}

export default function History() {
  const [games, setGames] = useState<GameSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiBase = `${import.meta.env.VITE_backend}`;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`${apiBase}/games?has_pgn=true&limit=50&offset=0`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setGames(data.games ?? []);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load games");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [apiBase]);

  return (
    <div className="history fade-in">
      <h2>History</h2>

      {loading && (
        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: 11,
            letterSpacing: "0",
            color: "var(--ink-faint)",
            textTransform: "uppercase",
            padding: "32px 0",
          }}
        >
          Loading…
        </div>
      )}

      {error && (
        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: 12,
            color: "var(--accent)",
            padding: "20px 0",
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && games.length === 0 && (
        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: 12,
            color: "var(--ink-faint)",
            letterSpacing: "0",
            padding: "32px 0",
          }}
        >
          Empty. <Link to="/" style={{ color: "var(--accent)" }}>Play</Link>
        </div>
      )}

      {!loading && !error && games.length > 0 && (
        <div className="history-table">
          {games.map((g, i) => {
            const rc = resultClass(g.result, g.player_color);
            const rl = resultLabel(g.result, g.player_color);
            return (
              <Link
                key={g.id}
                to={`/history/${g.id}`}
                className="history-row"
                style={{ display: "grid" }}
              >
                <span className="idx">№ {String(games.length - i).padStart(2, "0")}</span>
                <div className="opp">
                  Gambitron
                  <span className="as">as {g.player_color}</span>
                </div>
                <span className="when">{formatDate(g.created_at)}</span>
                <span className="mode">{formatTimeControl(g.time_control_ms)}</span>
                <span className={`result-tag ${rc}`}>{rl}</span>
                <span className="chev">›</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
