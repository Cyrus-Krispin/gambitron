import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, History as HistoryIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GameSummary {
  id: string;
  created_at: string;
  ended_at: string | null;
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
    year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTimeControl(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  return `${min / 60} h`;
}

function formatResult(result: string | null): string {
  if (!result || result === "*") return "—";
  if (result === "1-0") return "1–0";
  if (result === "0-1") return "0–1";
  return result;
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
        if (!cancelled) {
          setGames(data.games ?? []);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load games");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:py-8">
        <div className="mb-6 flex items-center gap-2">
          <HistoryIcon className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Game History</h1>
        </div>
        <p className="mb-6 text-sm text-muted-foreground">
          Replay your past games. Click a game to step through the moves.
        </p>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!loading && !error && games.length === 0 && (
          <div className="rounded-lg border border-border/60 bg-muted/30 px-6 py-12 text-center text-muted-foreground">
            <p className="font-medium">No games yet</p>
            <p className="mt-1 text-sm">Finished games with PGN will appear here.</p>
            <Button variant="outline" size="sm" className="mt-4" asChild>
              <Link to="/">Play a game</Link>
            </Button>
          </div>
        )}

        {!loading && !error && games.length > 0 && (
          <ul className="space-y-2">
            {games.map((g) => (
              <li key={g.id}>
                <Link
                  to={`/history/${g.id}`}
                  className="flex items-center gap-4 rounded-lg border border-border/60 bg-card/60 px-4 py-3 transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium text-foreground">
                        {formatTimeControl(g.time_control_ms)}
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">
                        {formatResult(g.result)}
                      </span>
                      {g.termination && (
                        <>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-muted-foreground capitalize">
                            {g.termination}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {formatDate(g.created_at)}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}

        {!loading && !error && games.length > 0 && (
          <div className="mt-6 pt-4 border-t border-border/50">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/">← Back to home</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
