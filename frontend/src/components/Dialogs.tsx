import * as Dialog from "@radix-ui/react-dialog";
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
  return (
    <>
      <Dialog.Root open={promotionOpen} onOpenChange={(open) => !open && onPromotionClose()}>
        <Dialog.Portal>
          <Dialog.Overlay className="modal-overlay" />
          <Dialog.Content className="modal grain" style={{ paddingBottom: 28 }}>
            <Dialog.Title style={{ fontSize: 32, marginBottom: 4 }}>Promote</Dialog.Title>
            <Dialog.Description className="reason">Choose a piece</Dialog.Description>
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
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {errorOpen && (
        <div
          className="error-toast"
          role="alert"
          aria-live="assertive"
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
