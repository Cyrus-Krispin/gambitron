import { Chess, type Move } from "chess.js";

const MAX_BOOK_PLIES = 8;

// Repeated main lines provide simple weighting while keeping the deployed book
// small and deterministic in scope. Search takes over after four full moves.
const OPENING_LINES = [
  ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5", "a7a6", "b5a4", "g8f6"],
  ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5", "g8f6", "e1g1", "f8e7"],
  ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "g8f6", "d2d3", "f8c5"],
  ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "f8c5", "c2c3", "g8f6"],
  ["e2e4", "c7c5", "g1f3", "d7d6", "d2d4", "c5d4", "f3d4", "g8f6"],
  ["e2e4", "c7c5", "g1f3", "b8c6", "d2d4", "c5d4", "f3d4", "g8f6"],
  ["e2e4", "c7c5", "g1f3", "e7e6", "d2d4", "c5d4", "f3d4", "b8c6"],
  ["e2e4", "e7e6", "d2d4", "d7d5", "b1c3", "g8f6", "e4e5", "f6d7"],
  ["e2e4", "c7c6", "d2d4", "d7d5", "b1c3", "d5e4", "c3e4", "c8f5"],
  ["e2e4", "d7d6", "d2d4", "g8f6", "b1c3", "g7g6", "f2f4", "f8g7"],
  ["d2d4", "d7d5", "c2c4", "e7e6", "b1c3", "g8f6", "c1g5", "f8e7"],
  ["d2d4", "d7d5", "c2c4", "c7c6", "g1f3", "g8f6", "b1c3", "d5c4"],
  ["d2d4", "g8f6", "c2c4", "e7e6", "b1c3", "f8b4", "e2e3", "e8g8"],
  ["d2d4", "g8f6", "c2c4", "g7g6", "b1c3", "f8g7", "e2e4", "d7d6"],
  ["c2c4", "e7e5", "b1c3", "g8f6", "g2g3", "d7d5", "c4d5", "f6d5"],
  ["c2c4", "c7c5", "g1f3", "g8f6", "b1c3", "b8c6", "g2g3", "g7g6"],
  ["g1f3", "d7d5", "d2d4", "g8f6", "c2c4", "e7e6", "b1c3", "f8e7"],
] as const;

type Book = Map<string, Map<string, number>>;

function positionKey(game: Chess): string {
  return game.fen().split(" ").slice(0, 4).join(" ");
}

function buildBook(): Book {
  const book: Book = new Map();
  for (const line of OPENING_LINES) {
    const game = new Chess();
    for (const uci of line) {
      const key = positionKey(game);
      const moves = book.get(key) ?? new Map<string, number>();
      moves.set(uci, (moves.get(uci) ?? 0) + 1);
      book.set(key, moves);
      game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.slice(4) || undefined });
    }
  }
  return book;
}

const BOOK = buildBook();

export function getOpeningBookMove(game: Chess, random = Math.random): Move | undefined {
  const [, turn, , , , fullmoveText] = game.fen().split(" ");
  const ply = (Number(fullmoveText) - 1) * 2 + (turn === "b" ? 1 : 0);
  if (ply >= MAX_BOOK_PLIES) return undefined;

  const entries = BOOK.get(positionKey(game));
  if (!entries) return undefined;

  const legalMoves = game.moves({ verbose: true }) as Move[];
  const candidates = legalMoves.flatMap((move) => {
    const uci = `${move.from}${move.to}${move.promotion ?? ""}`;
    const weight = entries.get(uci);
    return weight ? [{ move, weight }] : [];
  });
  const totalWeight = candidates.reduce((total, candidate) => total + candidate.weight, 0);
  let selection = random() * totalWeight;
  for (const candidate of candidates) {
    selection -= candidate.weight;
    if (selection < 0) return candidate.move;
  }
  return candidates[candidates.length - 1]?.move;
}
