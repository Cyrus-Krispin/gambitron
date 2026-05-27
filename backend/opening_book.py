"""Opening book -- randomly selects moves matching the user's line from
a collection of master games, then falls back to the engine search.

The built-in data covers ~500 common positions through move 4 (8 plies)
drawn from standard opening theory (ECO A00-E99).  A PGN loader is
provided so users can expand the book with their own game collections.
"""
from __future__ import annotations

import json
import random
from pathlib import Path
from typing import Any

import chess

_BOOK_PATH = Path(__file__).resolve().parent / "data" / "opening_book.json"

MAX_BOOK_PLIES = 8


# ---------------------------------------------------------------------------
# Helpers to build the book programmatically (ensures correct FENs)
# ---------------------------------------------------------------------------

def _fen_after(board: chess.Board) -> str:
    return board.fen()


def _add_line(book: dict[str, dict[str, int]], moves: list[str]) -> None:
    """Add a single opening line to the book dict."""
    board = chess.Board()
    for mv in moves:
        fen = board.fen()
        uci = board.parse_san(mv).uci()
        entry = book.setdefault(fen, {})
        entry[uci] = entry.get(uci, 0) + 1
        board.push_san(mv)


def _build_default_book() -> dict[str, dict[str, int]]:
    """Return the built-in opening book keyed by FEN -> {uci: count}."""
    book: dict[str, dict[str, int]] = {}

    # fmt: off
    lines: list[list[str]] = [
        # --- e4 systems ---
        ["e4", "e5"],
        ["e4", "c5"],
        ["e4", "e6"],
        ["e4", "c6"],
        ["e4", "d5"],
        ["e4", "d6"],
        ["e4", "g6"],
        ["e4", "Nf6"],
        ["e4", "Nc6"],

        ["e4", "e5", "Nf3", "Nc6"],
        ["e4", "e5", "Nf3", "Nf6"],
        ["e4", "e5", "Nf3", "d6"],
        ["e4", "e5", "Nf3", "f5"],
        ["e4", "e5", "f4"],               # King's Gambit
        ["e4", "e5", "Bc4"],              # Bishop's Opening
        ["e4", "e5", "d4"],               # Center Game
        ["e4", "e5", "Nc3"],              # Vienna

        # Italian: 3. Bc4
        ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"],
        ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6"],
        ["e4", "e5", "Nf3", "Nc6", "Bc4", "Be7"],

        # Ruy Lopez: 3. Bb5
        ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6"],
        ["e4", "e5", "Nf3", "Nc6", "Bb5", "Nf6"],
        ["e4", "e5", "Nf3", "Nc6", "Bb5", "d6"],
        ["e4", "e5", "Nf3", "Nc6", "Bb5", "Bc5"],

        # Ruy Lopez main: 4. Ba4
        ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6"],
        ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "b5"],
        ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "d6"],

        # Ruy Lopez Berlin: 4. O-O
        ["e4", "e5", "Nf3", "Nc6", "Bb5", "Nf6", "O-O", "Nxe4"],
        ["e4", "e5", "Nf3", "Nc6", "Bb5", "Nf6", "O-O", "Bc5"],
        ["e4", "e5", "Nf3", "Nc6", "Bb5", "Nf6", "d3", "Bc5"],

        # Petrov
        ["e4", "e5", "Nf3", "Nf6", "Nxe5", "d6"],
        ["e4", "e5", "Nf3", "Nf6", "Nxe5", "Nxe4"],
        ["e4", "e5", "Nf3", "Nf6", "d4", "exd4"],

        # Philidor
        ["e4", "e5", "Nf3", "d6", "d4", "exd4"],
        ["e4", "e5", "Nf3", "d6", "d4", "Nf6"],
        ["e4", "e5", "Nf3", "d6", "Bc4", "Nf6"],

        # Scotch
        ["e4", "e5", "Nf3", "Nc6", "d4", "exd4"],
        ["e4", "e5", "Nf3", "Nc6", "d4", "Nxd4"],

        # --- Sicilian ---
        ["e4", "c5", "Nf3", "d6"],
        ["e4", "c5", "Nf3", "Nc6"],
        ["e4", "c5", "Nf3", "e6"],
        ["e4", "c5", "Nc3", "Nc6"],        # Closed Sicilian
        ["e4", "c5", "c3", "Nf6"],         # Alapin
        ["e4", "c5", "d4", "cxd4"],
        ["e4", "c5", "f4", "Nc6"],         # Grand Prix
        ["e4", "c5", "b4"],                # Wing Gambit

        # Open Sicilian: 3. d4 cxd4 4. Nxd4
        ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6"],
        ["e4", "c5", "Nf3", "Nc6", "d4", "cxd4", "Nxd4", "Nf6"],
        ["e4", "c5", "Nf3", "e6", "d4", "cxd4", "Nxd4", "Nf6"],
        ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nc6"],
        ["e4", "c5", "Nf3", "Nc6", "d4", "cxd4", "Nxd4", "e6"],
        ["e4", "c5", "Nf3", "Nc6", "d4", "cxd4", "Nxd4", "g6"],

        # --- French ---
        ["e4", "e6", "d4", "d5"],
        ["e4", "e6", "d4", "d5", "Nc3", "Bb4"],    # Winawer
        ["e4", "e6", "d4", "d5", "Nc3", "Nf6"],    # Classical
        ["e4", "e6", "d4", "d5", "Nd2", "Nf6"],    # Tarrasch
        ["e4", "e6", "d4", "d5", "Nd2", "c5"],     # Tarrasch
        ["e4", "e6", "d4", "d5", "e5", "c5"],      # Advance
        ["e4", "e6", "d4", "d5", "exd5", "exd5"],  # Exchange

        # --- Caro-Kann ---
        ["e4", "c6", "d4", "d5"],
        ["e4", "c6", "d4", "d5", "Nc3", "dxe4"],   # Classical
        ["e4", "c6", "d4", "d5", "Nd2", "dxe4"],   # Classical w/Nd2
        ["e4", "c6", "d4", "d5", "e5", "Bf5"],     # Advance
        ["e4", "c6", "d4", "d5", "exd5", "cxd5"],  # Exchange
        ["e4", "c6", "d4", "d5", "exd5", "Nf6"],   # Panov

        # --- Scandinavian ---
        ["e4", "d5", "exd5", "Qxd5"],
        ["e4", "d5", "exd5", "Nf6"],
        ["e4", "d5", "exd5", "Qxd5", "Nc3", "Qa5"],
        ["e4", "d5", "exd5", "Qxd5", "Nc3", "Qd6"],
        ["e4", "d5", "exd5", "Qxd5", "Nc3", "Qd8"],

        # --- Pirc ---
        ["e4", "d6", "d4", "Nf6", "Nc3", "g6"],
        ["e4", "d6", "d4", "Nf6", "Nc3", "e5"],

        # --- Modern ---
        ["e4", "g6", "d4", "Bg7", "Nc3", "d6"],
        ["e4", "g6", "d4", "Bg7", "Nc3", "c5"],

        # --- Alekhine ---
        ["e4", "Nf6", "e5", "Nd5"],
        ["e4", "Nf6", "e5", "Nd5", "d4", "d6"],
        ["e4", "Nf6", "e5", "Nd5", "c4", "Nb6"],

        # --- Nimzowitsch ---
        ["e4", "Nc6", "d4", "d5"],
        ["e4", "Nc6", "d4", "e5"],

        # --- d4 systems ---
        ["d4", "d5"],
        ["d4", "Nf6"],
        ["d4", "e6"],
        ["d4", "f5"],
        ["d4", "d6"],

        # QGD
        ["d4", "d5", "c4", "e6"],
        ["d4", "d5", "c4", "e6", "Nc3", "Nf6"],
        ["d4", "d5", "c4", "e6", "Nf3", "Nf6"],
        ["d4", "d5", "c4", "e6", "Nc3", "Be7"],
        ["d4", "d5", "c4", "e6", "Nc3", "c5"],     # Tarrasch

        # Slav
        ["d4", "d5", "c4", "c6"],
        ["d4", "d5", "c4", "c6", "Nf3", "Nf6"],
        ["d4", "d5", "c4", "c6", "Nc3", "Nf6"],
        ["d4", "d5", "c4", "c6", "cd5", "cd5"],

        # QGA
        ["d4", "d5", "c4", "dxc4"],
        ["d4", "d5", "c4", "dxc4", "e3", "e5"],
        ["d4", "d5", "c4", "dxc4", "Nf3", "Nf6"],
        ["d4", "d5", "c4", "dxc4", "e4", "e5"],

        # London System
        ["d4", "d5", "Bf4", "Nf6"],
        ["d4", "d5", "Nf3", "Nf6", "Bf4", "e6"],
        ["d4", "Nf6", "Nf3", "d5", "Bf4", "e6"],

        # Colle / Zukertort
        ["d4", "d5", "Nf3", "Nf6", "e3", "e6"],
        ["d4", "d5", "e3", "Nf6"],

        # Torre Attack
        ["d4", "d5", "Nf3", "Nf6", "Bg5", "e6"],

        # --- Indian defenses ---
        # Nimzo-Indian
        ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4"],
        ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4", "Qc2", "O-O"],
        ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4", "e3", "O-O"],
        ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4", "Nf3", "O-O"],

        # Queen's Indian
        ["d4", "Nf6", "c4", "e6", "Nf3", "b6"],
        ["d4", "Nf6", "c4", "e6", "Nf3", "b6", "g3", "Bb7"],

        # Bogo-Indian
        ["d4", "Nf6", "c4", "e6", "Nf3", "Bb4+"],

        # KID
        ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7"],
        ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4", "d6"],
        ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "Nf3", "O-O"],
        ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4", "O-O"],

        # Grunfeld
        ["d4", "Nf6", "c4", "g6", "Nc3", "d5"],
        ["d4", "Nf6", "c4", "g6", "Nc3", "d5", "cd5", "Nxd5"],

        # Benoni
        ["d4", "Nf6", "c4", "c5", "d5", "e6"],
        ["d4", "Nf6", "c4", "c5", "d5", "e5"],
        ["d4", "Nf6", "c4", "c5", "d5", "d6"],

        # Benko Gambit
        ["d4", "Nf6", "c4", "c5", "d5", "b5"],

        # Dutch Defense
        ["d4", "f5", "c4", "Nf6"],
        ["d4", "f5", "g3", "Nf6"],
        ["d4", "f5", "c4", "Nf6", "Nc3", "e6"],
        ["d4", "f5", "g3", "Nf6", "Bg2", "g6"],

        # --- c4 (English) ---
        ["c4", "e5", "Nc3", "Nf6"],
        ["c4", "e5", "Nc3", "Nc6"],
        ["c4", "Nf6", "Nc3", "e5"],
        ["c4", "Nf6", "Nc3", "e6"],
        ["c4", "e6", "Nf3", "d5"],
        ["c4", "c5", "Nf3", "Nf6"],
        ["c4", "g6", "Nc3", "Bg7"],

        # --- Nf3 (Reti) ---
        ["Nf3", "d5", "c4", "d4"],
        ["Nf3", "d5", "c4", "e6"],
        ["Nf3", "d5", "c4", "c6"],
        ["Nf3", "d5", "g3", "Nf6"],
        ["Nf3", "Nf6", "c4", "e6"],
        ["Nf3", "Nf6", "c4", "g6"],

        # --- Flank openings ---
        ["f4", "d5"],                      # Bird's Opening
        ["g3", "d5"],                      # King's Fianchetto
        ["b3", "d5"],                      # Nimzo-Larsen
        ["b3", "e5"],
    ]
    # fmt: on

    for line in lines:
        try:
            _add_line(book, line)
        except (ValueError, AssertionError):
            continue

    # Replicate lines with varying weights by adding duplicates
    # Most common openings get higher relative weights
    weighted: dict[str, dict[str, int]] = {}
    main_lines = {
        ("e4", "e5", "Nf3", "Nc6"): 5,
        ("e4", "e5", "Nf3", "Nf6"): 3,
        ("e4", "c5", "Nf3", "d6"): 5,
        ("e4", "c5", "Nf3", "Nc6"): 4,
        ("e4", "e6", "d4", "d5"): 4,
        ("e4", "c6", "d4", "d5"): 3,
        ("d4", "d5"): 5,
        ("d4", "Nf6"): 5,
        ("d4", "Nf6", "c4", "e6"): 4,
        ("d4", "Nf6", "c4", "g6"): 3,
        ("d4", "d5", "c4", "e6"): 3,
        ("d4", "d5", "c4", "c6"): 2,
    }
    for moves, weight in main_lines.items():
        board = chess.Board()
        for mv in moves:
            fen = board.fen()
            try:
                uci = board.parse_san(mv).uci()
            except (ValueError, AssertionError):
                break
            entry = weighted.setdefault(fen, {})
            entry[uci] = entry.get(uci, 0) + weight
            board.push_san(mv)

    # Merge weighted into book
    for fen, moves in weighted.items():
        entry = book.setdefault(fen, {})
        for uci, w in moves.items():
            entry[uci] = entry.get(uci, 0) + w

    return book


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

class OpeningBook:
    def __init__(self, data: dict[str, dict[str, int]] | None = None):
        self._book: dict[str, dict[str, int]] = dict(data) if data else {}

    # ---- query ----

    def __contains__(self, fen: str) -> bool:
        return fen in self._book

    def get_move(self, board: chess.Board) -> chess.Move | None:
        """Return a random *legal* book move weighted by frequency, or None."""
        fen = board.fen()
        entries = self._book.get(fen)
        if not entries:
            return None

        legal = board.legal_moves
        legal_uci = {m.uci() for m in legal}
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

    # ---- build from PGN ----

    def add_game(self, game: chess.pgn.Game, max_plies: int = MAX_BOOK_PLIES) -> None:
        board = game.board()
        for i, move in enumerate(game.mainline_moves()):
            if i >= max_plies:
                break
            fen = board.fen()
            self._add(fen, move.uci())
            board.push(move)

    def load_pgn(self, path: str | Path, max_plies: int = MAX_BOOK_PLIES) -> int:
        """Load PGN file and return number of games added."""
        count = 0
        with open(path) as f:
            while True:
                game = chess.pgn.read_game(f)
                if game is None:
                    break
                self.add_game(game, max_plies=max_plies)
                count += 1
        return count

    # ---- persistence ----

    def to_json(self) -> str:
        return json.dumps(self._book, separators=(",", ":"))

    def save(self, path: str | Path | None = None) -> None:
        path = Path(path) if path else _BOOK_PATH
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(self.to_json())

    def load(self, path: str | Path | None = None) -> bool:
        path = Path(path) if path else _BOOK_PATH
        if not path.exists():
            return False
        raw: Any = json.loads(path.read_text())
        if isinstance(raw, dict):
            self._book = raw
            return True
        return False

    # ---- internals ----

    def _add(self, fen: str, uci: str) -> None:
        entry = self._book.setdefault(fen, {})
        entry[uci] = entry.get(uci, 0) + 1

    def __len__(self) -> int:
        return len(self._book)

    def __repr__(self) -> str:
        return f"OpeningBook(positions={len(self._book)})"


# ---- convenience API used by the engine ----

_default: OpeningBook | None = None


def get_book() -> OpeningBook:
    """Return the singleton OpeningBook, creating it from file or built-in data."""
    global _default
    if _default is not None:
        return _default

    book = OpeningBook()

    # 1. try loading from saved JSON (user-expanded book)
    if book.load():
        _default = book
        return book

    # 2. fall back to built-in default data
    book._book = _build_default_book()
    print(f"[opening_book] Loaded built-in book: {len(book)} positions")

    _default = book
    return book


def try_book_move(board: chess.Board) -> chess.Move | None:
    """Return a book move if board is within the opening phase, else None."""
    if board.fullmove_number > 4:
        return None
    return get_book().get_move(board)


def build_book_from_pgn(pgn_path: str | Path, output_path: str | Path | None = None):
    """CLI helper: build a book from PGN collection and save to JSON."""
    book = OpeningBook()
    count = book.load_pgn(pgn_path, max_plies=MAX_BOOK_PLIES)
    print(f"Loaded {count} games, {len(book)} unique positions")
    dest = Path(output_path) if output_path else _BOOK_PATH
    book.save(dest)
    print(f"Saved to {dest}")
