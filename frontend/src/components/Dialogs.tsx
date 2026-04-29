import { useEffect, useState } from "react";
import type { PlayerColor } from "@/hooks/useGame";

interface DialogsProps {
  promotionOpen: boolean;
  onPromotionClose: () => void;
  onPromotionPick: (piece: "q" | "r" | "b" | "n") => void;
  playerColor: PlayerColor;
  endgameOpen: boolean;
  endgameResult: string;
  endgameReason: string;
  onEndgameClose: () => void;
  onNewGameFromEndgame: () => void;
  errorOpen: boolean;
  errorMessage: string;
  onErrorClose: () => void;
  onRetry: () => void;
  hasRetry: boolean;
}

const PROMO_PIECES: { piece: "q" | "r" | "b" | "n"; label: string }[] = [
  { piece: "q", label: "Queen" },
  { piece: "r", label: "Rook" },
  { piece: "b", label: "Bishop" },
  { piece: "n", label: "Knight" },
];

export function Dialogs({
  promotionOpen,
  onPromotionClose,
  onPromotionPick,
  playerColor,
  endgameOpen,
  endgameResult,
  endgameReason,
  onEndgameClose,
  onNewGameFromEndgame,
  errorOpen,
  errorMessage,
  onErrorClose,
  onRetry,
  hasRetry,
}: DialogsProps) {
  const [errorExiting, setErrorExiting] = useState(false);

  useEffect(() => {
    if (errorOpen) {
      const t = setTimeout(() => {
        setErrorExiting(true);
        setTimeout(() => { onErrorClose(); setErrorExiting(false); }, 200);
      }, 6000);
      return () => clearTimeout(t);
    }
  }, [errorOpen, onErrorClose]);

  const playerWins =
    (endgameResult === "1-0" && playerColor === "white") ||
    (endgameResult === "0-1" && playerColor === "black");
  const playerLoses =
    (endgameResult === "0-1" && playerColor === "white") ||
    (endgameResult === "1-0" && playerColor === "black");

  const headline = playerWins ? "Victory" : playerLoses ? "Defeat" : "Drawn";

  const reasonText = (() => {
    if (playerWins && endgameReason === "checkmate") return "Checkmate · you outplayed Gambitron";
    if (playerWins && endgameReason === "timeout") return "Gambitron ran out of time";
    if (playerLoses && endgameReason === "checkmate") return "Checkmate · Gambitron got you";
    if (playerLoses && endgameReason === "timeout") return "You ran out of time";
    if (endgameResult === "1/2-1/2") return "The game ends in a draw";
    return endgameReason || "Game over";
  })();

  return (
    <>
      {/* Promotion */}
      {promotionOpen && (
        <div className="modal-overlay" onClick={onPromotionClose}>
          <div className="modal grain" onClick={(e) => e.stopPropagation()} style={{ paddingBottom: 28 }}>
            <h3 style={{ fontSize: 32, marginBottom: 4 }}>Promote</h3>
            <div className="reason">Choose a piece</div>
            <div className="promo-grid">
              {PROMO_PIECES.map(({ piece, label }) => (
                <button
                  key={piece}
                  className="promo-cell"
                  type="button"
                  onClick={() => onPromotionPick(piece)}
                >
                  <img
                    src={`/pieces/${piece}-${playerColor}.svg`}
                    alt={label}
                  />
                  <span className="piece-name">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Endgame result */}
      {endgameOpen && (
        <div className="modal-overlay">
          <div className="modal grain">
            <h3>
              {playerWins ? <em>{headline}.</em> : <span>{headline}.</span>}
            </h3>
            <div className="reason">{reasonText}</div>
            <div className="modal-actions">
              <button type="button" onClick={onEndgameClose}>Exit</button>
              <button type="button" className="primary" onClick={onNewGameFromEndgame}>
                New Game
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error toast */}
      {errorOpen && (
        <div
          className="error-toast"
          style={{ opacity: errorExiting ? 0 : 1, transition: "opacity 300ms" }}
        >
          <span className="toast-msg">{errorMessage}</span>
          {hasRetry && (
            <button type="button" className="toast-btn" onClick={onRetry}>
              Retry
            </button>
          )}
          <button type="button" className="toast-btn" onClick={onErrorClose}>
            Dismiss
          </button>
        </div>
      )}
    </>
  );
}
