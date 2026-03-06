import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

const PROMO_PIECES_WHITE: { piece: "q" | "r" | "b" | "n"; label: string; src: string }[] = [
  { piece: "q", label: "Queen", src: "/pieces/q-white.svg" },
  { piece: "r", label: "Rook", src: "/pieces/r-white.svg" },
  { piece: "b", label: "Bishop", src: "/pieces/b-white.svg" },
  { piece: "n", label: "Knight", src: "/pieces/n-white.svg" },
];

const PROMO_PIECES_BLACK: { piece: "q" | "r" | "b" | "n"; label: string; src: string }[] = [
  { piece: "q", label: "Queen", src: "/pieces/q-black.svg" },
  { piece: "r", label: "Rook", src: "/pieces/r-black.svg" },
  { piece: "b", label: "Bishop", src: "/pieces/b-black.svg" },
  { piece: "n", label: "Knight", src: "/pieces/n-black.svg" },
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
        setTimeout(() => {
          onErrorClose();
          setErrorExiting(false);
        }, 200);
      }, 6000);
      return () => clearTimeout(t);
    }
  }, [errorOpen, onErrorClose]);

  const playerWins = (endgameResult === "1-0" && playerColor === "white") || (endgameResult === "0-1" && playerColor === "black");
  const playerLoses = (endgameResult === "0-1" && playerColor === "white") || (endgameResult === "1-0" && playerColor === "black");

  const endgameMessage = () => {
    if (playerWins && endgameReason === "checkmate") return "Checkmate! You outplayed Gambitron.";
    if (playerWins && endgameReason === "timeout") return "Gambitron ran out of time.";
    if (playerLoses && endgameReason === "checkmate") return "Checkmate! Gambitron got you.";
    if (playerLoses && endgameReason === "timeout") return "You ran out of time.";
    if (endgameResult === "1/2-1/2") return "The game ends in a draw.";
    return "";
  };

  const promoPieces = playerColor === "white" ? PROMO_PIECES_WHITE : PROMO_PIECES_BLACK;

  return (
    <>
      {/* Promotion */}
      <Dialog open={promotionOpen} onOpenChange={(open) => !open && onPromotionClose()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Choose promotion</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-4 gap-2">
            {promoPieces.map(({ piece, label, src }) => (
              <Button
                key={piece}
                variant="outline"
                className="flex flex-col h-auto gap-2 py-3"
                onClick={() => onPromotionPick(piece)}
              >
                <img src={src} alt={label} className="w-10 h-10" />
                <span className="text-xs">{label}</span>
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={onPromotionClose}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Endgame */}
      <Dialog open={endgameOpen} onOpenChange={(open) => !open && onEndgameClose()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">
              {playerWins ? "You Win" : playerLoses ? "You Lose" : "Draw"}
            </DialogTitle>
            <DialogDescription className="text-center">{endgameMessage()}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <Button onClick={onNewGameFromEndgame}>New Game</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Error */}
      {errorOpen && (
        <div
          className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md z-50 transition-opacity duration-300 ${
            errorExiting ? "opacity-0" : "opacity-100"
          }`}
        >
          <Alert variant="destructive" className="flex items-center justify-between gap-4">
            <AlertDescription className="flex-1">{errorMessage}</AlertDescription>
            <div className="flex gap-2 flex-shrink-0">
              {hasRetry && (
                <Button variant="outline" size="sm" onClick={onRetry} className="border-destructive/50 text-destructive-foreground">
                  Retry
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={onErrorClose}>
                Dismiss
              </Button>
            </div>
          </Alert>
        </div>
      )}
    </>
  );
}
