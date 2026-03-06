import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PlayerColor } from "@/hooks/useGame";

interface SidebarProps {
  initialTimeMs: number;
  isPlayersTurn: boolean;
  playerColor: PlayerColor;
  onNewGame: () => void;
  isAdmin?: boolean;
  fenInput?: string;
  onFenInputChange?: (v: string) => void;
  onLoadFen?: () => void;
}

function getTimeControlLabel(minutes: number): string {
  if (minutes <= 1) return "Bullet";
  if (minutes < 10) return "Blitz";
  if (minutes < 30) return "Rapid";
  return "Classical";
}

export function Sidebar({
  initialTimeMs,
  isPlayersTurn,
  playerColor,
  onNewGame,
  isAdmin = false,
  fenInput = "",
  onFenInputChange,
  onLoadFen,
}: SidebarProps) {
  const minutes = Math.floor(initialTimeMs / 60000);
  const label = getTimeControlLabel(minutes);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <a href="https://github.com/Cyrus-Krispin" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="GitHub">
          <img src="/github.svg" alt="" className="w-7 h-7" />
        </a>
        <a href="https://www.linkedin.com/in/cyruskrispin/" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="LinkedIn">
          <img src="/linkedin.svg" alt="" className="w-7 h-7" />
        </a>
        <a href="https://leetcode.com/u/cyrus-krispin/" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="LeetCode">
          <img src="/leetcode.svg" alt="" className="w-7 h-7" />
        </a>
      </div>

      <div className="rounded-md border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">{playerColor === "white" ? "♔" : "♚"}</span>
          <div>
            {!isAdmin && (
              <div className="text-sm font-medium text-foreground">
                {minutes} min · {label}
              </div>
            )}
            <div className="text-xs text-muted-foreground">vs Gambitron · Playing as {playerColor}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isPlayersTurn ? "bg-primary" : "bg-muted-foreground"}`} />
          <span className="text-sm text-muted-foreground">{isPlayersTurn ? "Your turn" : "AI thinking"}</span>
        </div>
      </div>

      <Button onClick={onNewGame} className="w-full" size="lg">
        New Game
      </Button>

      {isAdmin && onFenInputChange && onLoadFen && (
        <div className="rounded-md border border-border bg-card p-4 space-y-3">
          <div className="text-sm font-medium text-foreground">Load FEN Position</div>
          <Input
            value={fenInput}
            onChange={(e) => onFenInputChange(e.target.value)}
            placeholder="Enter FEN..."
            className="h-9"
          />
          <Button onClick={onLoadFen} className="w-full" size="sm">
            Load Position
          </Button>
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="font-medium text-foreground">Examples:</div>
            <button onClick={() => onFenInputChange("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")} className="block w-full text-left hover:text-primary transition-colors">
              Starting position
            </button>
            <button onClick={() => onFenInputChange("r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 4 4")} className="block w-full text-left hover:text-primary transition-colors">
              Mid-game
            </button>
            <button onClick={() => onFenInputChange("8/8/8/8/8/8/4K3/4k3 w - - 0 1")} className="block w-full text-left hover:text-primary transition-colors">
              King vs King
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
