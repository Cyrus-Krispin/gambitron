import type { Chess } from "chess.js";

export interface GameOutcome {
  result: "*" | "1-0" | "0-1" | "1/2-1/2";
  termination?:
    | "checkmate"
    | "stalemate"
    | "insufficient material"
    | "threefold repetition"
    | "fifty-move rule"
    | "draw";
}

export function getGameOutcome(game: Chess): GameOutcome {
  if (!game.isGameOver()) return { result: "*" };

  if (game.isCheckmate()) {
    return {
      result: game.turn() === "w" ? "0-1" : "1-0",
      termination: "checkmate",
    };
  }
  if (game.isStalemate()) {
    return { result: "1/2-1/2", termination: "stalemate" };
  }
  if (game.isInsufficientMaterial()) {
    return { result: "1/2-1/2", termination: "insufficient material" };
  }
  if (game.isThreefoldRepetition()) {
    return { result: "1/2-1/2", termination: "threefold repetition" };
  }
  if (game.isDrawByFiftyMoves()) {
    return { result: "1/2-1/2", termination: "fifty-move rule" };
  }
  return { result: "1/2-1/2", termination: "draw" };
}
