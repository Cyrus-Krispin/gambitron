"""Opening book — randomly follows a line from a pool of real games.

Loads a collection of game move sequences.  For the first 4 moves (8 plies),
the engine filters games matching the move history played so far, randomly
picks one, and plays that game's next move.  If no game matches the current
line, falls back to the normal engine search.

Build the game pool:
    python -c "from opening_book import build_pool_from_pgn; build_pool_from_pgn('games.pgn')"
"""
from __future__ import annotations

import json
import random
from pathlib import Path

import chess

_POOL_PATH = Path(__file__).resolve().parent / "data" / "opening_games.json"

MAX_BOOK_PLIES = 8


class OpeningBook:
    """Line-following opening book from a pool of game move sequences."""

    def __init__(self, games: list[list[str]] | None = None):
        # active_pool is the subset of games matching the current line
        self._all_games: list[list[str]] = list(games) if games else []
        self._active_pool: list[list[str]] = list(self._all_games)

    # ---- query ----

    def get_move(self, board: chess.Board) -> chess.Move | None:
        """Return the next move from a randomly chosen matching game, or None.

        Filters the active pool to games that contain the moves played so far,
        then randomly picks one survivor and returns its next move for this
        position.
        """
        if board.fullmove_number > 4:
            return None

        # Rebuild the active pool by filtering on the full move history
        history = self._extract_history(board)
        self._active_pool = self._filter_pool(self._active_pool, history)

        if not self._active_pool:
            return None

        idx = random.randrange(len(self._active_pool))
        game = self._active_pool[idx]
        ply = len(history)
        if ply >= len(game):
            return None

        uci = game[ply]
        try:
            return chess.Move.from_uci(uci)
        except ValueError:
            return None

    def reset(self) -> None:
        """Reset the active pool to all games (start of a new game)."""
        self._active_pool = list(self._all_games)

    # ---- pool management ----

    def load_pool(self, path: str | Path | None = None) -> int:
        """Load game sequences from JSON file.  Returns number of games."""
        path = Path(path) if path else _POOL_PATH
        if not path.exists():
            return 0
        raw = json.loads(path.read_text())
        if isinstance(raw, list):
            self._all_games = raw
            self._active_pool = list(raw)
            return len(raw)
        return 0

    def _filter_pool(
        self, pool: list[list[str]], history: list[str]
    ) -> list[list[str]]:
        """Keep only games whose prefix matches the move history exactly."""
        if not history:
            return pool
        return [g for g in pool if g[: len(history)] == history]

    @staticmethod
    def _extract_history(board: chess.Board) -> list[str]:
        """Return the UCI move history from the board's move stack."""
        return [m.uci() for m in board.move_stack]


# ---- convenience API used by the engine ----

_default: OpeningBook | None = None


def get_book() -> OpeningBook:
    """Return the singleton OpeningBook, loading game pool from disk."""
    global _default
    if _default is not None:
        return _default

    book = OpeningBook()
    count = book.load_pool()
    if count:
        print(f"[opening_book] Loaded {count} games from pool")
    else:
        print("[opening_book] No game pool found — run build_pool_from_pgn() first")

    _default = book
    return book


def try_book_move(board: chess.Board) -> chess.Move | None:
    """Return a book move if within the opening phase, else None."""
    if board.fullmove_number > 4:
        return None
    return get_book().get_move(board)


def reset_book() -> None:
    """Reset the opening book for a new game (reloads all games into pool)."""
    global _default
    if _default is not None:
        _default.reset()
        return
    # First call — create the book
    get_book()


# ---- PGN pool builder ----

def build_pool_from_pgn(
    pgn_path: str | Path,
    output_path: str | Path | None = None,
    rating_min: int = 2000,
    decisive_only: bool = True,
    max_games: int = 5000,
    max_plies: int = MAX_BOOK_PLIES,
):
    """Scan a PGN file and save filtered game move sequences as JSON."""
    import chess.pgn

    output_path = Path(output_path) if output_path else _POOL_PATH
    games: list[list[str]] = []
    total = qualified = 0

    with open(pgn_path) as f:
        while len(games) < max_games:
            game = chess.pgn.read_game(f)
            if game is None:
                break
            total += 1
            if total % 50000 == 0:
                print(f"  Scanned {total}... collected {len(games)}")

            if rating_min:
                try:
                    w_elo = int(game.headers.get("WhiteElo", "0"))
                    b_elo = int(game.headers.get("BlackElo", "0"))
                except ValueError:
                    continue
                if w_elo < rating_min or b_elo < rating_min:
                    continue
            qualified += 1

            if decisive_only:
                if game.headers.get("Result") not in ("1-0", "0-1"):
                    continue

            moves = list(game.mainline_moves())
            if len(moves) < 4:
                continue

            move_ucis = [m.uci() for m in moves[:max_plies]]
            games.append(move_ucis)

    print(f"Scanned: {total}, qualified (rated): {qualified}, collected: {len(games)}")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(games))
    print(f"Saved {len(games)} games to {output_path}")
