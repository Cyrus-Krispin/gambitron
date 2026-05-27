"""Opening book — FEN-indexed weighted move selection from real games.

For the first 4 moves (8 plies), the engine looks up the current FEN
and randomly picks a move weighted by how often it appears across all games
in the pool.  If no match, falls back to engine search.

Build the game pool:
    python -c "from opening_book import build_book_from_pgn; build_book_from_pgn('games.pgn')"
"""
from __future__ import annotations

import json
import random
from pathlib import Path

import chess

_BOOK_PATH = Path(__file__).resolve().parent / "data" / "opening_book.json"

MAX_BOOK_PLIES = 8


class OpeningBook:

    def __init__(self):
        # fen -> {uci: count}
        self._book: dict[str, dict[str, int]] = {}

    # ---- query ----

    def get_move(self, board: chess.Board) -> chess.Move | None:
        if board.fullmove_number > 4:
            return None
        fen = board.fen()
        entries = self._book.get(fen)
        if not entries:
            return None
        legal_uci = {m.uci() for m in board.legal_moves}
        candidates = [(u, w) for u, w in entries.items() if u in legal_uci]
        if not candidates:
            return None
        total = sum(w for _, w in candidates)
        pick = random.randint(1, total)
        accum = 0
        for uci, weight in candidates:
            accum += weight
            if pick <= accum:
                return chess.Move.from_uci(uci)
        return chess.Move.from_uci(candidates[-1][0])

    # ---- load / save ----

    def load(self, path: str | Path | None = None) -> int:
        path = Path(path) if path else _BOOK_PATH
        if not path.exists():
            return 0
        raw = json.loads(path.read_text())
        if isinstance(raw, dict):
            self._book = raw
            return len(raw)
        return 0

    def save(self, path: str | Path | None = None) -> None:
        path = Path(path) if path else _BOOK_PATH
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(self._book, separators=(",", ":")))

    def __len__(self) -> int:
        return len(self._book)


# ---- convenience API ----

_default: OpeningBook | None = None


def get_book() -> OpeningBook:
    global _default
    if _default is not None:
        return _default
    book = OpeningBook()
    count = book.load()
    if count:
        print(f"[opening_book] Loaded {count} positions from pool")
    else:
        print("[opening_book] No pool found — run build_book_from_pgn() first")
    _default = book
    return book


def try_book_move(board: chess.Board) -> chess.Move | None:
    if board.fullmove_number > 4:
        return None
    return get_book().get_move(board)


def reset_book() -> None:
    """No-op: FEN-indexed book has no mutable state per game."""
    get_book()


# ---- PGN builder ----

def build_book_from_pgn(
    pgn_path: str | Path,
    output_path: str | Path | None = None,
    rating_min: int = 2000,
    decisive_only: bool = True,
    max_games: int = 5000,
    max_plies: int = MAX_BOOK_PLIES,
):
    """Scan a PGN file and build a FEN-indexed opening book JSON."""
    import chess.pgn

    output_path = Path(output_path) if output_path else _BOOK_PATH
    book: dict[str, dict[str, int]] = {}
    total = qualified = 0

    with open(pgn_path) as f:
        while True:
            game = chess.pgn.read_game(f)
            if game is None:
                break
            total += 1
            if total % 50000 == 0:
                print(f"  Scanned {total}... collected {len(book)} positions")

            if rating_min:
                try:
                    w_elo = int(game.headers.get("WhiteElo", "0"))
                    b_elo = int(game.headers.get("BlackElo", "0"))
                except ValueError:
                    continue
                if w_elo < rating_min or b_elo < rating_min:
                    continue
            qualified += 1
            if decisive_only and game.headers.get("Result") not in ("1-0", "0-1"):
                continue

            board = game.board()
            for i, move in enumerate(game.mainline_moves()):
                if i >= max_plies:
                    break
                fen = board.fen()
                uci = move.uci()
                entry = book.setdefault(fen, {})
                entry[uci] = entry.get(uci, 0) + 1
                board.push(move)

    print(f"Scanned: {total}, qualified: {qualified}, positions: {len(book)}")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(book, separators=(",", ":")))
    print(f"Saved {len(book)} positions to {output_path}")
