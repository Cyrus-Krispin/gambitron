import { useEffect, useState } from "react";
import type { PlayerColor } from "@/hooks/useGame";

interface DialogsProps {
  promotionOpen: boolean;
  onPromotionClose: () => void;
  onPromotionPick: (piece: "q" | "r" | "b" | "n") => void;
  playerColor: PlayerColor;
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

  return (
    <>
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
